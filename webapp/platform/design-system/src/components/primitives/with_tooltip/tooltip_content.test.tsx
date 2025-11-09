// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import TooltipContent from './tooltip_content';

// Test wrapper with IntlProvider
const renderWithIntl = (ui: React.ReactElement) => {
    return render(
        <IntlProvider locale='en' messages={{}}>
            {ui}
        </IntlProvider>,
    );
};

describe('TooltipContent', () => {
    test('renders with just title', () => {
        renderWithIntl(<TooltipContent title='Title'/>);
        expect(screen.getByText('Title')).toBeInTheDocument();
    });

    test('renders with title and emoji', () => {
        const {container} = renderWithIntl(
            <TooltipContent
                title='Title with Emoji'
                emoji='smile'
            />,
        );
        expect(screen.getByText('Title with Emoji')).toBeInTheDocument();
        expect(container.querySelector('.tooltipContentEmoji')).toBeInTheDocument();
    });

    test('renders with title and large emoji', () => {
        const {container} = renderWithIntl(
            <TooltipContent
                title='Title with Large Emoji'
                emoji='smile'
                isEmojiLarge={true}
            />,
        );
        expect(screen.getByText('Title with Large Emoji')).toBeInTheDocument();
        expect(container.querySelector('.tooltipContentEmoji')).toBeInTheDocument();
        expect(container.querySelector('.isEmojiLarge')).toBeInTheDocument();
    });

    test('renders with title, emoji and hint', () => {
        const {container} = renderWithIntl(
            <TooltipContent
                title='Title with Hint'
                hint='This is a hint'
                emoji='smile'
            />,
        );
        expect(screen.getByText('Title with Hint')).toBeInTheDocument();
        expect(screen.getByText('This is a hint')).toBeInTheDocument();
        expect(container.querySelector('.tooltipContentEmoji')).toBeInTheDocument();
    });

    test('renders with title and shortcut', () => {
        const shortcut = {
            default: ['Ctrl', 'K'],
        };

        renderWithIntl(
            <TooltipContent
                title='Title with Shortcut'
                shortcut={shortcut}
            />,
        );
        expect(screen.getByText('Title with Shortcut')).toBeInTheDocument();
        expect(screen.getByText('Ctrl')).toBeInTheDocument();
        expect(screen.getByText('K')).toBeInTheDocument();
    });
});
