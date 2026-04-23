// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import GlobalClassificationBanner from './global_classification_banner';

function makeState(overrides: Record<string, string> = {}): DeepPartial<GlobalState> {
    return {
        entities: {
            general: {
                config: {
                    FeatureFlagClassificationMarkings: 'true',
                    ClassificationMarkingsGlobalBannerEnabled: 'true',
                    ClassificationMarkingsGlobalBannerPlacement: 'top',
                    ClassificationMarkingsGlobalBannerLevelName: 'SECRET',
                    ClassificationMarkingsGlobalBannerColor: '#C8102E',
                    ...overrides,
                },
            },
        },
    };
}

describe('GlobalClassificationBanner', () => {
    test('renders top banner with level name and background color', () => {
        renderWithContext(<GlobalClassificationBanner position='top'/>, makeState());

        const banner = screen.getByTestId('global-classification-banner-top');
        expect(banner).toBeInTheDocument();
        expect(banner).toHaveStyle({backgroundColor: '#C8102E'});
        expect(screen.getByText('SECRET')).toBeInTheDocument();
    });

    test('does not render when feature flag is off', () => {
        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState({FeatureFlagClassificationMarkings: 'false'}),
        );

        expect(screen.queryByTestId('global-classification-banner-top')).not.toBeInTheDocument();
    });

    test('does not render when banner is disabled', () => {
        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState({ClassificationMarkingsGlobalBannerEnabled: 'false'}),
        );

        expect(screen.queryByTestId('global-classification-banner-top')).not.toBeInTheDocument();
    });

    test('does not render when level name is empty', () => {
        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState({ClassificationMarkingsGlobalBannerLevelName: ''}),
        );

        expect(screen.queryByTestId('global-classification-banner-top')).not.toBeInTheDocument();
    });

    test('renders bottom banner when placement is top_and_bottom', () => {
        renderWithContext(
            <GlobalClassificationBanner position='bottom'/>,
            makeState({ClassificationMarkingsGlobalBannerPlacement: 'top_and_bottom'}),
        );

        expect(screen.getByTestId('global-classification-banner-bottom')).toBeInTheDocument();
        expect(screen.getByText('SECRET')).toBeInTheDocument();
    });

    test('does not render bottom banner when placement is top', () => {
        renderWithContext(
            <GlobalClassificationBanner position='bottom'/>,
            makeState({ClassificationMarkingsGlobalBannerPlacement: 'top'}),
        );

        expect(screen.queryByTestId('global-classification-banner-bottom')).not.toBeInTheDocument();
    });

    test('renders top banner regardless of placement value', () => {
        renderWithContext(
            <GlobalClassificationBanner position='top'/>,
            makeState({ClassificationMarkingsGlobalBannerPlacement: 'top_and_bottom'}),
        );

        expect(screen.getByTestId('global-classification-banner-top')).toBeInTheDocument();
    });
});
