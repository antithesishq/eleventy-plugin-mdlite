import mdlitePlugin from "../../index.js";

export default function (eleventyConfig) {
  eleventyConfig.addPairedShortcode("highlight", (content, lang) => {
    return `<pre><code class="${lang}">${content}</code></pre>`;
  });
  eleventyConfig.addPairedShortcode("tabs", (content) => {
    return `<div class="tabs">${content}</div>`;
  });
  eleventyConfig.addShortcode("pic", (src) => `<img src="${src}">`);
  eleventyConfig.addFilter("fake_filter", (value) => value);
  eleventyConfig.addFilter("list_nav_children", (collection, parentKey) => {
    return `<ul><li>${parentKey}</li></ul>`;
  });
  eleventyConfig.addPlugin(mdlitePlugin);

  return { markdownTemplateEngine: "njk" };
}
