# Switch template engine from Liquid to Nunjucks

## Background

The Antithesis docs site sets `markdownTemplateEngine: "njk"` in its Eleventy
config. All `.md` files are processed through Nunjucks, not Liquid. The `{{ }}`
expressions with `filter("arg")` syntax (parenthesized arguments) are native
Nunjucks — LiquidJS uses `filter: arg` (colon syntax) and throws a parse error
on the parenthesized form. This is the root cause of the full-page fallback
that left template expressions unresolved across 16+ pages in the production
docs.db.

Switching to Nunjucks resolves all high-priority issues in one shot:
- `{{ docsub.contact_us }}` will resolve (data is available)
- `{% include "file.md" %}` will work (Nunjucks `include` with FileSystemLoader)
- `{{ x | filter("arg") }}` will parse (native Nunjucks syntax)
- Unknown filters/tags can be handled gracefully

Reference files from the Antithesis website source are in `tasks/sample/`.

## Current state

Test fixtures have already been updated to use Nunjucks syntax:

- All three `eleventy.config.*.js` files now return
  `{ markdownTemplateEngine: "njk" }` and register a `tabs` paired shortcode
  and `list_nav_children` filter
- `index.md` uses Nunjucks syntax: `{{ collections.all | list_nav_children("Home") | safe }}`,
  `{% highlight "js" %}`, `{% tabs %}...{% endtabs %}`
- New `docs/sdk-page.md` mirrors real SDK pages: `{{ docsub.* }}` variables,
  `{% include %}`, `:::` containers, `{id="..."}` attribute syntax,
  `list_nav_children` filter call at the bottom
- `_data/docsub.js` expanded with link markup matching real site patterns

**Tests currently fail** with `expected ":" after filter name` — the exact
parse error this task fixes. Running the tests after completing the switch
should produce passing results.

## Changes to index.js

### 1. Replace liquidjs dependency with nunjucks

```
- import { Liquid, Tag } from "liquidjs";
+ import nunjucks from "nunjucks";
```

Update `package.json`: replace `liquidjs` with `nunjucks` (already available as
a transitive dep of `@11ty/eleventy`, version 3.2.4).

### 2. Remove PassthroughTag class and Proxy

Delete the `PassthroughTag` class (lines 37-42) and the `Proxy` on
`liquid.tags` (lines 80-88). These are Liquid-specific and no longer needed.

### 3. Replace Liquid engine setup with Nunjucks Environment

Current code (lines 74-95):
```js
const liquid = new Liquid({
    root: [includesDir],
    strictFilters: false,
    strictVariables: false,
});
liquid.tags = new Proxy(liquid.tags, { ... });
for (const name of Object.keys(eleventyConfig.getPairedShortcodes())) { ... }
for (const name of Object.keys(eleventyConfig.getShortcodes())) { ... }
```

Replace with:
```js
const loader = new nunjucks.FileSystemLoader(includesDir);
const env = new nunjucks.Environment(loader, {
    throwOnUndefined: false,
    autoescape: false,  // output is markdown, not HTML
});
```

### 4. Register passthrough extensions for shortcodes

Nunjucks throws on unknown tags. Register passthrough extensions for all
shortcodes registered in the Eleventy config.

For **paired** shortcodes (`md`, `with_aside`, `notebook_example`, `tabs`,
`expander`):
```js
for (const name of Object.keys(eleventyConfig.getPairedShortcodes())) {
    env.addExtension(name, {
        tags: [name],
        parse(parser, nodes) {
            const tok = parser.nextToken();
            const args = parser.parseSignature(null, true);
            parser.advanceAfterBlockEnd(tok.value);
            const body = parser.parseUntilBlocks("end" + name);
            parser.advanceAfterBlockEnd();
            return new nodes.CallExtension(this, "run", args, [body]);
        },
        run() {
            return "";
        },
    });
}
```

For **single** shortcodes (`wistia_player`, `pic`, `youtube`, etc.):
```js
for (const name of Object.keys(eleventyConfig.getShortcodes())) {
    env.addExtension(name, {
        tags: [name],
        parse(parser, nodes) {
            const tok = parser.nextToken();
            const args = parser.parseSignature(null, true);
            parser.advanceAfterBlockEnd(tok.value);
            return new nodes.CallExtension(this, "run", args);
        },
        run() {
            return "";
        },
    });
}
```

### 5. Register fallback filters

Nunjucks throws on unknown filters (`filter not found: X`). Use
`eleventyConfig.getFilters()` to enumerate all registered filters and add
no-op (identity) versions on the Nunjucks env:

```js
for (const name of Object.keys(eleventyConfig.getFilters())) {
    env.addFilter(name, (val) => val);
}
```

This is safe because `autoescape: false` means pass-through filters just
forward the value. `safe` is already a Nunjucks built-in and doesn't need
registration.

Filters like `list_nav_children` that receive complex collection objects will
produce `[object Object]` output — this is handled by the post-render
cleanup (step 7).

### 6. Replace parseAndRender call

Current:
```js
content = await liquid.parseAndRender(stripped, data);
```

Replace with:
```js
content = env.renderString(stripped, data);
```

Note: `nunjucks.renderString` is synchronous. No `await` needed.

### 7. Post-render cleanup (strip residual template artifacts)

Even with Nunjucks resolving most expressions, some will produce garbage
output (e.g., `list_nav_children` receiving the full collection and returning
`[object Object]`). Add a post-render pass:

```js
// Strip lines that are just "[object Object]" or similar
content = content.replace(/^\[object Object\].*$/gm, "");
// Strip any remaining raw {{ }} or {% %} (from render errors in includes, etc.)
// Only outside of code fences
```

This is a belt-and-suspenders measure — most expressions should now resolve
cleanly.

## Expected results after switch

| Issue | Before (Liquid) | After (Nunjucks) |
|---|---|---|
| `{{ docsub.contact_us }}` | Raw text (fallback) | `[Contact us](/contact/)` |
| `{% include 'file.md' %}` | Raw text (fallback) | File content inlined |
| `{{ x \| filter("arg") }}` | Parse error → fallback | Parsed correctly |
| `{% md %}...{% endmd %}` | PassthroughTag → "" | Extension → "" |
| `{{ x \| list_nav_children("Y") }}` | Parse error | Passthrough → needs strip |

## Testing

After making the changes to `index.js`:

1. Run `UPDATE_SNAPSHOTS=1 node --test test/snapshot.test.js` to regenerate
   snapshots with the new Nunjucks output
2. Verify snapshot content is correct:
   - `docsub.*` values resolve to markdown links in `sdk-page.md`
   - `shared_content.md` content appears inlined via `{% include %}`
   - Shortcodes (`highlight`, `tabs`, `pic`) produce empty output
   - Code fences with `{{ }}` syntax are preserved (via `{% raw %}`)
   - `:::note`/`:::tip` containers pass through unchanged (markdown, not template)
   - `{id="..."}` attribute syntax passes through unchanged
   - Unknown variables render as empty string (not raw expression)
3. Run `node --test test/snapshot.test.js` to confirm tests pass
4. Run against the Antithesis docs site and verify improvements in docs.db
