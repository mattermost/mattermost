// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as TextFormatting from './text_formatting.jsx';
import * as SyntaxHighlighting from './syntax_hightlighting.jsx';

import marked from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';

function markdownImageLoaded(image) {
    image.style.height = 'auto';
}
window.markdownImageLoaded = markdownImageLoaded;

class MattermostMarkdownRenderer extends marked.Renderer {
    constructor(options, formattingOptions = {}) {
        super(options);

        this.heading = this.heading.bind(this);
        this.paragraph = this.paragraph.bind(this);
        this.text = this.text.bind(this);

        this.formattingOptions = formattingOptions;
    }

    code(code, language) {
        let usedLanguage = language || '';
        usedLanguage = usedLanguage.toLowerCase();

        if (usedLanguage === 'tex' || usedLanguage === 'latex') {
            try {
                const html = katex.renderToString(code, {throwOnError: false, displayMode: true});

                return '<div class="post-body--code tex">' + html + '</div>';
            } catch (e) {
                // fall through if latex parsing fails and handle below
            }
        }

        // treat html as xml to prevent injection attacks
        if (usedLanguage === 'html') {
            usedLanguage = 'xml';
        }

        let className = 'post-code';
        if (!usedLanguage) {
            className += ' post-code--wrap';
        }

        let header = '';
        if (SyntaxHighlighting.canHighlight(usedLanguage)) {
            header = (
                '<span class="post-code__language">' +
                    SyntaxHighlighting.getLanguageName(language) +
                '</span>'
            );
        }

        // if we have to apply syntax highlighting AND highlighting of search terms, create two copies
        // of the code block, one with syntax highlighting applied and another with invisible text, but
        // search term highlighting and overlap them
        const content = SyntaxHighlighting.highlight(usedLanguage, code);
        let searchedContent = '';

        if (this.formattingOptions.searchTerm) {
            const tokens = new Map();

            let searched = TextFormatting.sanitizeHtml(code);
            searched = TextFormatting.highlightSearchTerms(searched, tokens, this.formattingOptions.searchTerm);

            if (tokens.size > 0) {
                searched = TextFormatting.replaceTokens(searched, tokens);

                searchedContent = (
                    '<div class="post-code__search-highlighting">' +
                        searched +
                    '</div>'
                );
            }
        }

        return (
            '<div class="' + className + '">' +
                header +
                '<code class="hljs">' +
                    searchedContent +
                    content +
                '</code>' +
            '</div>'
        );
    }

    codespan(text) {
        let output = text;

        if (this.formattingOptions.searchTerm) {
            const tokens = new Map();
            output = TextFormatting.highlightSearchTerms(output, tokens, this.formattingOptions.searchTerm);
            output = TextFormatting.replaceTokens(output, tokens);
        }

        return (
            '<span class="codespan__pre-wrap">' +
                '<code>' +
                    output +
                '</code>' +
            '</span>'
        );
    }

    br() {
        if (this.formattingOptions.singleline) {
            return ' ';
        }

        return super.br();
    }

    image(href, title, text) {
        let out = '<img src="' + href + '" alt="' + text + '"';
        if (title) {
            out += ' title="' + title + '"';
        }
        out += ' onload="window.markdownImageLoaded(this)" onerror="window.markdownImageLoaded(this)" class="markdown-inline-img"';
        out += this.options.xhtml ? '/>' : '>';
        return out;
    }

    heading(text, level, raw) {
        const id = `${this.options.headerPrefix}${raw.toLowerCase().replace(/[^\w]+/g, '-')}`;
        return `<h${level} id="${id}" class="markdown__heading">${text}</h${level}>`;
    }

    link(href, title, text) {
        let outHref = href;

        try {
            const unescaped = decodeURIComponent(unescape(href)).replace(/[^\w:]/g, '').toLowerCase();

            if (unescaped.indexOf('javascript:') === 0 || unescaped.indexOf('vbscript:') === 0 || unescaped.indexOf('data:') === 0) { // eslint-disable-line no-script-url
                return text;
            }
        } catch (e) {
            return text;
        }

        if (!(/[a-z+.-]+:/i).test(outHref)) {
            outHref = `http://${outHref}`;
        }

        let output = '<a class="theme markdown__link" href="' + outHref + '" rel="noreferrer"';

        // special case for channel links and permalinks that are inside the app
        if (new RegExp('^' + TextFormatting.escapeRegex(global.mm_config.SiteURL) + '\\/[^\\/]+\\/(pl|channels)\\/').test(outHref)) {
            output += ' data-link="' + outHref.substring(global.mm_config.SiteURL.length) + '"';
        } else {
            output += ' target="_blank"';
        }

        if (title) {
            output += ' title="' + title + '"';
        }

        // remove any links added to the text by hashtag or mention parsing since they'll break this link
        output += '>' + text.replace(/<\/?a[^>]*>/g, '') + '</a>';

        return output;
    }

    paragraph(text) {
        if (this.formattingOptions.singleline) {
            return `<p class="markdown__paragraph-inline">${text}</p>`;
        }

        return super.paragraph(text);
    }

    table(header, body) {
        return `<div class="table-responsive"><table class="markdown__table"><thead>${header}</thead><tbody>${body}</tbody></table></div>`;
    }

    listitem(text, bullet) {
        const taskListReg = /^\[([ |xX])\] /;
        const isTaskList = taskListReg.exec(text);

        if (isTaskList) {
            return `<li class="list-item--task-list">${'<input type="checkbox" disabled="disabled" ' + (isTaskList[1] === ' ' ? '' : 'checked="checked" ') + '/> '}${text.replace(taskListReg, '')}</li>`;
        }

        if (/^\d+.$/.test(bullet)) {
            // this is a numbered list item so override the numbering
            return `<li value="${parseInt(bullet, 10)}">${text}</li>`;
        }

        return `<li>${text}</li>`;
    }

    text(txt) {
        return TextFormatting.doFormatText(txt, this.formattingOptions);
    }
}

export function format(text, options) {
    const markdownOptions = {
        renderer: new MattermostMarkdownRenderer(null, options),
        sanitize: true,
        gfm: true,
        tables: true
    };

    return marked(text, markdownOptions);
}

// Marked helper functions that should probably just be exported

function unescape(html) {
    return html.replace(/&([#\w]+);/g, (_, m) => {
        const n = m.toLowerCase();
        if (n === 'colon') {
            return ':';
        } else if (n.charAt(0) === '#') {
            return n.charAt(1) === 'x' ?
                String.fromCharCode(parseInt(n.substring(2), 16)) :
                String.fromCharCode(+n.substring(1));
        }
        return '';
    });
}
