// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {SystemEmoji} from '@mattermost/types/emojis';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import EmojiMap from 'utils/emoji_map';

import EmojiPicker from './emoji_picker';

jest.mock('components/emoji_picker/components/emoji_picker_skin', () => () => (
    <div/>
));
jest.mock('components/emoji_picker/components/emoji_picker_preview', () => ({emoji}: {emoji?: SystemEmoji}) => (
    <div className='emoji-picker__preview'>{`Preview for ${emoji?.short_name} emoji`}</div>
));

describe('components/emoji_picker/EmojiPicker', () => {
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
        const {asFragment} = renderWithContext(
            <EmojiPicker {...baseProps}/>,
        );

        expect(asFragment()).toMatchSnapshot();
    });

    test('Recent category should not exist if there are no recent emojis', () => {
        renderWithContext(
            <EmojiPicker {...baseProps}/>,
        );

        expect(screen.queryByLabelText('Recent')).toBeNull();
    });

    test('Recent category should exist if there are recent emojis', () => {
        const props = {
            ...baseProps,
            recentEmojis: ['smile'],
        };

        renderWithContext(
            <EmojiPicker {...props}/>,
        );

        expect(screen.queryByLabelText('Recent')).not.toBeNull();
    });

    test('First emoji should be selected on search', () => {
        const props = {
            ...baseProps,
            filter: 'wave',
        };

        renderWithContext(
            <EmojiPicker {...props}/>,
        );

        expect(screen.queryByText('Preview for wave emoji')).not.toBeNull();
    });
});
