// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

const marked = require('marked');

export class MattermostMarkdownRenderer extends marked.Renderer {
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
}
