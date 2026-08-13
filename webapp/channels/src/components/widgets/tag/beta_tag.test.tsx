// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';

import {withIntl} from 'tests/helpers/intl-test-helper';

import BetaTag from './beta_tag';

describe('components/widgets/tag/BetaTag', () => {
    test('should render BETA tag with default props', () => {
        render(withIntl(<BetaTag/>));

        const betaText = screen.getByText('BETA');
        expect(betaText).toBeInTheDocument();

        const tag = betaText.parentElement;
        expect(tag).toHaveClass('Tag', 'BetaTag', 'Tag--xs', 'Tag--info');
    });

    test('should render BETA tag with custom className', () => {
        render(withIntl(<BetaTag className={'test'}/>));

        const betaText = screen.getByText('BETA');
        expect(betaText).toBeInTheDocument();

        const tag = betaText.parentElement;
        expect(tag).toHaveClass('Tag', 'BetaTag', 'test', 'Tag--xs', 'Tag--info');
    });

    test('should render BETA tag with custom size', () => {
        render(withIntl(<BetaTag size={'sm'}/>));

        const betaText = screen.getByText('BETA');
        expect(betaText).toBeInTheDocument();

        const tag = betaText.parentElement;
        expect(tag).toHaveClass('Tag', 'BetaTag', 'Tag--sm', 'Tag--info');
    });

    test('should render BETA tag with custom variant', () => {
        render(withIntl(<BetaTag variant={'success'}/>));

        const betaText = screen.getByText('BETA');
        expect(betaText).toBeInTheDocument();

        const tag = betaText.parentElement;
        expect(tag).toHaveClass('Tag', 'BetaTag', 'Tag--xs', 'Tag--success');
    });
});
