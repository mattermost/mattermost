// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';

import {withIntl} from 'tests/helpers/intl-test-helper';

import BotTag from './bot_tag';

describe('components/widgets/tag/BotTag', () => {
    test('should render BOT tag with default props', () => {
        render(withIntl(<BotTag/>));

        const botText = screen.getByText('BOT');
        expect(botText).toBeInTheDocument();

        const tag = botText.parentElement;
        expect(tag).toHaveClass('Tag', 'BotTag', 'Tag--xs');
    });

    test('should render BOT tag with custom className', () => {
        render(withIntl(<BotTag className={'test'}/>));

        const botText = screen.getByText('BOT');
        expect(botText).toBeInTheDocument();

        const tag = botText.parentElement;
        expect(tag).toHaveClass('Tag', 'BotTag', 'test', 'Tag--xs');
    });

    test('should render BOT tag with custom size', () => {
        render(withIntl(<BotTag size={'sm'}/>));

        const botText = screen.getByText('BOT');
        expect(botText).toBeInTheDocument();

        const tag = botText.parentElement;
        expect(tag).toHaveClass('Tag', 'BotTag', 'Tag--sm');
    });
});
