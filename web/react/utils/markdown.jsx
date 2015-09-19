// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

const marked = require('marked');

export class MattermostMarkdownRenderer extends marked.Renderer {
    link(href, title, text) {
        if (href.lastIndexOf('http', 0) !== 0) {
            href = `http://${href}`;
        }

        return super.link(href, title, text);
    }
}
