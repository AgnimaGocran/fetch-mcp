FROM oven/bun AS build

WORKDIR /app

# Cache packages installation
COPY package.json package.json
COPY bun.lock bun.lock
COPY tsconfig.json tsconfig.json

RUN bun install

COPY ./src ./src

ENV NODE_ENV=production

RUN bun build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--target bun \
	--outfile fetch-server \
	src/index.ts

FROM oven/bun

WORKDIR /app

COPY --from=build /app/fetch-server fetch-server
RUN mkdir -p /app/node_modules/jsdom/lib/jsdom/browser /app/node_modules/jsdom/lib/jsdom/living/xhr
COPY --from=build /app/node_modules/jsdom/lib/jsdom/browser/default-stylesheet.css /app/node_modules/jsdom/lib/jsdom/browser/default-stylesheet.css
COPY --from=build /app/node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js /app/node_modules/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js

ENV NODE_ENV=production

CMD ["./fetch-server"]