// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const TextFormatting = require('./text_formatting.jsx');
const Utils = require('./utils.jsx');

const marked = require('marked');

class MattermostInlineLexer extends marked.InlineLexer {
    constructor(links, options) {
        super(links, options);

        // modified version of the regex that doesn't break up words in snake_case
        // the original is /^[\s\S]+?(?=[\\<!\[_*`]| {2,}\n|$)/
        this.rules.text = /^[\s\S]+?(?=__|\b_|[\\<!\[*`]| {2,}\n|$)/;
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

        // required so markdown does not strip '_' from @user_names
        outText = TextFormatting.doFormatMentions(text);

        if (!('emoticons' in this.options) || this.options.emoticon) {
            outText = TextFormatting.doFormatEmoticons(outText);
        }

        if (this.formattingOptions.singleline) {
            return `<p class="markdown__paragraph-inline">${outText}</p>`;
        }

        return super.paragraph(outText);
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
        sanitize: true
    };

    const tokens = marked.lexer(text, markdownOptions);

    return new MattermostParser(markdownOptions).parse(tokens);
}

