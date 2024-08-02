// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import marked from 'marked';

/** A Markdown renderer that converts a post into plain text */
export default class PlainRenderer extends marked.Renderer {
    public code() {
        // Code blocks can't contain mentions
        return '\n';
    }

    public blockquote(text: string) {
        return text + '\n';
    }

    public heading(text: string) {
        return text + '\n';
    }

    public hr() {
        return '\n';
    }

    public list(body: string) {
        return body + '\n';
    }

    public listitem(text: string) {
        return text + '\n';
    }

    public paragraph(text: string) {
        return text + '\n';
    }

    public table(header: string, body: string) {
        return header + '\n' + body;
    }

    public tablerow(content: string) {
        return content;
    }

    public tablecell(content: string) {
        return content + '\n';
    }

    public strong(text: string) {
        return ' ' + text + ' ';
    }

    public em(text: string) {
        return ' ' + text + ' ';
    }

    public codespan() {
        // Code spans can't contain mentions
        return ' ';
    }

    public br() {
        return '\n';
    }

    public del(text: string) {
        return ' ' + text + ' ';
    }

    public link(href: string, title: string, text: string) {
        return ' ' + text + ' ';
    }

    public image(href: string, title: string, text: string) {
        return ' ' + text + ' ';
    }

    public text(text: string) {
        return text;
    }
}
