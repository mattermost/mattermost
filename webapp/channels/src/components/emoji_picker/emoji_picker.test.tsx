// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider} from 'react-intl';

import {render, screen} from 'tests/react_testing_utils';

import EmojiMap from 'utils/emoji_map';

import EmojiPicker from './emoji_picker';

jest.mock('components/emoji_picker/components/emoji_picker_skin', () => () => (
    <div/>
));

describe('components/emoji_picker/EmojiPicker', () => {
    const intlProviderProps = {
        defaultLocale: 'en',
        locale: 'en',
    };

    const baseProps = {
        filter: '',
        visible: true,
        onEmojiClick: jest.fn(),
        handleFilterChange: jest.fn(),
        handleEmojiPickerClose: jest.fn(),
        customEmojisEnabled: false,
        customEmojiPage: 1,
        emojiMap: new EmojiMap(new Map()),
        recentEmojis: [],
        userSkinTone: 'default',
        currentTeamName: 'testTeam',
        actions: {
            getCustomEmojis: jest.fn(),
            incrementEmojiPickerPage: jest.fn(),
            searchCustomEmojis: jest.fn(),
            setUserSkinTone: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const {asFragment} = render(
            <IntlProvider {...intlProviderProps}>
                <EmojiPicker {...baseProps}/>
            </IntlProvider>,
        );

        expect(asFragment()).toMatchSnapshot();
    });

    test('Recent category should not exist if there are no recent emojis', () => {
        render(
            <IntlProvider {...intlProviderProps}>
                <EmojiPicker {...baseProps}/>
            </IntlProvider>,
        );

        expect(screen.queryByLabelText('emoji_picker.recent')).toBeNull();
    });

    test('Recent category should exist if there are recent emojis', () => {
        const props = {
            ...baseProps,
            recentEmojis: ['smile'],
        };

        render(
            <IntlProvider {...intlProviderProps}>
                <EmojiPicker {...props}/>
            </IntlProvider>,
        );

        expect(screen.queryByLabelText('emoji_picker.recent')).not.toBeNull();
    });
});
