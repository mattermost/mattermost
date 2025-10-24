// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Editor} from '@tiptap/core';
import {Mention} from '@tiptap/extension-mention';
import StarterKit from '@tiptap/starter-kit';

/**
 * Extract plaintext from TipTap JSON for search indexing.
 * Only called when publishing a page (not on draft saves).
 */
export function extractPlaintextFromTipTapJSON(jsonString: string): string {
    if (!jsonString || jsonString.trim() === '') {
        return '';
    }

    try {
        const jsonContent = JSON.parse(jsonString);

        // Create a temporary editor to extract text
        const tempEditor = new Editor({
            extensions: [
                StarterKit,
                Mention.configure({
                    HTMLAttributes: {
                        class: 'mention',
                    },
                }),
            ],
            content: jsonContent,
            editable: false,
        });

        const plaintext = tempEditor.getText({blockSeparator: '\n\n'});
        tempEditor.destroy();

        return plaintext;
    } catch (error) {
        return '';
    }
}
