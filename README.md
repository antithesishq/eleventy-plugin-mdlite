# eleventy-plugin-mdlite

Eleventy plugin that copies raw markdown files to your output directory and generates a SQLite index of all pages.

## Features

- **Raw markdown output** — copies your `.md` source files alongside the rendered HTML so they're accessible at clean URLs (e.g. `/docs/foo.md`)
- **Frontmatter stripping** — YAML frontmatter is automatically removed from output files and database content
- **Template processing** — Nunjucks variables, filters, and includes are expanded in the output; unpaired shortcodes are executed; paired shortcodes are passed through as-is
- **Custom header injection** — optionally prepend a header (e.g. a comment or license notice) to each output markdown file
- **SQLite index** — generates a `sqlite.db` with FTS5 full-text search containing every page's URL, title, and content

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
| `header`     | `""`          | String prepended to each output markdown file (e.g. a comment or notice)     |

```js
eleventyConfig.addPlugin(mdlitePlugin, {
  dbFilename: "index.db",
  pathPrefix: "/docs",
  header: "<!-- This file was generated automatically. Do not edit. -->",
});
```

## SQLite Schema

The generated database contains a `pages` table and a `pages_fts` FTS5 virtual table for full-text search:

| Column    | Type               | Description                            |
| --------- | ------------------ | -------------------------------------- |
| `path`    | `TEXT PRIMARY KEY` | Page URL (e.g. `/docs/foo/`)           |
| `title`   | `TEXT`             | Title from frontmatter                 |
| `content` | `TEXT NOT NULL`    | Markdown source (frontmatter stripped) |

## Example Queries

Open the generated database with the `sqlite3` CLI or any SQLite client:

```sh
sqlite3 _site/sqlite.db
```

**Full-text search** — find pages matching a term (results ranked by relevance):

```sql
SELECT p.path, p.title, f.rank
FROM pages_fts f
JOIN pages p ON p.rowid = f.rowid
WHERE pages_fts MATCH 'deploy'
ORDER BY f.rank;
```

**Phrase search** — match an exact phrase:

```sql
SELECT p.path, p.title
FROM pages_fts f
JOIN pages p ON p.rowid = f.rowid
WHERE pages_fts MATCH '"getting started"';
```

**Boolean operators** — combine terms with AND, OR, NOT:

```sql
SELECT p.path, p.title
FROM pages_fts f
JOIN pages p ON p.rowid = f.rowid
WHERE pages_fts MATCH 'api AND authentication NOT deprecated';
```

**Search within a specific column** — restrict matches to titles only:

```sql
SELECT p.path, p.title
FROM pages_fts f
JOIN pages p ON p.rowid = f.rowid
WHERE pages_fts MATCH 'title:setup';
```

**Snippet extraction** — return a highlighted excerpt around the matching term:

```sql
SELECT p.path, snippet(pages_fts, 1, '<b>', '</b>', '...', 20) AS excerpt
FROM pages_fts f
JOIN pages p ON p.rowid = f.rowid
WHERE pages_fts MATCH 'install';
```

> The FTS5 index uses the `porter` tokenizer (stemming) and `unicode61`, so a search for `"installs"` will also match `"install"`, `"installed"`, etc.

## Limitations

This plugin has only been tested with Nunjucks, Eleventy's default template language. Other template engines (Liquid, Handlebars, etc.) may not work correctly.

## Requirements

- Eleventy 3.x (`@11ty/eleventy ^3.0.0`)
- Node.js with ESM support
