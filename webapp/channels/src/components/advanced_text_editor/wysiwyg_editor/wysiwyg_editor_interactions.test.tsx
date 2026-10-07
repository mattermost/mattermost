// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
import type {Editor} from '@tiptap/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import WysiwygEditor from './wysiwyg_editor';
import type {WysiwygEditorHandle} from './wysiwyg_editor';

const press = (editor: Editor, key: string, init: KeyboardEventInit = {}) => act(() => {
    const event = new KeyboardEvent('keydown', {key, cancelable: true, ...init});
    editor.view.someProp('handleKeyDown', (handler) => handler(editor.view, event));
});

const typeText = (editor: Editor, text: string) => act(() => {
    editor.view.dispatch(editor.state.tr.insertText(text));
});

const endOfText = (editor: Editor, text: string) => {
    let pos = -1;
    editor.state.doc.descendants((node, nodePos) => {
        if (node.isText && node.text === text) {
            pos = nodePos + text.length;
        }
    });
    return pos;
};

const baseProps = {
    onChange: jest.fn(),
    onSubmit: jest.fn(),
};

describe('WysiwygEditor interactions', () => {
    beforeAll(() => {
        document.elementFromPoint = () => null;
    });

    const renderEditor = (value: string, channelId = 'c1') => {
        const ref = React.createRef<WysiwygEditorHandle>();
        const utils = renderWithContext(
            <WysiwygEditor
                ref={ref}
                {...baseProps}
                value={value}
                channelId={channelId}
            />,
        );
        return {...utils, ref, editor: ref.current!.getEditor()!};
    };

    describe('Shift+Enter inside a quote', () => {
        test('starts a new quoted line', () => {
            const {editor} = renderEditor('> my quote');
            act(() => {
                editor.commands.setTextSelection(endOfText(editor, 'my quote'));
            });

            press(editor, 'Enter', {shiftKey: true});
            typeText(editor, 'line two');

            expect(editor.getHTML()).toContain('<blockquote><p>my quote</p><p>line two</p></blockquote>');
        });

        test('leaves the quote when pressed on an empty quoted line', () => {
            const {editor} = renderEditor('> my quote');
            act(() => {
                editor.commands.setTextSelection(endOfText(editor, 'my quote'));
            });

            press(editor, 'Enter', {shiftKey: true});
            press(editor, 'Enter', {shiftKey: true});
            typeText(editor, 'below');

            expect(editor.getHTML()).toContain('<blockquote><p>my quote</p></blockquote><p>below</p>');
        });
    });

    describe('switching channels', () => {
        const switchTo = (rerender: (ui: React.ReactElement) => void, ref: React.RefObject<WysiwygEditorHandle | null>, value: string, channelId: string) => {
            rerender(
                <WysiwygEditor
                    ref={ref}
                    {...baseProps}
                    value={value}
                    channelId={channelId}
                />,
            );
        };

        test('loads the draft of the channel being switched to', () => {
            const {editor, rerender, ref} = renderEditor('first channel', 'c1');

            switchTo(rerender, ref, 'second channel', 'c2');

            expect(editor.getHTML()).toBe('<p>second channel</p>');
        });

        test('does not carry formatting toggled in an empty composer over to the next channel', () => {
            const {editor, rerender, ref} = renderEditor('', 'c1');
            act(() => {
                editor.chain().setTextSelection(1).toggleBold().run();
            });
            expect(editor.state.storedMarks?.map((mark) => mark.type.name)).toEqual(['bold']);

            switchTo(rerender, ref, '', 'c2');
            act(() => {
                editor.commands.setTextSelection(1);
            });
            typeText(editor, 'hi');

            expect(editor.getHTML()).toBe('<p>hi</p>');
        });

        test('keeps the content when only the value changes within the same channel', () => {
            const {editor, rerender, ref} = renderEditor('typed text', 'c1');

            switchTo(rerender, ref, 'typed text more', 'c1');

            expect(editor.getHTML()).toBe('<p>typed text</p>');
        });
    });
});
