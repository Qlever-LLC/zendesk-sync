/**
 * @license
 * Copyright 2022 Qlever LLC
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { type Logger } from '@oada/pino-debug';
import { access } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { launch } from 'puppeteer';
import pTimeout from 'p-timeout';
import path from 'node:path';

import type { TicketArchive } from '../types.js';
import { makeCredentialedGetRequest } from './utils.js';

// Internal web server
//
const MIME_TYPES: Record<string, string> = {
  default: 'application/octet-stream',
  html: 'text/html; charset=UTF-8',
  js: 'application/javascript',
  css: 'text/css',
  png: 'image/png',
  json: 'application/json',
};

const STATIC_PATH = path.join(process.cwd(), './dist-template');
const ZD_ATTACHMENT =
  /https:\/\/.+zendesk.com\/collaboration\/graphql\/attachments\/.*/;
const ZD_SIDE_ATTACHMENT =
  /https:\/\/.+zendesk.com\/api\/v2\/tickets\/.*\/side_conversations\/.*/;
const ZD_THREAD_ATTACHMENT =
  /https:\/\/.+zendesk.com\/collaboration\/graphql\/threads\/.*/;

const prepareFile = async (url: string) => {
  const paths = [STATIC_PATH, url];
  if (url.endsWith('/')) paths.push('index.html');
  const filePath = path.join(...paths);
  const pathTraversal = !filePath.startsWith(STATIC_PATH);
  // eslint-disable-next-line github/no-then
  const exists = await access(filePath).then(
    () => true,
    () => false,
  );
  const found = !pathTraversal && exists;
  const streamPath = found ? filePath : `${STATIC_PATH}/index.html`;
  const extension = path.extname(streamPath).slice(1).toLowerCase();
  const stream = createReadStream(streamPath);
  return { found, ext: extension, stream };
};

// Don't process PDFs until _after_ the HTTP server is up and ready
const address = new Promise<string>((resolve, reject) => {
  const server = createServer(async (req, res) => {
    if (req.url) {
      const file = await prepareFile(req.url);
      const statusCode = 200; // We always fallback to index.html
      const mimeType = MIME_TYPES[file.ext] ?? MIME_TYPES.default;
      res.writeHead(statusCode, { 'Content-Type': mimeType });
      file.stream.pipe(res);
    }
  }).listen(0, '127.0.0.1');

  server.on('listening', () => {
    const a = server.address();

    if (typeof a == 'string') {
      resolve(a);
    } else if (a) {
      resolve(`127.0.0.1:${a.port}`);
    } else {
      reject(new Error('Could not create local server to serve template.'));
    }
  });
});

// Lauch embedded Chrome, load template, serve archive JSON, save result as ticket PDF
export async function generateTicketPdf(
  archive: TicketArchive,
  log: Logger,
): Promise<Uint8Array> {
  const puppeteerErrors: string[] = [];

  log.debug('Starting Puppeteer');
  let browser = await launch({
    headless: true,
    pipe: true,
    // ExecutablePath: 'google-chrome-stable',
    args: [
      '--disable-extensions',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-dev-shm-usage',
    ],
    dumpio: false,
  });

  log.trace('Starting new browser page');
  let page;

  try {
    page = await pTimeout(browser.newPage(), {
      milliseconds: 1000,
      async fallback() {
        log.debug('Could not start new page. Trying again.');

        await browser.close();
        browser = await launch({
          headless: true,
          pipe: true,
          // ExecutablePath: 'google-chrome-stable',
          args: [
            '--disable-extensions',
            '--no-sandbox',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-dev-shm-usage',
          ],
          dumpio: false,
        });

        return pTimeout(browser.newPage(), { milliseconds: 1000 });
      },
    });
  } catch (error) {
    await browser.close();
    log.error(`Could not create new page in puppeteer! ${error}`);

    throw error;
  }

  log.trace(`Have new page!`);

  page
    .on('load', () => {
      log.trace(`[Puppeteer] load occured`);
    })
    .on('error', (error) => {
      log.error(`[Puppeteer] ${error.name}: ${error.message}.`);
    })
    .on('console', (message) => {
      const type = message.type().slice(0, 3).toLowerCase();

      log.warn(`[Puppeteer ${type}]: (${message.location}) ${message.text()}`);
      if (type === 'err') {
        puppeteerErrors.push(message.text());
      }
    })
    .on('pageerror', (error) => {
      log.warn({ error }, `[Puppeteer] ${error.name}: ${error.message}.`);
      puppeteerErrors.push(error.message);
    })
    .on('requestfailed', (request) => {
      log.warn(`[Puppeteer] ${request.failure()?.errorText} ${request.url()}`);
      puppeteerErrors.push(request.failure()?.errorText ?? 'Request failure');
    });

  log.trace('Setting requestInterception = true');
  await page.setRequestInterception(true);

  page.on('request', async (request) => {
    if (request.url() === 'http://127.0.0.1/_data') {
      // Inject the ticket archive into the browser
      await request.respond({
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '' },
        body: JSON.stringify(archive),
      });

      // Proxy Zendesk attachments through an authenticated API
    } else if (
      ZD_ATTACHMENT.test(request.url()) ||
      ZD_SIDE_ATTACHMENT.test(request.url()) ||
      ZD_THREAD_ATTACHMENT.test(request.url())
    ) {
      try {
        // Proxy the buffer
        await request.respond({
          headers: { 'Access-Control-Allow-Origin': '' },
          body: await makeCredentialedGetRequest(log, request.url(), {
            responseType: 'arraybuffer',
          }),
        });
      } catch (error) {
        log.trace({ error }, `Credentialed API request to ZenDesk failed.`);
        puppeteerErrors.push(`${error}`);
        await request.abort('failed');
      }
    } else {
      // Some other fetch, which we let continue as normal
      await request.continue();
    }
  });

  log.trace(`Going to http://${await address}/`);
  try {
    await pTimeout(
      page.goto(`http://${await address}/`, {
        waitUntil: ['load', 'networkidle0'],
      }),
      {
        milliseconds: 10_000,
        async fallback() {
          log.debug('Could not navigate to ticket template. Trying again.');

          return pTimeout(
            page.goto(`http://${await address}/`, {
              waitUntil: ['load', 'networkidle0'],
            }),
            { milliseconds: 10_000 },
          );
        },
      },
    );
  } catch (error) {
    await browser.close();
    log.error(`Could not navigate to ticket template! ${error}`);

    throw error;
  }

  log.trace('Saving page PDF.');
  const pdf = await page.pdf({
    format: 'letter',
    margin: { top: '20px', left: '20px', right: '20px', bottom: '20px' },
    printBackground: true,
  });

  log.trace('Closing page.');
  await page.close();
  log.trace('Closing browser.');
  await browser.close();
  log.trace('PDF done.');

  if (puppeteerErrors.length > 0) {
    throw new Error(
      `Failed to generate PDF properly, puppeteer encountered: ${puppeteerErrors.join(', ')}`,
    );
  }

  return pdf;
}