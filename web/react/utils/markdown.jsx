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

export class MattermostMarkdownRenderer extends marked.Renderer {
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
            return '<code class="hljs">' + $(parsed).text() + '</code>';
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

        if (!(/^(mailto|https?|ftp)/.test(outHref))) {
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

        output += text + '</a>';

        return output;
    }

    paragraph(text) {
        let outText = text;

        if (!('emoticons' in this.options) || this.options.emoticon) {
            outText = TextFormatting.doFormatEmoticons(text);
        }

        if (this.formattingOptions.singleline) {
            return `<p class="markdown__paragraph-inline">${outText}</p>`;
        }

        return super.paragraph(outText);
    }

    table(header, body) {
        return `<table class="markdown__table"><thead>${header}</thead><tbody>${body}</tbody></table>`;
    }

    text(text) {
        return TextFormatting.doFormatText(text, this.formattingOptions);
    }
}
