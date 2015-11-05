// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

require('./highlight.jsx');
const TextFormatting = require('./text_formatting.jsx');
const Utils = require('./utils.jsx');

const highlightJs = require('highlight.js/lib/highlight.js');
const marked = require('marked');

const HighlightedLanguages = require('../utils/constants.jsx').HighlightedLanguages;

function markdownImageLoaded(image) {
    image.style.height = 'auto';
}
window.markdownImageLoaded = markdownImageLoaded;

class MattermostInlineLexer extends marked.InlineLexer {
    constructor(links, options) {
        super(links, options);

        this.rules = Object.assign({}, this.rules);

        // modified version of the regex that doesn't break up words in snake_case,
        // allows for links starting with www, and allows links succounded by parentheses
        // the original is /^[\s\S]+?(?=[\\<!\[_*`~]|https?:\/\/| {2,}\n|$)/
        this.rules.text = /^[\s\S]+?(?=[^\w\/]_|[\\<!\[*`~]|https?:\/\/|www\.|\(| {2,}\n|$)/;

        // modified version of the regex that allows links starting with www and those surrounded
        // by parentheses
        // the original is /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/
        this.rules.url = /^(\(?(?:https?:\/\/|www\.)[^\s<.][^\s<]*[^<.,:;"'\]\s])/;

        // modified version of the regex that allows <links> starting with www.
        // the original is /^<([^ >]+(@|:\/)[^ >]+)>/
        this.rules.autolink = /^<((?:[^ >]+(@|:\/)|www\.)[^ >]+)>/;
    }
}

class MattermostParser extends marked.Parser {
    parse(src) {
        this.inline = new MattermostInlineLexer(src.links, this.options, this.renderer);
        this.tokens = src.reverse();

        var out = '';
        while (this.next()) {
            out += this.tok();
        }

        return out;
    }
}

class MattermostMarkdownRenderer extends marked.Renderer {
    constructor(options, formattingOptions = {}) {
        super(options);

        this.heading = this.heading.bind(this);
        this.paragraph = this.paragraph.bind(this);
        this.text = this.text.bind(this);

        this.formattingOptions = formattingOptions;
    }

    code(code, language) {
        let usedLanguage = language;

        if (String(usedLanguage).toLocaleLowerCase() === 'html') {
            usedLanguage = 'xml';
        }

        if (!usedLanguage || highlightJs.listLanguages().indexOf(usedLanguage) < 0) {
            let parsed = super.code(code, usedLanguage);
            return '<div class="post-body--code"><code class="hljs">' + TextFormatting.sanitizeHtml($(parsed).text()) + '</code></div>';
        }

        let parsed = highlightJs.highlight(usedLanguage, code);
        return '<div class="post-body--code">' +
            '<span class="post-body--code__language">' + HighlightedLanguages[usedLanguage] + '</span>' +
            '<code class="hljs">' + parsed.value + '</code>' +
            '</div>';
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
        out += ' onload="window.markdownImageLoaded(this)" class="markdown-inline-img"';
        out += this.options.xhtml ? '/>' : '>';
        return out;
    }

    heading(text, level, raw) {
        const id = `${this.options.headerPrefix}${raw.toLowerCase().replace(/[^\w]+/g, '-')}`;
        return `<h${level} id="${id}" class="markdown__heading">${text}</h${level}>`;
    }

    link(href, title, text) {
        let outHref = href;
        let outText = text;
        let prefix = '';
        let suffix = '';

        // some links like https://en.wikipedia.org/wiki/Rendering_(computer_graphics) contain brackets
        // and we try our best to differentiate those from ones just wrapped in brackets when autolinking
        if (outHref.startsWith('(') && outHref.endsWith(')') && text === outHref) {
            prefix = '(';
            suffix = ')';
            outText = text.substring(1, text.length - 1);
            outHref = outHref.substring(1, outHref.length - 1);
        }

        if (!(/[a-z+.-]+:/i).test(outHref)) {
            outHref = `http://${outHref}`;
        }

        let output = '<a class="theme markdown__link" href="' + outHref + '"';
        if (title) {
            output += ' title="' + title + '"';
        }

        if (outHref.lastIndexOf(Utils.getTeamURLFromAddressBar(), 0) === 0) {
            output += '>';
        } else {
            output += ' target="_blank">';
        }

        output += outText + '</a>';

        return prefix + output + suffix;
    }

    paragraph(text) {
        if (this.formattingOptions.singleline) {
            return `<p class="markdown__paragraph-inline">${text}</p>`;
        }

        return super.paragraph(text);
    }

    table(header, body) {
        return `<table class="markdown__table"><thead>${header}</thead><tbody>${body}</tbody></table>`;
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

    const tokens = marked.lexer(text, markdownOptions);

    return new MattermostParser(markdownOptions).parse(tokens);
}

