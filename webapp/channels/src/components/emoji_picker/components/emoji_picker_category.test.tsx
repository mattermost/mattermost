// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen} from '@testing-library/react';
import React from 'react';

import type {Category} from 'components/emoji_picker/types';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

import EmojiPickerCategory from './emoji_picker_category';
import type {Props} from './emoji_picker_category';

const categoryMessage = 'category name';
const defaultProps: Props = {
    category: {
        name: 'recent',
        emojiIds: ['emojiId'],
        iconClassName: 'categoryClass',
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

        // TODO: Change when we actually disabled the element when enable is false
        expect(screen.getByRole('link')).toHaveClass('emoji-picker__category disable');
    });

    test('should have tooltip on hover', async () => {
        renderWithContext(<EmojiPickerCategory {...defaultProps}/>);

        await act(async () => {
            const emojiPickerCategory = screen.getByRole('link');
            userEvent.hover(emojiPickerCategory);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        });

        expect(screen.getByText(categoryMessage)).toBeVisible();
    });
});
