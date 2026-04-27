// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';

import GlobalClassificationIndicators from './global_classification_indicators';

import type {GlobalBannerConfig} from '../utils';

const LEVELS = [
    {id: 'lvl-1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
    {id: 'lvl-2', name: 'SECRET', color: '#C8102E', rank: 2},
    {id: 'lvl-3', name: 'TOP SECRET', color: '#FF8C00', rank: 3},
];

const DEFAULT_BANNER: GlobalBannerConfig = {enabled: false, placement: 'top', level_name: ''};
const ENABLED_BANNER: GlobalBannerConfig = {enabled: true, placement: 'top', level_name: 'UNCLASSIFIED'};

function makeProps(overrides: Record<string, unknown> = {}) {
    return {
        levels: LEVELS,
        globalBanner: DEFAULT_BANNER,
        onChange: jest.fn(),
        ...overrides,
    };
}

describe('GlobalClassificationIndicators', () => {
    test('renders section title and description', () => {
        renderWithContext(<GlobalClassificationIndicators {...makeProps()}/>);

        expect(screen.getByText('Global Classification Indicators')).toBeInTheDocument();
        expect(screen.getByText('Configure the global classification banner')).toBeInTheDocument();
    });

    test('renders the enable toggle', () => {
        renderWithContext(<GlobalClassificationIndicators {...makeProps()}/>);

        expect(screen.getByText('Global Classification Banner')).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: /True/i})).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: /False/i})).toBeInTheDocument();
    });

    test('does not render placement and level controls when banner is disabled', () => {
        renderWithContext(<GlobalClassificationIndicators {...makeProps()}/>);

        expect(screen.queryByText('Banner visibility')).not.toBeInTheDocument();
        expect(screen.queryByText('Global classification level')).not.toBeInTheDocument();
    });

    test('renders placement and level controls when banner is enabled', () => {
        renderWithContext(<GlobalClassificationIndicators {...makeProps({globalBanner: ENABLED_BANNER})}/>);

        expect(screen.getByText('Banner visibility')).toBeInTheDocument();
        expect(screen.getByText('Top only')).toBeInTheDocument();
        expect(screen.getByText('Top and bottom')).toBeInTheDocument();
        expect(screen.getByText('Global classification level')).toBeInTheDocument();
    });

    test('calls onChange with enabled: true when True radio is clicked', () => {
        const onChange = jest.fn();
        renderWithContext(<GlobalClassificationIndicators {...makeProps({onChange})}/>);

        fireEvent.click(screen.getByRole('radio', {name: /True/i}));

        expect(onChange).toHaveBeenCalledWith({enabled: true});
    });

    test('calls onChange with enabled: false when False radio is clicked', () => {
        const onChange = jest.fn();
        renderWithContext(<GlobalClassificationIndicators {...makeProps({globalBanner: ENABLED_BANNER, onChange})}/>);

        fireEvent.click(screen.getByRole('radio', {name: /False/i}));

        expect(onChange).toHaveBeenCalledWith({enabled: false});
    });

    test('calls onChange with placement top_and_bottom when Top and bottom is clicked', () => {
        const onChange = jest.fn();
        renderWithContext(<GlobalClassificationIndicators {...makeProps({globalBanner: ENABLED_BANNER, onChange})}/>);

        fireEvent.click(screen.getByRole('radio', {name: /Top and bottom/i}));

        expect(onChange).toHaveBeenCalledWith({placement: 'top_and_bottom'});
    });

    test('calls onChange with placement top when Top only is clicked', () => {
        const onChange = jest.fn();
        const banner: GlobalBannerConfig = {...ENABLED_BANNER, placement: 'top_and_bottom'};
        renderWithContext(<GlobalClassificationIndicators {...makeProps({globalBanner: banner, onChange})}/>);

        fireEvent.click(screen.getByRole('radio', {name: /Top only/i}));

        expect(onChange).toHaveBeenCalledWith({placement: 'top'});
    });

    test('all controls are disabled when disabled prop is true', () => {
        renderWithContext(<GlobalClassificationIndicators {...makeProps({globalBanner: ENABLED_BANNER, disabled: true})}/>);

        const radios = screen.getAllByRole('radio') as HTMLInputElement[];
        radios.forEach((radio) => {
            expect(radio.disabled).toBe(true);
        });
    });

    test('renders empty state gracefully with no levels', () => {
        renderWithContext(<GlobalClassificationIndicators {...makeProps({levels: [], globalBanner: ENABLED_BANNER})}/>);

        expect(screen.getByText('Global Classification Indicators')).toBeInTheDocument();
        expect(screen.getByText('Global classification level')).toBeInTheDocument();
    });

    test('shows inline error when banner is enabled and the selected level no longer exists', () => {
        const banner: GlobalBannerConfig = {enabled: true, placement: 'top', level_name: 'RENAMED OR DELETED'};
        renderWithContext(<GlobalClassificationIndicators {...makeProps({globalBanner: banner})}/>);

        expect(
            screen.getByText(/The previously selected level no longer exists\. Select a level from the current classification levels\./),
        ).toBeInTheDocument();
    });

    test('shows inline error when the referenced level was renamed', () => {
        // Banner references "UNCLASSIFIED" but the level has been renamed to "DECLASSIFIED".
        const renamedLevels = [
            {id: 'lvl-1', name: 'DECLASSIFIED', color: '#007A33', rank: 1},
            {id: 'lvl-2', name: 'SECRET', color: '#C8102E', rank: 2},
        ];
        renderWithContext(
            <GlobalClassificationIndicators
                {...makeProps({levels: renamedLevels, globalBanner: ENABLED_BANNER})}
            />,
        );

        expect(
            screen.getByText(/The previously selected level no longer exists/),
        ).toBeInTheDocument();
    });

    test('does not show the missing-level error when the selected level still exists', () => {
        renderWithContext(<GlobalClassificationIndicators {...makeProps({globalBanner: ENABLED_BANNER})}/>);

        expect(
            screen.queryByText(/The previously selected level no longer exists/),
        ).not.toBeInTheDocument();
    });

    test('does not show the missing-level error when the banner is disabled', () => {
        const banner: GlobalBannerConfig = {enabled: false, placement: 'top', level_name: 'missing-name'};
        renderWithContext(<GlobalClassificationIndicators {...makeProps({globalBanner: banner})}/>);

        expect(
            screen.queryByText(/The previously selected level no longer exists/),
        ).not.toBeInTheDocument();
    });
});
