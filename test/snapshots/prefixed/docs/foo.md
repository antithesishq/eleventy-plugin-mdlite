# Foo

This is the foo page with some **bold** text and *italic* words.

## Installation

You can install the package using `npm install mdlite` from the terminal.

Here is a fenced code block:

```javascript
const plugin = require("mdlite");
module.exports = function(config) {
  config.addPlugin(plugin);
};
```

## Features

- Supports **full-text search** via SQLite
- Strips _frontmatter_ automatically
- Handles [links](https://example.com) and ![images](logo.png "Logo")

1. First ordered item
2. Second ordered item
3. Third ordered item

> This is a blockquote with **nested bold** and a [link](https://example.com).

## Advanced Usage

Here is some ***bold italic*** text and inline `code spans` everywhere.

The word kaleidoscope appears here as a unique needle for search testing.

---

Check the [documentation](https://example.com/docs) for more details.
