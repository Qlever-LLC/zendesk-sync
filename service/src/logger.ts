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

// Import this _before_ pino and/or DEBUG
import '@oada/pino-debug';

import libraryDebug from 'debug';

export function makeLoggers(key: string) {
  return {
    info: libraryDebug(`zendesk-sync:${key}:info`),
    warn: libraryDebug(`zendesk-sync:${key}:warn`),
    debug: libraryDebug(`zendesk-sync:${key}:debug`),
    trace: libraryDebug(`zendesk-sync:${key}:trace`),
    error: libraryDebug(`zendesk-sync:${key}:error`),
    fatal: libraryDebug(`zendesk-sync:${key}:fatal`),
  };
}
