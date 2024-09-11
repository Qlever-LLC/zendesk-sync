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

import type { Tree } from '@oada/types/oada/tree/v1.js';

/**
 * List to check/watch for a trading-partner's document types
 */
export const DOCS_LIST = '/bookmarks/trellisfw/documents';

export const docTypesTree: Tree = {
  bookmarks: {
    _type: 'application/vnd.oada.bookmarks.1+json',
    trellisfw: {
      _type: 'application/vnd.oada.trellisfw.1+json',
      documents: {
        _type: 'application/vnd.oada.trellisfw.documentType.1+json',
        tickets: {
          '_type': 'application/vnd.oada.trellisfw.documents.1+json',
          '*': {
            _type: 'application/vnd.oada.trellisfw.documents.1+json',
            _meta: {
              vdoc: {
                pdf: {
                  '*': {
                    _type: 'application/pdf',
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export const tpDocTypesTree: Tree = {
  bookmarks: {
    _type: 'application/vnd.oada.bookmarks.1+json',
    _rev: 0,
    trellisfw: {
      '_type': 'application/vnd.oada.trellisfw.1+json',
      '_rev': 0,
      'trading-partners': {
        '_type': 'application/vnd.oada.trellisfw.trading-partners.1+json',
        '*': {
          _type: 'application/vnd.oada.trellisfw.trading-partner.1+json',
          ...docTypesTree,
        },
      },
    },
  },
  resources: {
    '_type': 'application/vnd.oada.trellisfw.trading-partners.1+json',
    '*': {
      _type: 'application/vnd.oada.trellisfw.trading-partner.1+json',
      ...docTypesTree,
    },
  },
};
