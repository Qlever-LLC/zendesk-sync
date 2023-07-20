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

import { access } from 'fs/promises';
import { createReadStream } from 'fs';
import { createServer } from 'http';
import { join, extname } from 'path';
import { launch } from 'puppeteer';
import debug from 'debug';
import { TicketArchive } from './zendesk.js';

const info = debug('zendesk-sync:pdf:info');
const warn = debug('zendesk-sync:pdf:warn');
const error = debug('zendesk-sync:pdf:error');
const trace = debug('zendesk-sync:pdf:trace');

// Internal web server
const MIME_TYPES: Record<string, string> = {
  default: 'application/octet-stream',
  html: 'text/html; charset=UTF-8',
  js: 'application/javascript',
  css: 'text/css',
  png: 'image/png',
  json: 'application/json',
};

// FIXME: How to connect to template build?
const STATIC_PATH = join(process.cwd(), './ticket-build');

const prepareFile = async (url: string) => {
  const paths = [STATIC_PATH, url];
  if (url.endsWith('/')) paths.push('index.html');
  const filePath = join(...paths);
  const pathTraversal = !filePath.startsWith(STATIC_PATH);
  const exists = await access(filePath).then(
    () => true,
    () => false
  );
  const found = !pathTraversal && exists;
  const streamPath = found ? filePath : STATIC_PATH + '/404.html';
  const ext = extname(streamPath).substring(1).toLowerCase();
  const stream = createReadStream(streamPath);
  return { found, ext, stream };
};

// Don't do anything PDF processing until after the HTTP server is ready
let ready = new Promise<string>((resolve, reject) => {
  const server = createServer(async (req, res) => {
    if (req.url) {
      const file = await prepareFile(req.url);
      const statusCode = file.found ? 200 : 404;
      const mimeType = MIME_TYPES[file.ext] || MIME_TYPES.default;
      res.writeHead(statusCode, { 'Content-Type': mimeType });
      file.stream.pipe(res);
      console.log(`${req.method} ${req.url} ${statusCode}`);
    }
  }).listen(0);

  server.on('listening', () => {
    let a = server.address();

    if (typeof a == 'string') {
      resolve(a);
    } else if (a) {
      resolve(`${a.address}:${a.port}`);
    } else {
      reject('Could not create local server to serve template.');
    }
  });
});

export async function generatePdf(archive: TicketArchive): Promise<Buffer> {
  let address = await ready;

  const browser = await launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-web-security'],
    dumpio: true,
  });

  let page = (await browser.newPage())
    .on('load', trace)
    .on('error', error)
    .on('console', (message) =>
      info(`${message.type().substring(0, 3).toUpperCase()} ${message.text()}`)
    )
    .on('pageerror', error)
    .on('requestfailed', (request) =>
      warn(`${request.failure()?.errorText} ${request.url()}`)
    );

  await page.setRequestInterception(true);

  page.on('request', (request) => {
    if (request.url() === 'http://localhost/ticket-data') {
      request.respond({
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '' },
        body: JSON.stringify(archive),
      });
    } else {
      request.continue();
    }
  });

  await page.goto(`http://${address}`, {
    waitUntil: ['load', 'networkidle0'],
  });

  const pdf = await page.pdf({
    format: 'letter',
    margin: { top: '20px', left: '20px', right: '20px', bottom: '20px' },
    printBackground: true,
  });

  await browser.close();

  return pdf;
}