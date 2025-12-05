// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import EmojiPickerHeader from 'components/emoji_picker/components/emoji_picker_header';

import {renderWithIntl, screen, fireEvent} from 'tests/vitest_react_testing_utils';

describe('components/emoji_picker/components/EmojiPickerHeader', () => {
    test('should match snapshot, ', () => {
        const props = {
            handleEmojiPickerClose: vi.fn(),
        };

        const {container} = renderWithIntl(
            <EmojiPickerHeader {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });
    test('handleEmojiPickerClose, should have called props.handleEmojiPickerClose', () => {
        const props = {
            handleEmojiPickerClose: vi.fn(),
        };

        const {container} = renderWithIntl(
            <EmojiPickerHeader {...props}/>,
        );

        expect(container).toMatchSnapshot();

        fireEvent.click(screen.getByRole('button'));
        expect(props.handleEmojiPickerClose).toHaveBeenCalledTimes(1);
    });
});
