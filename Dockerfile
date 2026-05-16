FROM oven/bun AS build

WORKDIR /app

# Cache packages installation
COPY package.json package.json
COPY bun.lock bun.lock

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

FROM gcr.io/distroless/base

WORKDIR /app

COPY --from=build /app/fetch-server fetch-server
COPY --from=build /app/node_modules/jsdom/lib/jsdom/browser/default-stylesheet.css default-stylesheet.css

ENV NODE_ENV=production

CMD ["./fetch-server"]