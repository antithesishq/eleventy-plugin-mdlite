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
| `path`    | `TEXT PRIMARY KEY` | Page URL (e.g. `/docs/foo/`) |
| `title`   | `TEXT`             | Title from frontmatter       |
| `tags`    | `TEXT`             | JSON array of tags, or null  |
| `content` | `TEXT NOT NULL`    | Raw markdown source          |

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

**Prefix search** — match words starting with a prefix (enabled for 2- and 3-character prefixes):

```sql
SELECT p.path, p.title
FROM pages_fts f
JOIN pages p ON p.rowid = f.rowid
WHERE pages_fts MATCH 'conf*';
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

**Filter by tag** — find pages with a specific tag (tags are stored as JSON arrays):

```sql
SELECT path, title
FROM pages
WHERE tags LIKE '%"guide"%';
```

**Snippet extraction** — return a highlighted excerpt around the matching term:

```sql
SELECT p.path, snippet(pages_fts, 1, '<b>', '</b>', '...', 20) AS excerpt
FROM pages_fts f
JOIN pages p ON p.rowid = f.rowid
WHERE pages_fts MATCH 'install';
```

> The FTS5 index uses the `porter` tokenizer (stemming) and `unicode61`, so a search for `"installs"` will also match `"install"`, `"installed"`, etc.

## Requirements

- Eleventy 3.x (`@11ty/eleventy ^3.0.0`)
- Node.js with ESM support
