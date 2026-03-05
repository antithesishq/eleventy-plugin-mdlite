# Changelog

## 0.3.0 2026-03-05

- Removed porter stemming from FTS index
- Switch template processing from Liquid to Nunjucks
- Expand Nunjucks variables, filters, and includes in markdown output
- Execute unpaired shortcodes and pass through paired shortcodes
- Skip empty pages when building the search index
- Configure BM25 ranking weights for full-text search
- Optimize FTS index before closing the database
- Remove full-text search prefix matching
- Remove `tags` column from pages table
- Add `spec.md`
- Add snapshot tests

## 0.2.0 2026-03-03

- Add GitHub Actions CI
- Strip frontmatter from markdown output files
- Add configurable `header` option for markdown files

## 0.1.0 2026-03-02

- Initial release
- Add configurable `pathPrefix` option to scope indexed pages
- Add SQLite FTS5 full-text search index
- Add SQLite query documentation
- Copy raw markdown files to output directory
