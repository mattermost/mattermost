// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';
import {describe, test, expect} from 'vitest';

import {renderWithIntl} from 'tests/vitest_react_testing_utils';

import BetaTag from './beta_tag';

describe('components/widgets/tag/BetaTag', () => {
    test('should render BETA tag with default props', () => {
        renderWithIntl(<BetaTag/>);

        const betaText = screen.getByText('BETA');
        expect(betaText).toBeInTheDocument();

        const tag = betaText.parentElement;
        expect(tag).toHaveClass('Tag', 'BetaTag', 'Tag--xs', 'Tag--info');
    });

    test('should render BETA tag with custom className', () => {
        renderWithIntl(<BetaTag className={'test'}/>);

        const betaText = screen.getByText('BETA');
        expect(betaText).toBeInTheDocument();

        const tag = betaText.parentElement;
        expect(tag).toHaveClass('Tag', 'BetaTag', 'test', 'Tag--xs', 'Tag--info');
    });

    test('should render BETA tag with custom size', () => {
        renderWithIntl(<BetaTag size={'sm'}/>);

        const betaText = screen.getByText('BETA');
        expect(betaText).toBeInTheDocument();

        const tag = betaText.parentElement;
        expect(tag).toHaveClass('Tag', 'BetaTag', 'Tag--sm', 'Tag--info');
    });

    test('should render BETA tag with custom variant', () => {
        renderWithIntl(<BetaTag variant={'success'}/>);

        const betaText = screen.getByText('BETA');
        expect(betaText).toBeInTheDocument();

        const tag = betaText.parentElement;
        expect(tag).toHaveClass('Tag', 'BetaTag', 'Tag--xs', 'Tag--success');
    });
});
