# eleventy-plugin-mdlite

Eleventy plugin that copies raw markdown files to your output directory and generates a SQLite index of all pages.

## Features

- **Raw markdown output** — copies your `.md` source files alongside the rendered HTML so they're accessible at clean URLs (e.g. `/docs/foo.md`)
- **SQLite index** — generates a `sqlite.db` (+ gzipped copy) containing every page's URL, title, date, content, and frontmatter

## Installation

```sh
npm install eleventy-plugin-mdlite
```

## Usage

In your Eleventy config file (e.g. `eleventy.config.js`):

```js
import mdlitePlugin from "eleventy-plugin-mdlite";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(mdlitePlugin);
}
```

### Options

| Option       | Default       | Description                                                      |
| ------------ | ------------- | ---------------------------------------------------------------- |
| `dbFilename` | `"sqlite.db"` | Name of the SQLite database file written to the output directory |

```js
eleventyConfig.addPlugin(mdlitePlugin, {
  dbFilename: "index.db",
});
```

## SQLite Schema

The generated database contains a single `pages` table:

| Column        | Type               | Description                                               |
| ------------- | ------------------ | --------------------------------------------------------- |
| `url`         | `TEXT PRIMARY KEY` | Page URL (e.g. `/docs/foo/`)                              |
| `title`       | `TEXT`             | Title from frontmatter                                    |
| `date`        | `TEXT`             | ISO 8601 date string                                      |
| `content`     | `TEXT NOT NULL`    | Markdown body (frontmatter stripped)                      |
| `frontmatter` | `TEXT NOT NULL`    | JSON-encoded frontmatter (Eleventy internal keys removed) |

## Requirements

- Eleventy 3.x (`@11ty/eleventy ^3.0.0`)
- Node.js with ESM support

## License

ISC
