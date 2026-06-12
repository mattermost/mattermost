// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Node as ProseMirrorNode} from '@tiptap/pm/model';

export type ResolvedPosition = {
    from: number;
    to: number;
};

/**
 * Find text in the document and return its position.
 * Returns null if text not found (orphaned anchor).
 */
export function findTextPosition(
    doc: ProseMirrorNode,
    text: string,
): ResolvedPosition | null {
    if (!text) {
        return null;
    }

    let result: ResolvedPosition | null = null;

    doc.descendants((node, pos) => {
        if (result) {
            return false;
        }

        if (node.isText && node.text) {
            const idx = node.text.indexOf(text);
            if (idx !== -1) {
                result = {from: pos + idx, to: pos + idx + text.length};
                return false;
            }
        }
        return true;
    });

    return result;
}
