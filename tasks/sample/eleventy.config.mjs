import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import Image from '@11ty/eleventy-img';
import xmlFiltersPlugin from 'eleventy-xml-plugin';
import searchPlugin from './_scripts/search/eleventy-search-plugin/index.mjs';
import markdownIt from 'markdown-it';
import markdownItAttrs from 'markdown-it-attrs';
import markdownItContainer from 'markdown-it-container';
import mathjax3 from 'markdown-it-mathjax3';
import markdownItAnchor from 'markdown-it-anchor';
import markdownItDeflist from 'markdown-it-deflist';
import pluginTOC from 'eleventy-plugin-nesting-toc';
import eleventyNavigationPlugin from '@11ty/eleventy-navigation';
import { DateTime } from 'luxon';
import { buildSync } from 'esbuild';
import { createHighlighter } from 'shiki';
import { transformerNotationDiff, transformerNotationHighlight, transformerNotationErrorLevel  } from '@shikijs/transformers';
import slugify from 'slugify';
import tokyoNight from 'shiki/dist/themes/tokyo-night.mjs';
import markdownItDtAnchor from './_scripts/libs/markdownItDtAnchor.mjs';
import mdlitePlugin from 'eleventy-plugin-mdlite';

// getting absolute output dir, since it is different depending on what build we do
// eleventy doesn't provide it
const outDir = process.argv?.find(it => it?.startsWith('--output'))?.split("output=")[1]
if (!outDir) console.error("Couldn't get out dir for eleventy")
// input dir can be extracted as process.env.ELEVENTY_ROOT:   /home/vlad/src/star/infrastructure/website/v2
console.log('outDir=', outDir );

const getFileChecksum = (directory) => (filename) => {
    const filePath = path.join(directory, filename);
    const hash = crypto.createHash('sha256');
    const fileData = fs.readFileSync(filePath);
    hash.update(fileData);
    return hash.digest('hex');
}

function stripHtml(input){
    return input.replace(/(<([^>]+)>)/gi, "")
}

function localeSort(a, b) {
    return a.localeCompare(b, 'en')
}

function toSentenceCase(str) {
    return str
        .replace(/[_-]+/g, ' ')            // underscores/hyphens → spaces
        .toLowerCase()                     // normalize
        .replace(/^\w/, c => c.toUpperCase()); // capitalize first letter
}

function srcToAlt(src) {
  const base = src
    .split('/')                        // get last segment
    .pop()
    .split('?')[0]                     // strip query if any
    .replace(/\.[^/.]+$/, '');         // remove extension
  return toSentenceCase(base);
}

// helper function to get all text content in syntax tree and join them into one string
function getTextContentOfHAST(node) {
    return node.value ?? (node.children ? node.children.map(getTextContentOfHAST).join('') : '');
};

const FALLBACK_DATE = '2024-02-13T00:00:00'

export default async function (eleventyConfig) {
    eleventyConfig.setServerOptions({
        domDiff: false,
        liveReload: true,
        useCache: true,
    });
    const NO_SEARCH_INDEX = process.env.NO_SEARCH_INDEX == 'true'? true : false
    let print_css_checksum = ''
    let github_css_checksum = ''
    let reset_css_checksum = ''
    let website_general_css_checksum = ''
    let search_js_checksum = ''
    let search_css_checksum = ''
    let youtube_js_checksum = ''
    let youtube_css_checksum = ''
    let izoom_js_checksum = ''
    let izoom_css_checksum = ''
    let context_menu_js_checksum = ''
    let spline_runtime_js_checksum = ''

    // website build determinism: run event callbacks sequentially rather than in parallel
    eleventyConfig.setEventEmitterMode("sequential");
 
    // This is needed to override eleventy's logic for determining fallback date (see: https://www.11ty.dev/docs/dates/), which is to use the current time (or something like that)
    // basically this means that every build results in different fallback dates, breaking determinism.
    eleventyConfig.addGlobalData("date", () => 
        DateTime.fromISO(FALLBACK_DATE, { zone: 'utc' }).toJSDate()
    )
    eleventyConfig.addPlugin(xmlFiltersPlugin);
    eleventyConfig.addPlugin(eleventyNavigationPlugin);
    eleventyConfig.addPlugin(pluginTOC, { // https://www.npmjs.com/package/eleventy-plugin-nesting-toc
        // tags: ['h2', 'h3', 'h4'], // Which heading tags are selected (headings must each have an ID attribute)
        // ignoredElements: [],  // Elements to ignore when constructing the label for every header (useful for ignoring permalinks, must be selectors)
        // wrapper: 'nav',       // Element to put around the root `ol`
        // wrapperClass: 'toc',  // Class for the element around the root `ol`
        // headingText: '',      // Optional text to show in heading above the wrapper element
        // headingTag: 'h2'      // Heading tag when showing heading above the wrapper element
    });
    eleventyConfig.addPlugin(mdlitePlugin, {
        pathPrefix: "docs",
        header: `> ## Documentation Index
> Fetch the complete documentation index at: https://antithesis.com/docs/llms.txt
> Use this file to discover all available pages before exploring further.`,
    });

    eleventyConfig.addFilter('default_date', (value) => {
        if (value instanceof Date) return value
        if (value instanceof DateTime) return value.toJSDate()
        if (typeof value === 'string') {
            const date = DateTime.fromISO(value, { zone: 'utc' })
            if (date.isValid) return date.toJSDate()
        }
        if (typeof value === 'number') {
            const date = DateTime.fromMillis(value)
            if (date.isValid) return date.toJSDate()
        }
        const date = DateTime.fromISO(FALLBACK_DATE, { zone: 'utc' })

        return date.toJSDate()
    })
    
    console.log('process.env.ELEVENTY_ROOT=', process.env.ELEVENTY_ROOT);
    
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/company/osspledge.json");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/*.webmanifest");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/*.txt");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/**/!(*.module).css");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/**/*.woff2");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/**/*.ico");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/**/*.pdf");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/**/*.png");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/**/*.jpg");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/**/*.jpeg");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/**/*.gif");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/**/*.svg");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/**/*.webp");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/**/*.splinecode");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/images/stickers");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/images/animations");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/assets/**");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/_scripts/menu.js");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/_scripts/spline/runtime.js");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/_scripts/libs/youtube-lite/lite-yt-embed.js");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/bugbash/conference2026/assets");
    eleventyConfig.addPassthroughCopy(process.env.ELEVENTY_ROOT + "/bugbash/conference2026/styles.css");

    eleventyConfig.addWatchTarget(`${process.env.ELEVENTY_ROOT}/**/*.(jsx|js|ts|tsx|css)`);

    tokyoNight.colors['editor.background'] = 'var(--pre-background, #1a1b26)';
    const highlighter = await createHighlighter({
        themes: [tokyoNight],
        //ansi for spetial terminal output https://shiki.style/languages#ansi
        langs: ['ansi', "abap", "ada", "angular-html", "angular-ts", "apache", "apex", "apl", "applescript", "ara", "asciidoc", "asm", "astro", "awk", "ballerina", "bat", "beancount", "berry", "bibtex", "bicep", "blade", "c", "cadence", "clarity", "clojure", "cmake", "cobol", "codeowners", "codeql", "coffee", "common-lisp", "coq", "cpp", "crystal", "csharp", "css", "csv", "cue", "cypher", "d", "dart", "dax", "desktop", "diff", "docker", "dream-maker", "elixir", "elm", "emacs-lisp", "erb", "erlang", "fennel", "fish", "fluent", "fortran-fixed-form", "fortran-free-form", "fsharp", "gdresource", "gdscript", "gdshader", "genie", "gherkin", "git-commit", "git-rebase", "gleam", "glimmer-js", "glimmer-ts", "glsl", "gnuplot", "go", "graphql", "groovy", "hack", "haml", "handlebars", "haskell", "haxe", "hcl", "hjson", "hlsl", "html", "html-derivative", "http", "hxml", "hy", "imba", "ini", "java", "javascript", "jinja", "jison", "json", "json5", "jsonc", "jsonl", "jsonnet", "jssm", "jsx", "julia", "kotlin", "kusto", "latex", "less", "liquid", "log", "logo", "lua", "make", "markdown", "marko", "matlab", "mdc", "mdx", "mermaid", "mojo", "move", "narrat", "nextflow", "nginx", "nim", "nix", "nushell", "objective-c", "objective-cpp", "ocaml", "pascal", "perl", "php", "plsql", "po", "postcss", "powerquery", "powershell", "prisma", "prolog", "proto", "pug", "puppet", "purescript", "python", "qml", "qmldir", "qss", "r", "racket", "raku", "razor", "reg", "rel", "riscv", "rst", "ruby", "rust", "sas", "sass", "scala", "scheme", "scss", "shaderlab", "shellscript", "shellsession", "smalltalk", "solidity", "soy", "sparql", "splunk", "sql", "ssh-config", "stata", "stylus", "svelte", "swift", "system-verilog", "systemd", "tasl", "tcl", "terraform", "tex", "toml", "tsv", "tsx", "turtle", "twig", "typescript", "typespec", "typst", "v", "vala", "vb", "verilog", "vhdl", "viml", "vue", "vue-html", "vyper", "wasm", "wenyan", "wgsl", "wikitext", "wolfram", "xml", "xsl", "yaml", "zenscript", "zig"]
    })

    //custom markdown
    const options = {
        html: true,
        typographer: true,
        linkify: true,
    };
    
    const mdLib = markdownIt(options)
        .use(markdownItAttrs)
        .use(markdownItContainer, 'big') 
        .use(markdownItContainer, 'big_warning')
        .use(markdownItContainer, 'big_danger')
        .use(markdownItContainer, 'big_success')
        .use(markdownItContainer, 'big_info')
        .use(markdownItContainer, 'big_brand')
        .use(markdownItContainer, 'caution')
        .use(markdownItContainer, 'important')
        .use(markdownItContainer, 'attention')
        .use(markdownItContainer, 'warning')
        .use(markdownItContainer, 'danger')
        .use(markdownItContainer, 'error')
        .use(markdownItContainer, 'tip')
        .use(markdownItContainer, 'hint')
        .use(markdownItContainer, 'note')
        .use(markdownItContainer, 'opinion')
        .use(mathjax3)
        .use(markdownItAnchor,{
            permalink: markdownItAnchor.permalink.headerLink({ 
                safariReaderFix: true,
                class:'header-anchor muted' 
            })
        })
        .use(markdownItDeflist)
        // this custom plugin has to be placed after markdownItDeflist to work
        .use(markdownItDtAnchor) // https://www.npmjs.com/package/markdown-it-anchor#manually-setting-the-id-attribute
    
    // got to use custom code_block definition due to markdownItAttributes make highlight function not receiving attributes
    // https://github.com/markdown-it/markdown-it/blob/master/lib/renderer.mjs
    // https://github.com/arve0/markdown-it-attrs#custom-rendering
    mdLib.renderer.rules.fence = function (tokens, idx, options, env, slf) {
        const token = tokens[idx];
        const attrs = token.attrs || [];

        // Extract attributes
        const attributes = {};
        attrs.forEach(attr => {
            const [key, value] = attr;
            attributes[key] = value || true;
        });
        const info = token.info ? token.info.trim() : ''
        const lang = info.split(/\s+/g)[0];
        let code_html = highlighter.codeToHtml(token.content?.trimEnd(), {
            theme: 'tokyo-night',
            lang: lang,
            transformers: [
                {
                    pre(node){
                        Object.keys(attributes).sort(localeSort).forEach(a=>{
                            if(a !== 'class'){
                                node.properties[a] = attributes[a]
                            }else{
                                this.addClassToHast(node, attributes[a])
                            }
                        });
                    }
                },
                {
                    pre(node) {
                        // Remove the tabindex attribute from the pre tag
                        node.properties.tabindex = undefined; 
                    },
                },
                {
                    name: 'inject-copy-button',
                    enforce: 'post',
                    pre(node) {
                        const textContents = getTextContentOfHAST(node);
                        const encodedCodeString = Buffer.from(textContents).toString('base64');
                        const button = {
                            type: 'element',
                            tagName: 'button',
                            properties: {
                                className: ['copy-button'],
                                type: 'button',
                                'aria-label': 'Copy code',
                                title: 'Copy',
                                'data-code': encodedCodeString
                            },
                            children: [
                                { type: 'element',
                                    tagName: 'i',
                                    properties: {
                                        className: ['icon', 'icon-copy'],
                                        type: 'i',        
                                    }
                                }
                            ]
                        }
                        // Add as first child so it overlays nicely
                        node.children.unshift(button);
                    }
                },
                {
                    name: 'handle-leading-dollar-sign',
                    enforce: 'pre',
                    line(node) {
                        if(['console', 'bash', 'shell', 'sh','shellscript'].includes(lang)) {
                            const trimmedLineText = getTextContentOfHAST(node).trim();
                            // because we trimmed both sides, this guarantees at least two tokens; '$' and something else
                            if (trimmedLineText.startsWith('$ ')) {
                                //remove first token (the dollar sign)   
                                node.children.shift();
                                /*                                        
                                    node -> line of code being processed
                                    node.children -> tokens that construct the line
                                    node.children[n].children -> array of the token's contents
                                    node.children[n].children[0].value -> the actual text contents of the token
                                    
                                    When Shiki generates the node object, if there is a node.children[n], there will be a node.children[n].children[0].value
                                    Please read HAST's README for more info: https://github.com/syntax-tree/hast
                                */
                                const newleadingNode = node.children[0].children[0];
                                newleadingNode.value = newleadingNode.value.trimStart();
                                
                                this.addClassToHast(node, 'console-prefix'); // add pseudo $
                            
                            } else if(trimmedLineText === '$') {
                                node.children = [];
                            }
                        }
                    },
                },
                transformerNotationHighlight({
                    classActiveLine: "shiki-highlighted",
                }),
                transformerNotationDiff({
                    classLineAdd: "shiki-diff-add",
                    classLineRemove: "shiki-diff-remove",
                }),
                transformerNotationErrorLevel({
                    classMap: {
                        error: "shiki-error",
                        warning: "shiki-warning",
                    }
                }),
            ]
        })
        //TODO we should wrap pre in a spetial scrollable container and position language label relative to it
        // with this we should also make extended code block to go outside narrow container and be as wide as possible

        return code_html
    }

    mdLib.renderer.rules.code_inline = function (tokens, idx, options, env, slf) {
        const token = tokens[idx];
        const attrs = token.attrs || [];

        // Extract attributes
        const attributes = {};
        attrs.forEach(attr => {
            const [key, value] = attr;
            attributes[key] = value || true;
        });

        const lang = attributes["data-lang"];
        
        let code_html = highlighter.codeToHtml(token.content?.trimEnd(), {
            theme: 'tokyo-night',
            lang: lang,
        })

        // Strip away the wrapping <pre> tag and keep the <code> contents
        const code = code_html.replace(/.*?<code\b[^>]*>([\s\S]*?)<\/code>.*/i, '$1');

        // Retain all added attributes
        const attrString = Object.entries(attributes || {})
        .map(([key, value]) => ` ${key}="${String(value).replace(/"/g, '&quot;')}"`)
        .join("");

        // Return the final <code> tag with all attributes
        return `<code${attrString}>${code}</code>`;
    }   

    eleventyConfig.setLibrary('md', mdLib);

    let eleventyDirectories;

    eleventyConfig.on("eleventy.before", async ({ dir, directories, runMode, outputMode }) => {
        eleventyDirectories = directories;
        // console.log('eleventyDirectories', eleventyDirectories)
        // console.log('eleventyDirectories.input=', eleventyDirectories.input );

        const fileChecksum = getFileChecksum(directories.input)

        print_css_checksum = fileChecksum('css/print.css')
        github_css_checksum = fileChecksum('css/github.css')
        reset_css_checksum = fileChecksum('css/reset.css')
        website_general_css_checksum = fileChecksum('css/website-general.css')
        search_js_checksum = fileChecksum('_scripts/search/index.tsx')
        search_css_checksum = fileChecksum('_scripts/search/search.module.css')
        izoom_js_checksum = fileChecksum('_scripts/izoom/index.tsx')
        izoom_css_checksum = fileChecksum('_scripts/izoom/izoom.module.css')
        youtube_js_checksum = fileChecksum('_scripts/libs/youtube-lite/lite-yt-embed.js')
        youtube_css_checksum = fileChecksum('_scripts/libs/youtube-lite/lite-yt-embed.css')
        context_menu_js_checksum = fileChecksum('_scripts/context_menu/index.tsx')
        spline_runtime_js_checksum = fileChecksum('_scripts/spline/runtime.js')
	});

    
    // Shortcode should be used as:
    // {% md %}
    // {% endmd %}
    eleventyConfig.addPairedShortcode("md", function (content) {
        return mdLib.render(content.trim())
    })

    eleventyConfig.addPairedShortcode("with_aside", function (content) {
        const split = content.split(/(?:\s*\n)*<!--\s*aside\s*-->(?:\s*\n)*/)
        const processedContent = mdLib.render(split[0].trim())
        const processedAside = split[1]? mdLib.render(split[1].trim()) : ''
        return `<div class='with-aside'><div class='with-aside-content'>${processedContent.replace(/<p>\s*<\/p>$/, '')}</div><aside>${processedAside.replace(/<p>\s*<\/p>$/, '')}</aside></div>`
    })

    eleventyConfig.addPairedShortcode("notebook_example", function (content) {
    const split = content.split(/(?:\s*\n)*<!--\s*output\s*-->(?:\s*\n)*/)
    const processedCode = mdLib.render(
`
~~~javascript{data-lang="notebook code"}
${split[0].trim()}
~~~

`)
    const processedOutput = split[1]?  mdLib.render(split[1].trim()) : ''
    // return processedCode
    return `<div class='notebook_example'><div class='notebook_code'>${processedCode}</div>
    ${processedOutput ? `<div class='notebook_output' data-lang="notebook output">${processedOutput.replace(/<p>\s*<\/p>$/, '')}</div>` : '' }
</div>`
    });


    // Usage:
    //
    // {% tabs %}
    // <!-- label -->
    // Label 1
    // <!-- content -->
    // Content for label 1
    //
    // <!-- label -->
    // Label 2
    // <!-- content -->
    // Content for label 2
    // {% endtabs %}
    
    // tracks how many sets of tabs exist on a given page during build
    const tabCountMap = new Map();

    eleventyConfig.addPairedShortcode("tabs", function(inner, props = {}) {

    const filePathStem = this.page.filePathStem;
    // either adds new tab counter at 0 or +1 the existing counter
    tabCountMap.set(filePathStem, tabCountMap.has(filePathStem) ? tabCountMap.get(filePathStem) + 1 : 0);
    const group = `tabs-${tabCountMap.get(this.page.filePathStem)}`;

    // Parse alternating sections marked by <!-- label --> / <!-- content -->
    const sections = [];
    const secRe = /<!--\s*(label|content)\s*-->\s*([\s\S]*?)(?=(?:<!--\s*(?:label|content)\s*-->)|$)/gi;
    let m;
    while ((m = secRe.exec(inner))) {
        sections.push({ type: m[1].toLowerCase(), text: m[2].trim() });
    }

    // Pair them up: label -> content
    const pairs = [];
    for (let i = 0; i < sections.length; ) {
        if (sections[i].type !== "label") { i++; continue; }
        const label = sections[i].text;
        let content = "";
        if (i + 1 < sections.length && sections[i+1].type === "content") {
        content = sections[i+1].text;
        i += 2;
        } else {
        i += 1;
        }
        pairs.push({ label, content });
    }

    const customClasses = [];
    if (props.fill)   customClasses.push(" fill");
    if (props.nowrap) customClasses.push(" nowrap");
    if (props.image_with_labels) customClasses.push(" image-with-labels");

    let tabsHtml = "";
    let panelsHtml = "";
    let cssRules = "";

    pairs.forEach((p, idx) => {
        const slugBase = slugify(p.label, { lower: true, strict: true });
        const inputId = `${group}-${slugBase}`;
        const contentId = `content-${inputId}`;

        let classes = "";
        if (/^\s*```/.test(p.content)) {
        classes += "code-tab";
        }

        const renderedLabel = mdLib ? mdLib.render(p.label) : p.label;

        tabsHtml += `
<label for="${inputId}" class="${classes}" tabindex="-1">
  <input type="radio" name="${group}" id="${inputId}" tabindex="0" ${idx === 0 ? "checked" : ""} />
  <div>
${renderedLabel}
</div>
</label>`.trim();

        const renderedContent = mdLib ? mdLib.render(p.content) : p.content;

        panelsHtml += `
<div class="a_tab-content" id="${contentId}">
${renderedContent}
</div>`.trim();

        cssRules += `
.a_tab-labels:has(#${inputId}:checked) ~ .a_tab-contents > #${contentId} {
  visibility: visible;
  position: relative;
}`.trim() + "\n";
      });

      return `<div id="${group}" class="a_tabs">
  <div class="a_tab-labels${customClasses.join("")}" tabindex="-1">
${tabsHtml}
  </div>
  <div class="a_tab-contents">
${panelsHtml}
  </div>
  <style>${cssRules}</style>

  <script>
  (() => {
    const root = document.getElementById(${JSON.stringify(group)});
    if (!root) return;

    document.addEventListener('DOMContentLoaded', () => {
      const hash = window.location.hash.slice(1);
      if (hash) {
        const target = document.getElementById(hash);
        if (target && root.contains(target)) {
          const panel = target.closest('.a_tab-content');
          if (panel) {
            const panelId = panel.id;
            const slug = panelId.replace(/^content-/, '');
            const input = root.querySelector('#' + slug);
            if (input && input.type === 'radio') {
              input.checked = true;
              target.scrollIntoView({ behavior: 'smooth' });
            }
          }
        }
      }
    });
  })();
  </script>
</div>`;
    });

    /**
     * Usage:
     * {% expander %}
     * PUT SUMMARY HERE
     * <!--content-->
     * PUT CONTENTS HERE
     * {% endexpander %}
     */
    eleventyConfig.addPairedShortcode("expander", (content) => {
        const regexp = /([\s\S]*?)<!--content-->([\s\S]*)/i;
        const match = content.match(regexp)

        if (match && match.length >= 3) {
            const summary = match[1].trim();
            const text = match[2].trim();

            const renderedSummary = mdLib ? mdLib.render(summary) : summary;
            const renderedText = mdLib ? mdLib.render(text) : text;

            // icon-chevron-right defines what icon will be used in the summary's ::before
            return `<details class="md-expander icon-chevron-right">
            <summary class="md-summary">${renderedSummary}</summary>
            <div class="md-expander-content-wrapper">   
            ${renderedText}
            </div>
            </details>`;
        }
    });

    eleventyConfig.addShortcode("wistia_player", (props) => {
        const template = fs.readFileSync("_includes/wistia-player.html", "utf8");

        return template
            .replaceAll(/\{\{\s*videoId\s*\}\}/g, props.id)
            .replace(/\{\{\s*borderRadius\s*\}\}/g, props.borderRadius || 10)
            .replace(/\{\{\s*doNotTrack\s*\}\}/g, props.doNotTrack || false)
            .replace(/\{\{\s*playerColor\s*\}\}/g, props.playerColor || "#9806f3");
    });


    eleventyConfig.addFilter("list_nav_children", function (collection, parentKey) {
        const navPages = collection
        .filter(page => page.data.eleventyNavigation && page.data.eleventyNavigation.parent === parentKey)
        .sort((a, b) => (a.data.eleventyNavigation.order || 0) - (b.data.eleventyNavigation.order || 0));

        const listItems = navPages.map(entry => `
        <li><a href="${entry.url? entry.url : entry.data.eleventyNavigation.url || '' }">${entry.data.eleventyNavigation.title || entry.data.title}</a></li>`).join('');

        return `<ul>${listItems}</ul>`;
    });

    eleventyConfig.addFilter("indexOfUrl", function(collection, url) {
        return collection.findIndex(item => item.url === url);
    });

    eleventyConfig.addFilter("titleOfUrl", function(collection, url) {
        return collection.find(item => item.url === url)?.data?.title;
    });

    eleventyConfig.addFilter("withTag", (posts, tag) =>
        (posts || []).filter(p => (p.data.tags || []).includes(tag))
    );

    eleventyConfig.addCollection("blogTagPages", (collectionApi) => {
        const s = new Set();
        collectionApi.getFilteredByTag("blog").forEach(item => {
            (item.data.tags || []).forEach(t => {
                if (t !== "blog") s.add(t);
            });
        });
        return ["__all__", ...Array.from(s).sort()];
    });

    eleventyConfig.addCollection("blogAuthorPages", (collectionApi) => {
        // JSON objects don't play nice with Sets, so we use Map with slug as key
        const s = new Map();
        collectionApi.getFilteredByTag("blog").forEach( item => {
            (item.data.authors || []).forEach(a => {
                const slug = a.name.toLowerCase().replaceAll(" ", "-");
                if(!s.has(slug)) {
                    //insert slug into JSON for later
                    a.slug = slug

                    s.set(slug, a);
                }
            });
        });
        //return array of just map values (no slug key)
        return [...Array.from(s.values()).sort()];
    })

    eleventyConfig.addCollection("paged_docs", collectionApi => {
        const rawPages = collectionApi.getAll().filter(page => {
            const tags = page.data.tags || [];
            return page.data.eleventyNavigation?.hideFromDocNavigation !== true && tags.includes("docs") && !tags.includes("resources");
        });

        const nodeMap = new Map();
        rawPages.forEach(page => {
            const key = page.data.eleventyNavigation?.key || page.url;
            nodeMap.set(key, { page, children: [] });
        });

        // wire parent→children for any page whose parent exists in our map
        nodeMap.forEach((node, key) => {
            const parentKey = node.page.data.eleventyNavigation?.parent;
            if (parentKey && nodeMap.has(parentKey)) {
            nodeMap.get(parentKey).children.push(node);
            }
        });

        const roots = Array.from(nodeMap.values()).filter(node => {
            const parentKey = node.page.data.eleventyNavigation?.parent;
            return !parentKey || !nodeMap.has(parentKey);
        });

        function sortByNavOrder(nodes) {
            return nodes.sort((a, b) => {
            const oa = a.page.data.eleventyNavigation?.order ?? 0;
            const ob = b.page.data.eleventyNavigation?.order ?? 0;
            return oa - ob;
            });
        }

        // recursively walk+flatten, assigning resolvedOrder
        function flatten(nodes, parentResolved = 0) {
            return sortByNavOrder(nodes).flatMap(node => {
            const rawOrder = node.page.data.eleventyNavigation?.order ?? 0;
            const resolved = parentResolved
                ? parentResolved + rawOrder
                : rawOrder * 1000;

            node.page.data.resolvedOrder = resolved;
            return [
                node.page,
                ...flatten(node.children, resolved),
            ];
            });
        }

        return flatten(roots).filter(page => page.url);
    });

    // only nunjucks template can pass objects, this wouldn't work in liquid
    // Front matter must have templateEngineOverride: njk or global template set as nunjucks by default
    // we don't want to make it nunjucks shortcode because we wouldn't be able to catch build errors
    // eleventyConfig.addShortcode("pic", async function (src, props) {
    eleventyConfig.addShortcode("pic", async function (src, props) {
        const inputPath = path.join(process.env.ELEVENTY_ROOT, src)
        const outPath = path.join(eleventyDirectories.output, './img_opt/')
        const ext = path.extname(src).toLowerCase();
        const formats = ["webp", ext === ".png" ? "png" : "jpeg"];

        let metadata = await Image(inputPath,
            {
                widths: ["auto"],
                // useCache: false,
                formats: formats,
                urlPath: '/img_opt/',
                outputDir: outPath,
                sharpPngOptions: {
                    palette: true,
                    quality: 50,
                },
                sharpWebpOptions: {
                    quality: 60,
                    effort: 6
                },
                sharpJpegOptions: {
                    quality: 75,
                    progressive: true,
                }
            }
        );
     
        // console.log('metadata',metadata)

        let imageAttributes = {
            alt: srcToAlt(src),
            // alt: typeof props?.alt === 'string' ? stripHtml(props.alt) : '',
            // class: typeof props?.class === 'string' ? stripHtml(props.class) : '',
            // title: typeof props?.title === 'string' ? stripHtml(props.title) : '',
            // sizes,
            loading: "lazy",
            decoding: "async",
        }
        if(props){
            Object.keys(props).sort(localeSort).forEach(key=>{
                if(props[key] && typeof props[key] === 'string'){
                    imageAttributes[key] = stripHtml(props[key])
                }
            })
        }
        if (!imageAttributes.class) {
            imageAttributes.class = 'fade_on_load'
        } else if (!imageAttributes.class.includes('fade_on_load')) {
            imageAttributes.class += ' fade_on_load'
        }
        const r = Image.generateHTML(metadata, imageAttributes);
        // console.log('r=', r );
        return r
    });

    eleventyConfig.addFilter("nohtml", function (input) {
        return stripHtml(input)
    })

    // Should be used as {{ '_scripts/re.jsx' | jsbundle: 'defer' }}
    // possible in future {{ '_scripts/re.jsx' | jsbundle: 'defer', false, 100 }}
    eleventyConfig.addFilter("jsbundle", function (filePath, props) {
        // console.log('[template filter] jsbundl > ', filePath, ' props', props, ' in ', this.page.inputPath, this.page.outputPath);
        let jsAttribute = props
        if (jsAttribute === undefined) {
            jsAttribute = ''
        } else if (typeof jsAttribute !== 'string' && typeof jsAttribute == 'object') {
            jsAttribute = Object.entries(props)
                .sort(([keyA], [keyB]) => localeSort(keyA, keyB))
                .map(([key, value]) => {
                    // For boolean attributes like async, defer, etc., the value can be the name itself if true
                    if (value === true) {
                        return `${key}`;
                    }
                    return `${key}="${value}"`;
                })
                .join(' ');
        }

        const inputPageDirectory = path.dirname(this.page.inputPath);
        let inputFilePath = path.resolve(inputPageDirectory, filePath);
        if(filePath.startsWith('_scripts')){ //use global path instead of relative to the page
            inputFilePath = path.resolve(eleventyDirectories.input, filePath);
        }
        let outputPageDirectory = path.dirname(this.page.outputPath);
        const outputFilePath = path.resolve(outputPageDirectory, filePath);
        outputPageDirectory = path.dirname(outputFilePath)

        let parsedPath = path.parse(filePath);
        parsedPath.ext = '.js';
        parsedPath.base = `${parsedPath.name}${parsedPath.ext}`;
        let newFilePath = path.format(parsedPath);
        let cssPath = path.resolve(outputPageDirectory, `${parsedPath.name}.css`)

        buildSync({
            entryPoints: [inputFilePath],
            outdir: outputPageDirectory,
            bundle: true,
            /* NOTE: minifying seems to be the only way to prevent esbuild from injecting comments with
               references to source file, which changes with each build - resulting in non-determinism */
            minifyWhitespace: true, 
            target: [
                'chrome84',
                'edge84',
                'firefox63',
                'safari14.1',
                'opera70'
            ],
            jsx: 'automatic',
            // jsxFactory: 'h', breaks the build because we are not importing h
            alias: {
                'react': 'preact/compat',
                'react-dom': 'preact/compat'
            },
        })

        const input_file_checksum = getFileChecksum(inputFilePath)('')

        const cssFileExists = fs.existsSync(cssPath);
        let stringToReturn = `<script ${jsAttribute} src="${newFilePath}?v=${input_file_checksum}"></script>`

        if (cssFileExists) {
            // linking to css file
            // parsedPath = path.parse(filePath);
            // parsedPath.ext = '.css';
            // parsedPath.base = `${parsedPath.name}${parsedPath.ext}`;
            // let newCSSFilePath = path.format(parsedPath)
            // stringToReturn = `<link href="${newCSSFilePath}" rel="stylesheet" type="text/css">\n` + stringToReturn

            // inlining the css
            const cssFileContent = fs.readFileSync(cssPath, 'utf8');
            stringToReturn = `<style>
            ${cssFileContent}
            </style>
            ` + stringToReturn
        }
        return stringToReturn
    })

    eleventyConfig.addFilter('formatDate', (date, options) => {
        return new Intl.DateTimeFormat('en-US', options).format(new Date(date));
    });

    eleventyConfig.addNunjucksFilter("map", function(array, attribute) {
        if (!Array.isArray(array)) return [];
        return array.map(item => item[attribute]);
    });

    eleventyConfig.addShortcode("youtube", function (id, params) {
        return `
        <link rel="stylesheet" href="/_scripts/libs/youtube-lite/lite-yt-embed.css?v=${youtube_css_checksum}" />
        <lite-youtube videoid="${id}" params="${params}" title="Youtube Video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen>
            <noscript>
                <a target="_blank" class="lite-youtube-fallback" href="https://www.youtube.com/watch?v=${id}">Watch on YouTube</a>
            </noscript>
        </lite-youtube>
        <script src="/_scripts/libs/youtube-lite/lite-yt-embed.js?v=${youtube_js_checksum}"></script>
        `
    });

    eleventyConfig.addShortcode("spline_checksum", function () {
        return spline_runtime_js_checksum;
    });

    eleventyConfig.addShortcode("footer", function (doc) {
        const is_contact_page = this.page.url == '/contact/';
        return `
            <div class="spacer-pusher"></div>
            <div class='footer-wrapper'>
                <footer class='footer-content${doc ? ' fit':''}'>
                    <div class="footer-legal">
                        © Antithesis Operations LLC<br>
                        <a href="/legal/privacy_policy/">Privacy policy</a> &nbsp; 
                        <a href="/legal/terms_of_use/">Terms of use</a> &nbsp; 
                        <a href="/security/manifesto/">Security</a> &nbsp; 
                        <a href="https://trust.antithesis.com/" target="_blank">
                            <i class="icon icon-shield-check"></i>
                            SOC 2 Type 2
                        </a>
                    </div>
                    <div class='social'>
                        <a class='social-btn' title='LinkedIn' href='https://www.linkedin.com/company/antithesis-operations/' target='_blank'>
                            <i class='icon icon-linkedin'></i>
                        </a>
                        <a class='social-btn' title='GitHub' href='https://github.com/antithesishq' target='_blank'>
                            <i class='icon icon-github'></i>
                        </a>
                        <a class='social-btn' title='Discord' href='https://discord.gg/antithesis' target='_blank'>
                            <i class='icon icon-discord'></i>
                        </a>
                        <a class='social-btn' title='Youtube' href='https://www.youtube.com/@antithesis-hq' target='_blank'>
                            <i class='icon icon-youtube'></i>
                        </a>
                        <a class='social-btn' title='X/twitter' href='https://x.com/antithesishq/' target='_blank'>
                            <i class='icon icon-x'></i>
                        </a>
                        <a class='social-btn' title='Instagram' href='https://www.instagram.com/antithesishq/' target='_blank'>
                            <i class='icon icon-insta'></i>
                        </a>
                        <a class='social-btn' title='Updates to email' href='http://eepurl.com/gucvHX' target='_blank'>
                            <i class='icon icon-mail'></i>
                        </a>
                    </div>
                    <div class="footer_cta" ${doc? `style="flex:none"` : ""} >
                    ${is_contact_page? ``: `
                        <a href="/contact/" role="button" class="button btn-brand">
                            <!-- Below i tag fixes the ios safari hover effect bug. Why? Maybe multiple elements are treated as a group -->
                            <i></i>
                            Contact us
                        </a>
                    `}
                    </div>
                </footer>
            </div>
        `
    });

    eleventyConfig.addShortcode("global_scripts", function() {
        let global_scripts = ''
        if (this.page.url != '/') {
            global_scripts += `
                <script defer src="/_scripts/context_menu/index.js?v=${context_menu_js_checksum}"></script>
                
                <script defer src="/_scripts/search/index.js?v=${search_js_checksum}"></script>
                <link href="/_scripts/search/index.css?v=${search_css_checksum}" rel="stylesheet" type="text/css">
                <script defer src="/_scripts/izoom/index.js?v=${izoom_js_checksum}"></script>
                <link href="/_scripts/izoom/index.css?v=${izoom_css_checksum}" rel="stylesheet" type="text/css">
            `
        }
        return `
            <link href="/css/print.css?v=${print_css_checksum}" rel="stylesheet" type="text/css" media="print">
            <link href="/css/github.css?v=${github_css_checksum}" rel="stylesheet" type="text/css">

            <!-- Simple loading animation -->
            <script>
                const imgs = document.querySelectorAll('.fade_on_load')
                imgs.forEach(img=>{
                    if (img.complete) { // Image already loaded from cache
                        img.classList.add('loaded');
                    } else {
                        img.addEventListener('load', () => {
                            img.classList.add('loaded')
                        })
                    }
                })

                // Helper classes to identify browser and host OS
                const ua = navigator.userAgent.toLowerCase();

                const rules = [
                    // Browsers
                    { className: "is-firefox", match: /firefox/ },
                    { className: "is-chrome", match: /chrome/, exclude: /edg|opr|brave/ }, // exclude Edge, Opera, Brave
                    { className: "is-safari", match: /safari/, exclude: /chrome|android/ },

                    // Operating systems
                    { className: "is-android", match: /android/ },
                    { className: "is-linux", match: /linux/, exclude: /android/ },
                    { className: "is-macos", match: /mac os x/ },
                    { className: "is-ios", match: /(iphone|ipad|ipod)/, exclude: /mac os x/ },
                    { className: "is-windows", match: /windows nt/ }
                ];

                for (const rule of rules) {
                    if (
                        rule.match.test(ua) &&
                        (!rule.exclude || !rule.exclude.test(ua))
                    ) {
                        document.documentElement.classList.add(rule.className);
                    }
                }


                // Shiki copy buttons
                const buttons = document.querySelectorAll('pre.shiki > .copy-button');
                for (const btn of buttons) {
                    btn.addEventListener('click', async () => {
                        const encoded =
                            btn.getAttribute('data-code') ||
                            btn.parentElement?.getAttribute('data-code');

                        if (!encoded) return;
                        const text = atob(encoded);

                        const icon = btn.querySelector('i.icon')
                        try {
                            await navigator.clipboard.writeText(text);
                            icon.classList.replace("icon-copy", "icon-check");
                        } catch {
                            console.error("Unable to copy code to clipboard");
                            icon.classList.replace("icon-copy","icon-warning");
                        }
                        setTimeout(() => {
                            icon.classList.remove("icon-check", "icon-warning");
                            icon.classList.add("icon-copy");
                        }, 2000);
                    });
                }

                const expanders = document.querySelectorAll("details.md-expander");
                for (const expander of expanders) {
                    // add click event bypass when clicking anchor links that are in summaries
                    const anchorLink = expander.querySelector("summary.md-summary a[href^='#']");
                    if(anchorLink) {
                        anchorLink.addEventListener("click", (e) => {
                            e.preventDefault();
                            const detail = anchorLink.closest('details');
                            if(detail) detail.toggleAttribute('open');
                        })
                    }
                }
            </script>
            ${global_scripts}
        `;
    });

    eleventyConfig.addShortcode("head", function ({ title, image, desc, canonical, summary, doc, ogTitle, ogDesc }) {
        title = title || 'Antithesis: continuous reliability platform'
        ogTitle = ogTitle || title
        desc = summary ? stripHtml(summary) :
            desc ? stripHtml(desc)
                : "Spend less time worrying about bugs. Leave that to us. Our platform continuously searches your software for problems, enabling efficient debugging of the most complex issues."

        ogDesc = ogDesc || desc
        
        let meta_title = `<meta property="og:title" content="${stripHtml(ogTitle)}">
        <meta name="twitter:title" content="${stripHtml(ogTitle)}">`

        let meta_desc = `<meta name="description" content="${desc}">
        <meta property="og:description" content="${ogDesc}">
        <meta name="twitter:description" content="${ogDesc}">`

        image = image || "/images/Open-graph-image.png"

        const base_url = 'https://antithesis.com'
        const preview_url = new URL(image, base_url)
        
        
        let meta_img = `<meta property="og:image" content="${preview_url.href}">
        <meta name="twitter:image" content="${preview_url.href}">`

        let meta_canonical = `<link rel="canonical" href="${canonical ? (base_url + canonical) : (base_url + this.page.url)}" />`;

        let url = base_url
        if (this.page.url) {
            url = url + this.page.url
        }

        let meta_url = `<meta property="og:url" content="${url}">
        <meta property="twitter:url" content="${url}">`

        return `
            <meta charset="UTF-8">
            ${meta_title}
            ${meta_desc}
            ${meta_img}
            ${meta_url}
            ${meta_canonical}
            
            <meta property="og:type" content="website">
            <meta name="twitter:card" content="summary_large_image">
            <meta property="twitter:domain" content="antithesis.com">

            <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
            <link rel="alternate" type="application/rss+xml" title="Antithesis"
            href="https://antithesis.com/feed.xml" />

            <link rel="preload" href="/css/TT_Interphases_Pro_Variable.woff2" as="font" type="font/woff2" crossorigin ></link>
            <link rel="preload" href="/css/Antithesis_mono_VF_Upright.woff2" as="font" type="font/woff2" crossorigin ></link>
        
            <link href="/css/reset.css?v=${reset_css_checksum}" rel="stylesheet" type="text/css">
            <link href="/css/website-general.css?v=${website_general_css_checksum}" rel="stylesheet" type="text/css"></link>

            <link rel="icon" href="/images/favicon.ico" sizes="48x48">
            <link rel="icon" href="/images/favicon.svg" sizes="any" type="image/svg+xml">
            <link rel="apple-touch-icon" href="/images/apple-touch-icon.png" />
            <link rel="manifest" href="/site.webmanifest" /> 
        `;
    });

    // Simple deep merge that prefers values from `b`
    function deepMerge(a, b) {
        if (b === undefined) return a;
        if (a === undefined) return b;
        if (Array.isArray(a) || Array.isArray(b)) return b;
        if (typeof a === "object" && typeof b === "object") {
        const out = { ...a };
        for (const k of Object.keys(b)) out[k] = deepMerge(a[k], b[k]);
        return out;
        }
        return b;
    }

    function abs(url, base) {
        try {
        if (!url) return undefined;
        return new URL(url, base).toString();
        } catch {
        return url;
        }
    }

    function normalizeToGraph(x) {
        if (!x) return [];
        if (Array.isArray(x)) return x;
        if (x["@graph"]) return x["@graph"];
        return [x];
    }

    eleventyConfig.addNunjucksShortcode("schemaAuto", function(custom) {
        const data = this.ctx || {};
        const site = data.site || {};
        const lang = site.lang || "en";
        const siteUrl = site.url || "";

        const pageUrl = abs(data.page?.url || "/", siteUrl);
        const websiteId = abs("#website", siteUrl);
        const webpageId  = abs("#webpage",  pageUrl);

        const baseGraph = [];

        // WebSite
        baseGraph.push({
            "@type": "WebSite",
            "@id": websiteId,
            url: abs("/", siteUrl),
            name: site.name || data.title || "",
            inLanguage: lang,
            ...(site.organization?.["@id"] ? { publisher: { "@id": site.organization["@id"] } } : {})
        });

        // WebPage (built from page front-matter when possible)
        const title = data.title || site.name || "";
        const description = data.desc || data.description || data.excerpt;
        const primaryImg = data.image || data.socialImage || site.defaultImage;

        const webPage = {
            "@type": "WebPage",
            "@id": webpageId,
            url: pageUrl,
            name: title,
            isPartOf: { "@id": websiteId },
            inLanguage: lang,
            ...(description ? { description } : {}),
            ...(primaryImg ? {
                primaryImageOfPage: {
                "@type": "ImageObject",
                url: abs(primaryImg, siteUrl)
                }
            } : {}),
            ...(site.serviceId ? { about: { "@id": site.serviceId } } : {})
        };
        baseGraph.push(webPage);

        const customGraph = normalizeToGraph(custom);

        const byId = new Map();
        for (const node of baseGraph) if (node?.["@id"]) byId.set(node["@id"], node);

        const idlessCustom = [];
        for (const node of customGraph) {
        if (!node) continue;
        const id = node["@id"];
        if (id && byId.has(id)) {
            byId.set(id, deepMerge(byId.get(id), node)); // custom overrides base
        } else if (id) {
            byId.set(id, node); // new node
        } else {
            idlessCustom.push(node); // append later
        }
        }

        const mergedGraph = [...byId.values(), ...idlessCustom];
        const payload = { "@context": "https://schema.org", "@graph": mergedGraph };

        return `<script type="application/ld+json">\n${JSON.stringify(payload, null, 2)}\n</script>`;
    });

    eleventyConfig.addShortcode("analytics_scripts", function () {
        if(NO_SEARCH_INDEX) {
            return "";
        }

        return `
            <!-- Posthog -->
            <script>
            !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
            posthog.init('phc_OtotZEtpBzCGGKnoLoLu9Rs6cReaNNJDnsEXWZQKfLU',{api_host:'https://us.i.posthog.com', disable_web_experiments: false})
            </script>

            <!-- Google Tag Manager -->
            <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-W9GNSJM');</script>
            <!-- End Google Tag Manager -->
        `;
    });

    if(!NO_SEARCH_INDEX){
        eleventyConfig.addPlugin(searchPlugin, {
            indexFileName: 'search_index',
            outDir,
            showParseErrors: false,
            excludeURLs: [
                `/thank_you/`,
                `/404/`,
                `/style-guides/`,
                `/lp/`,
                `/case_studies/palantir`,
                `/legal/`,
                `/sitemap/`,
                `/security/policy/`
            ]
        })
    }

    return {
        markdownTemplateEngine: "njk",
        htmlTemplateEngine: "njk",
        templateFormats: ["njk", "html", "md", "liquid"],
    };
}
