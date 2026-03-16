// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Extension} from '@tiptap/core';

// Mattermost's server-side markdown parser doesn't support lazy continuation
// in list items. A non-indented line after a list item ends the list, while
// standard CommonMark would continue the item's paragraph.
//
// This extension hooks into the Markdown extension's internal marked instance
// and overrides the list tokenizer to always break on non-indented lines,
// matching the server's rendering behavior. This is a fork of marked v17's
// Tokenizer.list() method with one change: the lazy continuation branch
// (itemContents += '\n' + nextLine) is replaced with a break.

function expandTabs(line: string, indent = 0): string {
    let col = indent;
    let expanded = '';
    for (const char of line) {
        if (char === '\t') {
            const added = 4 - (col % 4);
            expanded += ' '.repeat(added);
            col += added;
        } else {
            expanded += char;
            col++;
        }
    }
    return expanded;
}

// Forked list tokenizer from marked v17.0.3 — the only change from upstream
// is removing the lazy paragraph continuation in the else branch, replacing
// it with a break statement.
function mattermostListTokenizer(this: any, src: string) {
    let cap = this.rules.block.list.exec(src);
    if (!cap) {
        return undefined;
    }

    let bull: string = cap[1].trim();
    const isordered = bull.length > 1;

    const list: any = {
        type: 'list',
        raw: '',
        ordered: isordered,
        start: isordered ? +bull.slice(0, -1) : '',
        loose: false,
        items: [],
    };

    bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;

    if (this.options.pedantic) {
        bull = isordered ? bull : '[*+-]';
    }

    const itemRegex = this.rules.other.listItemRegex(bull);
    let endsWithBlankLine = false;

    while (src) {
        let endEarly = false;
        let raw = '';
        let itemContents = '';
        if (!(cap = itemRegex.exec(src))) {
            break;
        }

        if (this.rules.block.hr.test(src)) {
            break;
        }

        raw = cap[0];
        src = src.substring(raw.length);

        let line = expandTabs(cap[2].split('\n', 1)[0], cap[1].length);
        let nextLine = src.split('\n', 1)[0];
        let blankLine = !line.trim();

        let indent = 0;
        if (this.options.pedantic) {
            indent = 2;
            itemContents = line.trimStart();
        } else if (blankLine) {
            indent = cap[1].length + 1;
        } else {
            indent = line.search(this.rules.other.nonSpaceChar);
            indent = indent > 4 ? 1 : indent;
            itemContents = line.slice(indent);
            indent += cap[1].length;
        }

        if (blankLine && this.rules.other.blankLine.test(nextLine)) {
            raw += nextLine + '\n';
            src = src.substring(nextLine.length + 1);
            endEarly = true;
        }

        if (!endEarly) {
            const nextBulletRegex = this.rules.other.nextBulletRegex(indent);
            const hrRegex = this.rules.other.hrRegex(indent);
            const fencesBeginRegex = this.rules.other.fencesBeginRegex(indent);
            const headingBeginRegex = this.rules.other.headingBeginRegex(indent);
            const htmlBeginRegex = this.rules.other.htmlBeginRegex(indent);
            const blockquoteBeginRegex = this.rules.other.blockquoteBeginRegex(indent);

            while (src) {
                const rawLine = src.split('\n', 1)[0];
                let nextLineWithoutTabs;
                nextLine = rawLine;

                if (this.options.pedantic) {
                    nextLine = nextLine.replace(this.rules.other.listReplaceNesting, '  ');
                    nextLineWithoutTabs = nextLine;
                } else {
                    nextLineWithoutTabs = nextLine.replace(this.rules.other.tabCharGlobal, '    ');
                }

                if (fencesBeginRegex.test(nextLine)) {
                    break;
                }
                if (headingBeginRegex.test(nextLine)) {
                    break;
                }
                if (htmlBeginRegex.test(nextLine)) {
                    break;
                }
                if (blockquoteBeginRegex.test(nextLine)) {
                    break;
                }
                if (nextBulletRegex.test(nextLine)) {
                    break;
                }
                if (hrRegex.test(nextLine)) {
                    break;
                }

                if (nextLineWithoutTabs.search(this.rules.other.nonSpaceChar) >= indent || !nextLine.trim()) {
                    itemContents += '\n' + nextLineWithoutTabs.slice(indent);
                } else {
                    // MATTERMOST FORK: always break on under-indented lines.
                    // Standard marked does lazy paragraph continuation here,
                    // but Mattermost's server parser ends the list item.
                    break;
                }

                blankLine = !nextLine.trim();

                raw += rawLine + '\n';
                src = src.substring(rawLine.length + 1);
                line = nextLineWithoutTabs.slice(indent);
            }
        }

        if (!list.loose) {
            if (endsWithBlankLine) {
                list.loose = true;
            } else if (this.rules.other.doubleBlankLine.test(raw)) {
                endsWithBlankLine = true;
            }
        }

        list.items.push({
            type: 'list_item',
            raw,
            task: Boolean(this.options.gfm) && this.rules.other.listIsTask.test(itemContents),
            loose: false,
            text: itemContents,
            tokens: [],
        });

        list.raw += raw;
    }

    const lastItem = list.items.at(-1);
    if (lastItem) {
        lastItem.raw = lastItem.raw.trimEnd();
        lastItem.text = lastItem.text.trimEnd();
    } else {
        return undefined;
    }
    list.raw = list.raw.trimEnd();

    for (const item of list.items) {
        this.lexer.state.top = false;
        item.tokens = this.lexer.blockTokens(item.text, []);
        if (item.task) {
            item.text = item.text.replace(this.rules.other.listReplaceTask, '');
            if (item.tokens[0]?.type === 'text' || item.tokens[0]?.type === 'paragraph') {
                item.tokens[0].raw = item.tokens[0].raw.replace(this.rules.other.listReplaceTask, '');
                item.tokens[0].text = item.tokens[0].text.replace(this.rules.other.listReplaceTask, '');
                for (let i = this.lexer.inlineQueue.length - 1; i >= 0; i--) {
                    if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[i].src)) {
                        this.lexer.inlineQueue[i].src = this.lexer.inlineQueue[i].src.replace(this.rules.other.listReplaceTask, '');
                        break;
                    }
                }
            }

            const taskRaw = this.rules.other.listTaskCheckbox.exec(item.raw);
            if (taskRaw) {
                const checkbox: any = {
                    type: 'checkbox',
                    raw: taskRaw[0] + ' ',
                    checked: taskRaw[0] !== '[ ]',
                };
                item.checked = checkbox.checked;
                if (list.loose) {
                    if (
                        item.tokens[0] &&
                        ['paragraph', 'text'].includes(item.tokens[0].type) &&
                        'tokens' in item.tokens[0] &&
                        item.tokens[0].tokens
                    ) {
                        item.tokens[0].raw = checkbox.raw + item.tokens[0].raw;
                        item.tokens[0].text = checkbox.raw + item.tokens[0].text;
                        item.tokens[0].tokens.unshift(checkbox);
                    } else {
                        item.tokens.unshift({
                            type: 'paragraph',
                            raw: checkbox.raw,
                            text: checkbox.raw,
                            tokens: [checkbox],
                        });
                    }
                } else {
                    item.tokens.unshift(checkbox);
                }
            }
        }

        if (!list.loose) {
            const spacers = item.tokens.filter((t: any) => t.type === 'space');
            const hasMultipleLineEndings = spacers.length > 0 && spacers.some((t: any) => this.rules.other.anyLine.test(t.raw));
            list.loose = hasMultipleLineEndings;
        }
    }

    if (list.loose) {
        for (const item of list.items) {
            item.loose = true;
            for (const tok of item.tokens) {
                if (tok.type === 'text') {
                    tok.type = 'paragraph';
                }
            }
        }
    }

    return list;
}

export const MattermostListCompat = Extension.create({
    name: 'mattermostListCompat',

    onCreate() {
        const md = this.editor.markdown;
        if (!md) {
            return;
        }

        const markedInstance = md.instance;
        if (!markedInstance?.use) {
            return;
        }

        markedInstance.use({
            tokenizer: {
                list: mattermostListTokenizer,
            },
        });
    },
});
