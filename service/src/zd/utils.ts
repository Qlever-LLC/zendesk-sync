/**
 * @license
 * Copyright 2024 Qlever LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Logger } from "@oada/pino-debug";
import axiosLibrary, { type AxiosRequestConfig } from "axios";
import { buildMemoryStorage, setupCache } from "axios-cache-interceptor";
import pThrottle from "p-throttle";

import { config } from "../config.js";

const throttle = pThrottle({
  limit: config.get("zendesk.api_limit"),
  interval: config.get("zendesk.api_limit_interval"),
  strict: true,
});

// Replace axios with a memory cache wrapper
const axios = setupCache(axiosLibrary.create(), {
  storage: buildMemoryStorage(true, 20 * 1000, 5000),
});

export async function callTypedApi<T>(
  log: Logger,
  url: string,
  key: string,
  cnf?: AxiosRequestConfig,
): Promise<T> {
  const data = await makeCredentialedGetRequest<Record<string, T>>(
    log,
    url,
    cnf,
  );

  if (!data?.[key]) {
    log.error(
      { type: key, url, cnf, data },
      "ZenDesk API call did not return the expected type?",
    );
    throw new Error("Unexpected ZenDesk API response");
  }

  return data[key];
}

export async function callTypedPagedApi<T>(
  log: Logger,
  url: string,
  key: string,
  cnf?: AxiosRequestConfig,
): Promise<T[]> {
  const data = await makeCredentialedGetRequest<
    BaseResponse & Record<string, T[]>
  >(log, url, cnf);

  if (!data?.[key]) {
    log.error(
      { type: key, url, cnf, data },
      "ZenDesk API call did not return the expected type?",
    );
    throw new Error("Unexpected ZenDesk API response");
  }

  const items = data[key];

  if (data.next_page) {
    items.concat(await callTypedPagedApi(log, data.next_page, key, cnf));
  }

  return items;
}

export async function makeCredentialedGetRequest<T>(
  log: Logger,
  url: string,
  cnf?: AxiosRequestConfig,
): Promise<T> {
  log?.trace(`Making credentialed GET request: ${url}`);
  const { username, password, baseURL } = config.get("zendesk");

  const r = await throttle(async () =>
    axios({
      ...cnf,
      method: "get",
      baseURL,
      url,
      auth: {
        username,
        password,
      },
    }),
  )();

  if (cnf?.responseType === "arraybuffer") {
    return {
      buffer: r.data,
    } as T;
  }

  return r.data as T;
}

export async function makeCredentialedPutRequest(
  log: Logger,
  url: string,
  cnf?: AxiosRequestConfig,
) {
  log?.trace(`Making credentialed PUT request: ${url}`);
  const { username, password, baseURL } = config.get("zendesk");

  await throttle(async () =>
    axios({
      ...cnf,
      method: "put",
      baseURL,
      url,
      auth: {
        username,
        password,
      },
    }),
  )();
}

// Map an array of objects with key '`d` to an object indexed by `id`
export function indexById<T extends { id: number | string }>(
  data: T[],
): Record<string, T> {
  const output: Record<string, T> = {};

  for (const element of data) {
    output[element.id] = element;
  }

  return output;
}

// TYPES
export interface TrellisState {
  state: string | undefined;
  status: string | undefined;
}

interface BaseResponse {
  next_page?: string;
  previous_page?: string;
  count: number;
}
