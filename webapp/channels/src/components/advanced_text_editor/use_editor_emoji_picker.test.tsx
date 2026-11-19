// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import useEditorEmojiPicker from './use_editor_emoji_picker';

jest.mock('components/emoji_picker/emoji_picker_tabs', () => () => <div className='emoji-picker'>{'picker'}</div>);

function rect(top: number, left: number): DOMRect {
    return {
        top,
        left,
        right: left + 32,
        bottom: top + 32,
        width: 32,
        height: 32,
        x: left,
        y: top,
        toJSON: () => '',
    } as DOMRect;
}

function Harness() {
    const picker = useEditorEmojiPicker('post_textbox', false, false);
    return (
        <>
            <button
                type='button'
                onClick={picker.openEmojiPickerFromMenu}
            >
                {'Open from menu'}
            </button>
            {picker.emojiPickerPortal}
        </>
    );
}

describe('useEditorEmojiPicker', () => {
    const state = {
        entities: {
            general: {
                config: {
                    EnableEmojiPicker: 'true',
                },
            },
        },
    };

    it('anchors to the plus button that exists when the picker opens', async () => {
        const portal = document.createElement('div');
        portal.id = 'root-portal';
        const textbox = document.createElement('textarea');
        textbox.id = 'post_textbox';
        textbox.getBoundingClientRect = () => ({
            top: 80,
            left: 40,
            right: 760,
            bottom: 520,
            width: 720,
            height: 440,
            x: 40,
            y: 80,
            toJSON: () => '',
        } as DOMRect);
        let detachedReads = 0;
        let liveReads = 0;
        const detached = document.createElement('button');
        detached.getBoundingClientRect = () => {
            detachedReads += 1;
            return rect(0, 0);
        };
        const live = document.createElement('button');
        live.id = 'agentComposerMenuButton';
        live.getBoundingClientRect = () => {
            liveReads += 1;
            return rect(400, 80);
        };
        document.body.append(portal, textbox, live);

        const realGetElementById = document.getElementById.bind(document);
        let buttonReads = 0;
        const spy = jest.spyOn(document, 'getElementById').mockImplementation((id: string) => {
            if (id === 'agentComposerMenuButton') {
                buttonReads += 1;

                // The close handler can still be holding the button the menu
                // unmounted. The open has to read again and use the new one.
                return buttonReads === 1 ? detached : live;
            }
            return realGetElementById(id);
        });

        try {
            renderWithContext(<Harness/>, state);
            await userEvent.click(screen.getByRole('button', {name: 'Open from menu'}));

            const surface = await waitFor(() => {
                const node = document.querySelector('.emoji-picker-surface');
                expect(node).toBeInTheDocument();
                return node as HTMLElement;
            });
            expect(surface).toHaveClass('emoji-picker-surface--origin-bottom-left');

            // The first lookup can still be the button the menu detached.
            // The picker measures the button that is in the document when it opens.
            await waitFor(() => {
                expect(liveReads).toBeGreaterThan(0);
            });
            expect(buttonReads).toBeGreaterThan(1);
            expect(detachedReads).toBe(0);
        } finally {
            spy.mockRestore();
            portal.remove();
            textbox.remove();
            live.remove();
            detached.remove();
        }
    });
});
