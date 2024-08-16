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

COPY ./.yarn ${DIR}.yarn
COPY ./package.json ./yarn.lock ./.yarnrc.yml ${DIR}

RUN chown -R node:node ${DIR}
USER node

RUN yarn workspaces focus --all --production

ENTRYPOINT ["/usr/bin/dumb-init", "--rewrite", "15:2", "--", "yarn", "run"]
CMD ["start"]

FROM base as build
ARG DIR

# Install dev deps too
RUN yarn install --immutable

COPY . ${DIR}

# build code
RUN yarn build --verbose


FROM base as production
ARG DIR

COPY --from=build ${DIR}/dist ${DIR}/dist



#
#
#
# RUN yarn workspaces focus --all --production
#
# FROM install AS build
# ARG DIR
#
# # Install dev deps too
# RUN yarn install --immutable
#
# COPY . ${DIR}
#
# # Build code and remove dev deps
# RUN yarn build --verbose && rm -rfv .yarn .pnp*
#
# FROM node:$NODE_VER AS production
# ARG DIR
#
# # Install needed packages
# RUN apk add --no-cache \
#   dumb-init \
#   chromium \
#   nss \
#   freetype \
#   harfbuzz \
#   ca-certificates \
#   ttf-freefont
#
# ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
#
# # Do not run service as root
# USER node
#
# WORKDIR ${DIR}
#
# COPY --from=install ${DIR} ${DIR}
# COPY --from=build ${DIR} ${DIR}
#
# # Launch entrypoint with dumb-init
# # Remap SIGTERM to SIGINT https://github.com/Yelp/dumb-init#signal-rewriting
# ENTRYPOINT ["/usr/bin/dumb-init", "--rewrite", "15:2", "--", "yarn", "run"]
# CMD ["start"]