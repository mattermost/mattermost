// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, waitFor} from '@testing-library/react';
import React from 'react';

import {EmoticonHappyOutlineIcon} from '@mattermost/compass-icons/components';

import type {Category} from 'components/emoji_picker/types';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

import EmojiPickerCategory from './emoji_picker_category';
import type {Props} from './emoji_picker_category';

const categoryMessage = 'category name';
const defaultProps: Props = {
    category: {
        name: 'recent',
        emojiIds: ['emojiId'],
        icon: EmoticonHappyOutlineIcon,
        label: {
            id: 'categoryId',
            defaultMessage: categoryMessage,
        },
    } as Category,
    categoryRowIndex: 0,
    selected: false,
    enable: true,
    onClick: jest.fn(),
};

describe('EmojiPickerCategory', () => {
    test('should match snapshot', () => {
        const {asFragment} = renderWithContext(<EmojiPickerCategory {...defaultProps}/>);
        expect(asFragment()).toMatchSnapshot();
    });

    test('should be disabled when prop is passed disabled', () => {
        const props = {
            ...defaultProps,
            enable: false,
        };

        renderWithContext(<EmojiPickerCategory {...props}/>);

        expect(screen.getByRole('button')).toBeDisabled();
        expect(screen.getByRole('button')).toHaveClass('emoji-picker__category disable');
    });

    test('should have tooltip on hover', async () => {
        renderWithContext(<EmojiPickerCategory {...defaultProps}/>);

        const emojiPickerCategory = screen.getByRole('button');
        await userEvent.hover(emojiPickerCategory);

        await waitFor(() => {
            expect(screen.getByText(categoryMessage)).toBeVisible();
        });
    });
});
