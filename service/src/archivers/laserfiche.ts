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

import type JobSchema from '@oada/types/oada/service/job.js';
import { type Logger } from '@oada/pino-debug';
import { type OADAClient } from '@oada/client';
import { type Ticket } from '../types.js';
import { config } from '../config.js';
import { doJob } from '@oada/client/jobs';
import { setCustomField } from '../zd/zendesk.js';

interface LFSyncDocJob extends JobSchema {
  service: 'lf-sync';
  type: 'sync-doc';
  config: {
    doc: { _id: string };
    tradingPartner: string;
  };
}

type LFSyncDocJobResult = Record<
  string,
  {
    EntryId: number;
    Path: string;
    Name: string;
  }
>;

const PATH_FIELD_ID = config.get('service.archivers.laserfiche.pathFieldId');
const LF_ID_FIELD_ID = config.get('service.archivers.laserfiche.lfIdFieldId');

export async function doLfSync(
  log: Logger,
  oada: OADAClient,
  ticket: Ticket,
  doc: { trellisId: string; tradingPartner: string },
) {
  const syncJob: LFSyncDocJob = {
    service: 'lf-sync',
    type: 'sync-doc',
    config: {
      doc: { _id: doc.trellisId },
      tradingPartner: doc.tradingPartner,
    },
  };

  // FIXME: doJob really should take a generic for the job type response or something
  const { result: entities } = (await doJob(oada, syncJob)) as unknown as {
    result: LFSyncDocJobResult;
  };

  const lfId = entities.email_archive?.EntryId;
  if (!lfId) {
    log.error('No Laserfiche ID for ticket PDF?');
    throw new Error('Could not determine Laserfiche ID for ticket PDF?');
  }

  const path = entities.email_archive?.Path.split('\\').slice(0, -1).join('\\');
  if (!path) {
    log.error('No Laserfiche path for ticket PDF?');
    throw new Error('Could not determine Laserfiche path for ticket folder?');
  }

  log.debug('Ticket is in LF. Updating Zendesk state');

  if (ticket.status !== 'closed') {
    if (PATH_FIELD_ID > 0) {
      log.trace('Add LF path meta data back to Zendesk');
      await setCustomField(log, ticket, [{ id: PATH_FIELD_ID, value: path }]);
    }

    if (LF_ID_FIELD_ID > 0) {
      log.trace('Add LF ID meta data back to Zendesk');
      await setCustomField(log, ticket, [{ id: LF_ID_FIELD_ID, value: lfId }]);
    }
  }
}