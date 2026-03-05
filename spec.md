# eleventy-plugin-mdlite spec

This plugin makes the raw markdown source of an Eleventy site available
alongside the rendered HTML output, and builds a SQLite database that
indexes every page for full-text search.

It is designed for Eleventy 3.x sites using Nunjucks as the markdown
template engine.

## Stories

### Markdown files appear in the output directory

As a site author, when I build my Eleventy site, every markdown page
that produces output gets a corresponding .md file in the output
directory at a clean URL path. A page whose URL is /docs/foo/ produces
\_site/docs/foo.md. A page at / produces \_site/index.md.

The output file contains the page's markdown source with the YAML
frontmatter block removed. The opening --- and closing --- delimiters
and everything between them are stripped.

### Template variables are expanded

As a site author, Nunjucks variable tags in my markdown (like
{{ snippet }} or {{ docsub.contact_us }}) are replaced with their
actual values from the page's data cascade before the file is written.

### Filters are applied

As a site author, Nunjucks filters registered with Eleventy (via
addFilter) work in the markdown output. An expression like
{{ collections.all | foo }} resolves using the real filter function
and the page's data. Filters with parenthesized arguments like
{{ value | list_nav_children("Home") | safe }} also work correctly.

### Includes are expanded

As a site author, {% include %} tags in my markdown are resolved using
files from the Eleventy includes directory. The included file's content
replaces the tag in the output.

### Unpaired shortcodes are executed

As a site author, Eleventy shortcodes registered with addShortcode are
called with their arguments and their return value is inserted into the
output. For example, {% pic "/image.png" %} produces <img src="/image.png">.

### Paired shortcodes are passed through

As a site author, Eleventy paired shortcodes registered with
addPairedShortcode are preserved as-is in the markdown output. The
opening tag, body content, and closing tag all remain intact. For
example, {% highlight "js" %}const x = 1;{% endhighlight %} appears
verbatim in the output file rather than being executed.

### Extra syntax is preserved

As a site author, unrecognized syntax is preserved and passed through to the output. Examples include:

- markdown container directive syntax (:::note, :::warning, :::tip, etc.)
- inline HTML elements like <kbd>Ctrl</kbd>
- attribute syntax like {.purple} or {id="section-anchor"}

### Empty pages are skipped

As a site author, if a markdown page has no content after the frontmatter
is stripped (the body is blank or whitespace-only), no .md file is written
to the output directory and no row is inserted into the database.

### A SQLite database is generated

As a site author, when the build completes a SQLite database file is
created in the output directory. By default it is named sqlite.db and
placed at the output root. The database contains a pages table with
columns: path, title, and content.

### Page metadata is stored

As a site author, each page's URL is stored in the path column. The
title from frontmatter is stored in the title column (null when absent).

### Database content matches the markdown output

As a site author, the content column in the database contains the same
processed markdown that is written to the .md output file -- frontmatter
stripped, template variables expanded, includes resolved, unpaired
shortcodes executed, and paired shortcodes passed through.

### Full-text search works

As a site author, the database includes a pages_fts FTS5 virtual table
that indexes the title and content columns. I can run MATCH queries
against it. The FTS index uses the unicode61 tokenizer for Unicode-aware
word segmentation and case-insensitive matching.

### The header option prepends text to output files

As a site author, I can pass a header string in the plugin options. When
set, that string is prepended to every output .md file, followed by a
blank line, then the page content. The header does not appear in the
database content column.

### The pathPrefix option scopes the plugin

As a site author, I can pass a pathPrefix option (like "docs" or "/docs")
to restrict the plugin to pages whose URL starts with that prefix. Only
matching pages get .md output files and database rows. The SQLite
database is placed inside the prefixed subdirectory (e.g. \_site/docs/sqlite.db) rather than the output root.

The prefix is normalized so that "docs", "/docs", and "/docs/" all
behave identically, matching URLs that start with /docs/.

### The dbFilename option controls the database name

As a site author, I can pass a dbFilename option to change the name of
the generated SQLite file from the default sqlite.db to something else.

### The database is rebuilt on every build

As a site author, each build deletes any existing database file at the
target path and creates a fresh one. The FTS index is optimized and the
database is vacuumed before closing.
