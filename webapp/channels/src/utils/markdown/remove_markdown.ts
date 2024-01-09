// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import marked from 'marked';

import * as TextFormatting from 'utils/text_formatting';

export default class RemoveMarkdown extends marked.Renderer {
    public code(text: string) {
        // We need to escape the input here because our version of marked does this in the renderer. Every other node
        // type has its input escaped before it reaches the renderer.
        return TextFormatting.escapeHtml(text).replace(/\n/g, ' ');
    }

    public blockquote(text: string) {
        return text.replace(/\n/g, ' ');
    }

    public heading(text: string) {
        return text + ' ';
    }

    public hr() {
        return '';
    }

    public list(body: string) {
        return body;
    }

    public listitem(text: string) {
        return text + ' ';
    }

    public paragraph(text: string) {
        return text + ' ';
    }

    public table() {
        return '';
    }

    public tablerow() {
        return '';
    }

    public tablecell() {
        return '';
    }

    public strong(text: string) {
        return text;
    }

    public em(text: string) {
        return text;
    }

    public codespan(text: string) {
        return text.replace(/\n/g, ' ');
    }

    public br() {
        return ' ';
    }

    public del(text: string) {
        return text;
    }

    public link(href: string, title: string, text: string) {
        return text;
    }

    public image(href: string, title: string, text: string) {
        return text;
    }

    public text(text: string) {
        return text.replace('\n', ' ');
    }
}
