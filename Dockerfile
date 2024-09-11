# Copyright 2022 Qlever LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

ARG NODE_VER=22-alpine
ARG DIR=/usr/src/app/

###
## Image base
###
FROM node:$NODE_VER AS base
ARG DIR

# Install needed packages
RUN apk add --no-cache \
  dumb-init \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR ${DIR}

COPY ./service/.yarn ${DIR}.yarn
COPY ./service/package.json ./service/yarn.lock ./service/.yarnrc.yml ${DIR}

RUN chown -R node:node ${DIR}
USER node

RUN yarn workspaces focus --all --production

ENTRYPOINT ["/usr/bin/dumb-init", "--rewrite", "15:2", "--", "yarn", "run"]
CMD ["start"]

###
## Install and build Svelte template
###
FROM node:$NODE_VER AS buildTemplate
ARG DIR

WORKDIR ${DIR}

COPY ./template/.yarn ${DIR}.yarn
COPY ./template/package.json ./template/yarn.lock ./template/.yarnrc.yml ${DIR}

RUN yarn install --immutable

COPY ./template/. ${DIR}
RUN yarn build

###
## Install and build node service
###
FROM base as build
ARG DIR

# Install dev deps too
RUN yarn install --immutable

COPY ./service/. ${DIR}

# build code
RUN yarn build --verbose

###
## Final
###
FROM base as production
ARG DIR

COPY --from=build ${DIR}/dist ${DIR}/dist
COPY --from=buildTemplate ${DIR}/dist ${DIR}/dist-template
