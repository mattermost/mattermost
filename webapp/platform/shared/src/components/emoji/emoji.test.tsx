// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import {Emoji} from './emoji';

import {renderWithContext} from '../../testing';

import '@testing-library/jest-dom';

describe('Emoji', () => {
    test('should render nothing when no emoji name is provided', () => {
        renderWithContext(
            <Emoji emojiName=''/>,
        );

        expect(document.querySelector('.emoticon')).not.toBeInTheDocument();
    });

    test('should render the provided system emoji', () => {
        renderWithContext(
            <Emoji emojiName='smiley'/>,
        );

        expect(document.querySelector('.emoticon')).toBe(screen.getByLabelText(':smiley:'));
        expect(screen.getByLabelText(':smiley:')).toBeInTheDocument();
        expect(screen.getByLabelText(':smiley:')).toHaveStyle({
            backgroundImage: 'https://mattermost.example.com/static/emoji/1F603.png',
        });
    });

    test('should render the provided custom emoji', () => {
        renderWithContext(
            <Emoji emojiName='custom-emoji-1'/>,
        );

        expect(document.querySelector('.emoticon')).toBe(screen.getByLabelText(':custom-emoji-1:'));
        expect(screen.getByLabelText(':custom-emoji-1:')).toBeInTheDocument();
        expect(screen.getByLabelText(':custom-emoji-1:')).toHaveStyle({
            backgroundImage: 'https://mattermost.example.com/api/v4/emojis/custom-emoji-id-1/image',
        });
    });
});
