# Fetch MCP Server

![fetch mcp logo](logo.jpg)

[![npm version](https://img.shields.io/npm/v/mcp-fetch-server.svg)](https://www.npmjs.com/package/mcp-fetch-server)

An MCP server for fetching web content in multiple formats — HTML, JSON, plain text, Markdown, readable article content, and YouTube transcripts.

<a href="https://glama.ai/mcp/servers/nu09wf23ao">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/nu09wf23ao/badge" alt="Fetch Server MCP server" />
</a>

## Recent Changes

- **Migrated to MCP SDK v2** - Upgraded from `@modelcontextprotocol/sdk` to `@modelcontextprotocol/server@2.0.0-alpha.2` using the new `McpServer` class and `registerTool` API
- **Fully migrated to Bun** - Project now uses Bun as the runtime, package manager, test runner, and bundler (completely replacing Node.js/npm)
- **Code refactoring** - Removed `.js` extensions from imports throughout the codebase for cleaner TypeScript
- **Zod v4 migration** - Updated to use `z.url()` instead of deprecated `z.string().url()`
- **Docker build improvements** - Fixed Docker build with `--compile` flag and proper JSDOM runtime dependencies

## Tools

All tools accept the following common parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes | URL to fetch |
| `headers` | object | No | Custom headers to include in the request |
| `max_length` | number | No | Maximum characters to return (default: 5000) |
| `start_index` | number | No | Start from this character index (default: 0) |
| `proxy` | string | No | Proxy URL (e.g. `http://proxy:8080`) |

- **fetch_html** — Fetch a website and return its raw HTML content.

- **fetch_markdown** — Fetch a website and return its content converted to Markdown.

- **fetch_txt** — Fetch a website and return plain text with HTML tags, scripts, and styles removed.

- **fetch_json** — Fetch a URL and return the JSON response.

- **fetch_readable** — Fetch a website and extract the main article content using [Mozilla Readability](https://github.com/mozilla/readability), returned as Markdown. Strips navigation, ads, and boilerplate. Ideal for articles and blog posts.

- **fetch_youtube_transcript** — Fetch a YouTube video's captions/transcript. Uses `yt-dlp` if available, otherwise extracts directly from the page. Accepts an additional `lang` parameter (default: `"en"`) to select the caption language.

## Installation

### As an MCP server

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "fetch-http": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "mcp/fetch-http"
      ]
    }
  }
}
```

## Features

- Fetch web content as HTML, JSON, plain text, or Markdown
- Extract article content with Mozilla Readability (strips ads, nav, boilerplate)
- Extract YouTube video transcripts (via `yt-dlp` or direct extraction)
- Proxy support for requests behind firewalls
- Pagination with `max_length` and `start_index`
- Custom request headers
- SSRF protection (blocks private/localhost addresses and DNS rebinding)
- Response size limits to prevent memory exhaustion

## Development

```bash
bun install
bun run dev     # start with watch mode
bun test        # run tests
bun run build   # build for production
```

## License

This project is licensed under the MIT License.
