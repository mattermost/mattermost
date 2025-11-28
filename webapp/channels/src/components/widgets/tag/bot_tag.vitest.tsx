// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithIntl, screen} from 'tests/vitest_react_testing_utils';

import BotTag from './bot_tag';

describe('components/widgets/tag/BotTag', () => {
    test('should render BOT tag with default props', () => {
        renderWithIntl(<BotTag/>);

        const botText = screen.getByText('BOT');
        expect(botText).toBeInTheDocument();

        const tag = botText.parentElement;
        expect(tag).toHaveClass('Tag', 'BotTag', 'Tag--xs');
    });

    test('should render BOT tag with custom className', () => {
        renderWithIntl(<BotTag className={'test'}/>);

        const botText = screen.getByText('BOT');
        expect(botText).toBeInTheDocument();

        const tag = botText.parentElement;
        expect(tag).toHaveClass('Tag', 'BotTag', 'test', 'Tag--xs');
    });

    test('should render BOT tag with custom size', () => {
        renderWithIntl(<BotTag size={'sm'}/>);

        const botText = screen.getByText('BOT');
        expect(botText).toBeInTheDocument();

        const tag = botText.parentElement;
        expect(tag).toHaveClass('Tag', 'BotTag', 'Tag--sm');
    });
});
