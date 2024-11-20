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
  ca-certificates \
  chromium \
  dumb-init \
  freetype \
  harfbuzz \
  nss \
  ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR ${DIR}

RUN corepack yarn set version berry

COPY ./package.json ./yarn.lock ./.yarnrc.yml ${DIR}/
COPY ./template/package.json ${DIR}/template/
COPY ./service/package.json ${DIR}/service/

RUN chown -R node:node ${DIR} \
  && corepack yarn workspaces focus --all --production

ENTRYPOINT ["/usr/bin/dumb-init", "--rewrite", "15:2", "--", "corepack", "yarn", "workspace", "@qlever-llc/zendesk-sync", "run"]
CMD ["start"]

###
## Install and build Svelte template
###
FROM base AS build-template
ARG DIR

WORKDIR ${DIR}/template/

RUN corepack yarn install --immutable

COPY ./template ${DIR}/template
RUN corepack yarn build

###
## Install and build node service
###
FROM base AS build-service
ARG DIR

WORKDIR ${DIR}/service/

# Install dev deps too
RUN corepack yarn install --immutable

COPY ./service ${DIR}/service

# build code
RUN corepack yarn build --verbose

###
## Final
###
FROM base AS production
ARG DIR

WORKDIR ${DIR}/service
USER node

COPY --from=build-service ${DIR}/service/dist ${DIR}/service/dist
COPY --from=build-template ${DIR}/template/dist ${DIR}/service/dist-template