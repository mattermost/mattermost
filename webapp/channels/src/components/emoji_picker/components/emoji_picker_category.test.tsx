// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {Category} from 'components/emoji_picker/types';

import {renderWithContext} from 'tests/react_testing_utils';

import EmojiPickerCategory from './emoji_picker_category';
import type {Props} from './emoji_picker_category';

const defaultProps: Props = {
    category: {
        className: 'categoryClass',
        emojiIds: ['emojiId'],
        id: 'categoryId',
        message: 'categoryMessage',
        name: 'recent',
    } as Category,
    categoryRowIndex: 0,
    selected: false,
    enable: true,
    onClick: jest.fn(),
};

describe('EmojiPickerCategory', () => {
    test('should match snapshot', () => {
        const component = renderWithContext(<EmojiPickerCategory {...defaultProps}/>);
        expect(component).toMatchSnapshot();
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
});
