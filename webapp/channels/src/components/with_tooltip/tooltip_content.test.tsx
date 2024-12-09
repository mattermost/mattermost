// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import TooltipContent from './tooltip_content';

describe('TooltipContent', () => {
    test('have correct structure with just title', () => {
        const {container} = renderWithContext(
            <TooltipContent title='Title'/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('have correct structure with title and emoji', () => {
        const {container} = renderWithContext(
            <TooltipContent
                title='Title with Emoji'
                emoji='smile'
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('have correct structure with title and large emoji', () => {
        const {container} = renderWithContext(
            <TooltipContent
                title='Title with Large Emoji'
                emoji='smile'
                isEmojiLarge={true}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('have correct structure with title, emoji and hint', () => {
        const {container} = renderWithContext(
            <TooltipContent
                title='Title with Hint'
                hint='This is a hint'
                emoji='smile'
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('have correct structure with title and shortcut', () => {
        const shortcut = {
            default: ['Ctrl', 'K'],
        };

        const {container} = renderWithContext(
            <TooltipContent
                title='Title with Shortcut'
                shortcut={shortcut}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
