// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Extension} from '@tiptap/core';

// Mattermost's server-side markdown parser doesnt support lazy continuation
// in list items. A non-indented line after a list item ends the list, while
// standard markdown would continue the item's paragraph.

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
            walkTokens(token: {type: string; items?: Array<{raw?: string; text?: string; tokens?: unknown[]}>}) {
                if (token.type !== 'list' || !token.items) {
                    return;
                }

                for (const item of token.items) {
                    if (!item.raw) {
                        continue;
                    }

                    const lines = item.raw.split('\n');
                    if (lines.length <= 1) {
                        continue;
                    }

                    // Determine required indentation from the list marker.
                    const markerMatch = lines[0].match(/^(\s*(?:[-+*]|\d{1,9}[.)]))(\s+(?:\[[ xX]\]\s+)?)/);
                    if (!markerMatch) {
                        continue;
                    }

                    const requiredIndent = markerMatch[0].length;

                    // Keep lines that are blank or indented enough.
                    let keepUntil = lines.length;
                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i];
                        if (line.trim() === '') {
                            continue;
                        }
                        const lineIndent = line.length - line.trimStart().length;
                        if (lineIndent < requiredIndent) {
                            keepUntil = i;
                            break;
                        }
                    }

                    if (keepUntil < lines.length) {
                        const keptLines = lines.slice(0, keepUntil);
                        while (keptLines.length > 1 && keptLines[keptLines.length - 1].trim() === '') {
                            keptLines.pop();
                        }

                        item.raw = keptLines.join('\n') + '\n';
                        item.text = keptLines.slice(1).join('\n').trim();

                        if (markedInstance.Lexer?.lexInline) {
                            item.tokens = markedInstance.Lexer.lexInline(item.text) as unknown[];
                        }
                    }
                }
            },
        });
    },
});
