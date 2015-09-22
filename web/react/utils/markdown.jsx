// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

const TextFormatting = require('./text_formatting.jsx');

const marked = require('marked');

export class MattermostMarkdownRenderer extends marked.Renderer {
    constructor(options, formattingOptions = {}) {
        super(options);

        this.text = this.text.bind(this);

        this.formattingOptions = formattingOptions;
    }
    link(href, title, text) {
        let outHref = href;

        if (outHref.lastIndexOf('http', 0) !== 0) {
            outHref = `http://${outHref}`;
        }

        let output = '<a class="theme" href="' + outHref + '"';
        if (title) {
            output += ' title="' + title + '"';
        }
        output += '>' + text + '</a>';

        return output;
    }

    text(text) {
        return TextFormatting.doFormatText(text, this.formattingOptions);
    }
}
