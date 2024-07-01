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
  mode: {
    doc: 'Run sync in production mode',
    format: String,
    default: 'testing',
    env: 'NODE_ENV',
    arg: 'mode',
  },
  service: {
    poller: {
      'poll-rate': {
        doc: 'Polling rate in seconds',
        format: Number,
        default: 180,
        env: 'SERVICE_POLLER_RATE',
        arg: 'service-poller-rate',
      },
      'force-age': {
        doc: 'The age (in seconds) when a ticket is forced archived under the default organiation',
        format: Number,
        default: 27 * 24 * 60 * 60,
        env: 'SERVICE_POLLER_FORCE_ARCHIVE_AGE',
        arg: 'service-poller-force-archive-age',
      },
      'closer': {
        doc: 'The closer to use when processing tickets.',
        format: String,
        default: 'none',
        env: 'SERVICE_POLLER_CLOSER',
        arg: 'service-poller-closer',
      },
    },
    archiveTicket: {
      name: {
        doc: 'Service name of ZenDesk archive service',
        default: 'archiveTicket',
        env: 'SERVICE_ARCHIVE_NAME',
        arg: 'service-archive-name',
      },
      timeout: {
        doc: 'Time limit for processing a ticket archive',
        format: Number,
        default: 100_000,
        env: 'SERVICE_ARCHIVE_TIMEOUT',
        arg: 'service-archive-timeout',
      },
    },
    lfCloser: {
      name: {
        doc: 'Service name of Laserfiche closer service',
        default: 'lfCloser',
        env: 'SERVICE_LFCLOSER_NAME',
        arg: 'service-lfcloser-name',
      },
      timeout: {
        doc: 'Time limit on waiting for lf-sync to file ticket',
        format: Number,
        default: 7 * 24 * 60 * 60 * 1000,
        env: 'SERVICE_LFCLOSER_TIMEOUT',
        arg: 'service-lfcloser-timeout',
      },
      pathFieldId: {
        doc: 'Zendesk custom field ID for"Laserfiche Path"',
        format: Number,
        default: -1,
        env: 'SERVICE_LFCLOSER_PATH_FIELD_ID',
        arg: 'service-lfcloser-path-field-id',
      },
      lfIdFieldId: {
        doc: 'Zendesk custom field ID for "Laserfiche Entity ID"',
        format: Number,
        default: -1,
        env: 'SERVICE_LFCLOSER_ENTITY_ID_FIELD_ID',
        arg: 'service-lfcloser-entity-id-field-id',
      },
    },
  },
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
    concurrency: {
      doc: 'Concurrency limit for processing tickets',
      format: Number,
      default: 5,
      env: 'SERVICE_ARCHIVE_CONCURRENCY',
      arg: 'service-archive-concurrency',
    },
    domain: {
      doc: 'Zendesk API domain',
      format: String,
      default: '',
      env: 'ZD_DOMAIN',
      arg: 'zd-domain',
    },
    username: {
      doc: 'Zendesk username email',
      format: String,
      default: '',
      env: 'ZD_USERNAME',
      arg: 'zd-username',
    },
    password: {
      doc: 'Zendesk token/password',
      format: String,
      default: '',
      env: 'ZD_PASS',
      arg: 'zd-pass',
    },
    api_limit: {
      doc: 'Zendesk API per interval rate limit',
      format: Number,
      default: 700,
      env: 'ZD_API_LIMIT',
      arg: 'zd-api-limit',
    },
    api_limit_interval: {
      doc: 'Zendesk API limit interval',
      format: Number,
      default: 60 * 1000, // 1 minute
      env: 'ZD_API_LIMIT_INTERVAL',
      arg: 'zd-api-limit-interval',
    },
    fields: {
      state: {
        doc: 'Zendesk ID for custom field "Trellis Automation State"',
        format: Number,
        default: -1,
        env: 'ZD_FIELDS_STATE_ID',
        arg: 'zd-fields-state-id',
      },
      status: {
        doc: 'Zendesk ID for custom field "Trellis Automation Status"',
        format: Number,
        default: -1,
        env: 'ZD_FIELDS_STATUS_ID',
        arg: 'zd-fields-status-id',
      },
      SAPId: {
        doc: 'Name of the Zendesk field which stores the trading partner SAP ID',
        default: -1,
        env: 'ZD_FIELDS_SAP_ID',
        arg: 'zd-sap-id',
      },
      organization: {
        doc: 'Zendesk field ID for cataloged organization',
        default: -1,
        format: Number,
        env: 'ZD_FIELDS_ORG_ID',
        arg: 'zd-org-field-id',
      },
    },
    default_org: {
      doc: 'Zendesk Organziation ID to use when no organziation was cataloged',
      default: -1,
      format: Number,
      env: 'ZD_DEFAULT_ORG_ID',
      arg: 'zd-default-org-id',
    },
  },
});