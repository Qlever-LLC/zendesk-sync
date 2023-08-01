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

import libConfig from '@oada/lib-config';

export const { config } = await libConfig({
  oada: {
    domain: {
      doc: 'OADA API domain',
      format: String,
      default: 'localhost',
      env: 'DOMAIN',
      arg: 'domain',
    },
    token: {
      doc: 'OADA API token',
      format: String,
      default: 'god',
      env: 'TOKEN',
      arg: 'token',
    },
  },
  zendesk: {
    delay: {
      doc: 'Zendesk delay for writes to take effect',
      format: Number,
      default: 120_000,
      env: 'ZD_DELAY',
      arg: 'zd_delay',
    },
    domain: {
      doc: 'Zendesk API domain',
      format: String,
      default: '',
      env: 'ZD_DOMAIN',
      arg: 'zd_domain',
    },
    username: {
      doc: 'Zendesk username email',
      format: String,
      default: '',
      env: 'ZD_USERNAME',
      arg: 'zd_username',
    },
    password: {
      doc: 'Zendesk token/password',
      format: String,
      default: '',
      env: 'ZD_PASS',
      arg: 'zd_pass',
    },
    api_limit: {
      doc: 'Zendesk API per minute rate limit',
      format: Number,
      default: 700,
      env: 'ZD_API_LIMIT',
      arg: 'zd_api_limit',
    },
    org_field_id: {
      doc: 'Zendesk field ID for cataloged organziation',
      default: 17666136440077, //TODO: This value is for the sandbox. Get the id for prod
      format: Number,
      env: 'ZD_ORG_FIELD_ID',
      arg: 'zd_org_field_id',
    },
  },
  concurrency: {
    doc: 'Concurrency limit for processing tickets',
    format: Number,
    default: 5,
    env: 'CONCURRENCY',
    arg: 'concurrency',
  },
  'poll-rate': {
    doc: 'Polling rate in seconds',
    format: Number,
    default: 180,
    env: 'POLL_RATE',
    arg: 'poll-rate',
  },
  timeout: {
    doc: 'Time limit for processing a ticket',
    format: Number,
    default: 100_000,
    env: 'JOB_TIMEOUT',
    arg: 'job_timeout',
  },
  testing: {
    email1: {
      name: {
        doc: 'Name used by email1 in tests',
        format: String,
        default: '',
        env: 'E1_NAME',
        arg: 'e1_name',
      },
      address: {
        doc: 'Email1 address used for tests',
        format: String,
        default: '',
        env: 'E1_ADDRESS',
        arg: 'e1_address',
      },
    },
    email2: {
      name: {
        doc: 'Name used by email1 in tests',
        format: String,
        default: '',
        env: 'E2_NAME',
        arg: 'e2_name',
      },
      address: {
        doc: 'Email1 address used for tests',
        format: String,
        default: '',
        env: 'E2_ADDRESS',
        arg: 'e2_address',
      },
    },

  }

});