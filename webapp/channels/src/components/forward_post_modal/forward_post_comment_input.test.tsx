// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {fireEvent, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';

import ForwardPostCommentInput from './forward_post_comment_input';

describe('components/forward_post_modal/forward_post_comment_input', () => {
    const onChange = jest.fn();

    function ControlledInput() {
        const [comment, setComment] = useState('comment here');

        return (
            <ForwardPostCommentInput
                channelId='channel_id'
                canForwardPost={true}
                comment={comment}
                permaLinkLength={0}
                onChange={(value) => {
                    onChange(value);
                    setComment(value);
                }}
                onError={jest.fn()}
                onSubmit={jest.fn()}
                onHeightChange={jest.fn()}
            />
        );
    }

    function renderInput() {
        renderWithContext(<ControlledInput/>);
        const textbox = screen.getByRole<HTMLTextAreaElement>('textbox');
        textbox.focus();
        textbox.setSelectionRange(8, 12);
        return textbox;
    }

    beforeEach(() => {
        onChange.mockClear();
    });

    test('should apply bold with the keyboard shortcut through the browser edit history', async () => {
        const execCommand = jest.spyOn(document, 'execCommand').mockImplementation((command, _showUI, text = '') => {
            const target = document.activeElement as HTMLTextAreaElement;
            target.setRangeText(command === 'delete' ? '' : text, target.selectionStart, target.selectionEnd, 'end');
            target.dispatchEvent(new Event('input', {bubbles: true}));
            return true;
        });

        try {
            const textbox = renderInput();

            fireEvent.keyDown(textbox, {key: 'b', keyCode: 66, ctrlKey: true});

            expect(execCommand).toHaveBeenCalledWith('insertText', false, '**here**');
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith('comment **here**');
            expect(textbox.value).toBe('comment **here**');
            await waitFor(() => expect(textbox.value.slice(textbox.selectionStart, textbox.selectionEnd)).toBe('here'));
        } finally {
            execCommand.mockRestore();
        }
    });

    test('should fall back to updating the comment when the browser does not apply the edit', () => {
        const textbox = renderInput();

        fireEvent.keyDown(textbox, {key: 'b', keyCode: 66, ctrlKey: true});

        expect(onChange).toHaveBeenCalledWith('comment **here**');
        expect(textbox.value).toBe('comment **here**');
    });
});
