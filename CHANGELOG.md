# Changelog

## Unreleased

- Strip markdown formatting from FTS index for better search quality
- Skip empty pages when building the search index
- Remove full text search prefixing

## 0.2.0 2026-03-03

- Add GitHub Actions CI
- Strip frontmatter from markdown output files
- Add configurable `header` option for markdown files

## 0.1.0 2026-03-02

- Initial release
- Add configurable `pathPrefix` option to scope indexed pages
- Add SQLite FTS5 full-text search index with porter stemming
- Add SQLite query documentation
- Copy raw markdown files to output directory
