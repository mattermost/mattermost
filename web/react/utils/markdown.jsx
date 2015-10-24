// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const TextFormatting = require('./text_formatting.jsx');
const Utils = require('./utils.jsx');

const marked = require('marked');

const highlightJs = require('highlight.js/lib/highlight.js');
const highlightJsDiff = require('highlight.js/lib/languages/diff.js');
const highlightJsApache = require('highlight.js/lib/languages/apache.js');
const highlightJsMakefile = require('highlight.js/lib/languages/makefile.js');
const highlightJsHttp = require('highlight.js/lib/languages/http.js');
const highlightJsJson = require('highlight.js/lib/languages/json.js');
const highlightJsMarkdown = require('highlight.js/lib/languages/markdown.js');
const highlightJsJavascript = require('highlight.js/lib/languages/javascript.js');
const highlightJsCss = require('highlight.js/lib/languages/css.js');
const highlightJsNginx = require('highlight.js/lib/languages/nginx.js');
const highlightJsObjectivec = require('highlight.js/lib/languages/objectivec.js');
const highlightJsPython = require('highlight.js/lib/languages/python.js');
const highlightJsXml = require('highlight.js/lib/languages/xml.js');
const highlightJsPerl = require('highlight.js/lib/languages/perl.js');
const highlightJsBash = require('highlight.js/lib/languages/bash.js');
const highlightJsPhp = require('highlight.js/lib/languages/php.js');
const highlightJsCoffeescript = require('highlight.js/lib/languages/coffeescript.js');
const highlightJsCs = require('highlight.js/lib/languages/cs.js');
const highlightJsCpp = require('highlight.js/lib/languages/cpp.js');
const highlightJsSql = require('highlight.js/lib/languages/sql.js');
const highlightJsGo = require('highlight.js/lib/languages/go.js');
const highlightJsRuby = require('highlight.js/lib/languages/ruby.js');

const Constants = require('../utils/constants.jsx');
const HighlightedLanguages = Constants.HighlightedLanguages;

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

        highlightJs.registerLanguage('diff', highlightJsDiff);
        highlightJs.registerLanguage('apache', highlightJsApache);
        highlightJs.registerLanguage('makefile', highlightJsMakefile);
        highlightJs.registerLanguage('http', highlightJsHttp);
        highlightJs.registerLanguage('json', highlightJsJson);
        highlightJs.registerLanguage('markdown', highlightJsMarkdown);
        highlightJs.registerLanguage('javascript', highlightJsJavascript);
        highlightJs.registerLanguage('css', highlightJsCss);
        highlightJs.registerLanguage('nginx', highlightJsNginx);
        highlightJs.registerLanguage('objectivec', highlightJsObjectivec);
        highlightJs.registerLanguage('python', highlightJsPython);
        highlightJs.registerLanguage('xml', highlightJsXml);
        highlightJs.registerLanguage('perl', highlightJsPerl);
        highlightJs.registerLanguage('bash', highlightJsBash);
        highlightJs.registerLanguage('php', highlightJsPhp);
        highlightJs.registerLanguage('coffeescript', highlightJsCoffeescript);
        highlightJs.registerLanguage('cs', highlightJsCs);
        highlightJs.registerLanguage('cpp', highlightJsCpp);
        highlightJs.registerLanguage('sql', highlightJsSql);
        highlightJs.registerLanguage('go', highlightJsGo);
        highlightJs.registerLanguage('ruby', highlightJsRuby);
    }

    code(code, language) {
        if (!language || highlightJs.listLanguages().indexOf(language) < 0) {
            let parsed = super.code(code, language);
            return '<code class="hljs">' + parsed.substr(11, parsed.length - 17);
        }

        let parsed = highlightJs.highlight(language, code);
        return '<div class="post-body--code">' +
            '<span class="post-body--code__language">' + HighlightedLanguages[language] + '</span>' +
            '<code style="white-space: pre;" class="hljs">' + parsed.value + '</code>' +
            '</div>';
    }

    br() {
        if (this.formattingOptions.singleline) {
            return ' ';
        }

        return super.br();
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
        gfm: true
    };

    const tokens = marked.lexer(text, markdownOptions);

    return new MattermostParser(markdownOptions).parse(tokens);
}

