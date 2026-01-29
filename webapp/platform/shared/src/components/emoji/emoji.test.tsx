// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {CustomEmoji, SystemEmoji} from '@mattermost/types/emojis';

import {Emoji} from './emoji';

import {renderWithContext} from '../../testing';

import '@testing-library/jest-dom';

describe('Emoji', () => {
    test('should render nothing when no emoji is provided', () => {
        renderWithContext(
            <Emoji/>,
        );

        expect(document.querySelector('.emoticon')).not.toBeInTheDocument();
    });

    test('should render the provided system emoji', () => {
        const emoji: SystemEmoji = {
            name: 'SMILING FACE WITH OPEN MOUTH',
            unified: '1F603',
            short_name: 'smiley',
            short_names: [
                'smiley',
            ],
            category: 'smileys-emotion',
        };

        renderWithContext(
            <Emoji emoji={emoji}/>,
        );

        expect(document.querySelector('.emoticon')).toBe(screen.getByLabelText(':smiley:'));
        expect(screen.getByLabelText(':smiley:')).toBeInTheDocument();
        expect(screen.getByLabelText(':smiley:')).toHaveStyle({
            backgroundImage: 'https://mattermost.example.com/static/emoji/1F603.png',
        });
    });

    test('should render the provided custom emoji', () => {
        const emoji: CustomEmoji = {
            id: 'emoji-id-1',
            name: 'emoji-1',
            category: 'custom',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            creator_id: 'user-id-1',
        };

        renderWithContext(
            <Emoji emoji={emoji}/>,
        );

        expect(document.querySelector('.emoticon')).toBe(screen.getByLabelText(':emoji-1:'));
        expect(screen.getByLabelText(':emoji-1:')).toBeInTheDocument();
        expect(screen.getByLabelText(':emoji-1:')).toHaveStyle({
            backgroundImage: 'https://mattermost.example.com/api/v4/emojis/emoji-id-1/image',
        });
    });
});
