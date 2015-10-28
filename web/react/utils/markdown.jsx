// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const TextFormatting = require('./text_formatting.jsx');
const Utils = require('./utils.jsx');

const marked = require('marked');

export class MattermostMarkdownRenderer extends marked.Renderer {
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
