// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import EmojiPickerHeader from 'components/emoji_picker/components/emoji_picker_header';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

describe('components/emoji_picker/components/EmojiPickerHeader', () => {
    test('handleEmojiPickerClose, should have called props.handleEmojiPickerClose', async () => {
        const props = {
            handleEmojiPickerClose: jest.fn(),
        };

        renderWithContext(
            <EmojiPickerHeader {...props}/>,
        );

        await userEvent.click(screen.getAllByRole('button')[0]);
        expect(props.handleEmojiPickerClose).toHaveBeenCalledTimes(1);
    });
});
