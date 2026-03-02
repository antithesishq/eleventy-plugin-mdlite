# eleventy-plugin-mdlite

Eleventy plugin that copies raw markdown files to your output directory and generates a SQLite index of all pages.

## Features

- **Raw markdown output** — copies your `.md` source files alongside the rendered HTML so they're accessible at clean URLs (e.g. `/docs/foo.md`)
- **SQLite index** — generates a `sqlite.db` with FTS5 full-text search containing every page's URL, title, tags, and content

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

| Option       | Default       | Description                                                                  |
| ------------ | ------------- | ---------------------------------------------------------------------------- |
| `dbFilename` | `"sqlite.db"` | Name of the SQLite database file written to the output directory             |
| `pathPrefix` | `"/"`         | Only index pages whose URL starts with this prefix; database is placed there |

```js
eleventyConfig.addPlugin(mdlitePlugin, {
  dbFilename: "index.db",
  pathPrefix: "/docs",
});
```

## SQLite Schema

The generated database contains a `pages` table and a `pages_fts` FTS5 virtual table for full-text search:

| Column    | Type               | Description                  |
| --------- | ------------------ | ---------------------------- |
| `path`    | `TEXT PRIMARY KEY`  | Page URL (e.g. `/docs/foo/`) |
| `title`   | `TEXT`              | Title from frontmatter       |
| `tags`    | `TEXT`              | JSON array of tags, or null  |
| `content` | `TEXT NOT NULL`     | Raw markdown source          |

## Requirements

- Eleventy 3.x (`@11ty/eleventy ^3.0.0`)
- Node.js with ESM support

## License

ISC
