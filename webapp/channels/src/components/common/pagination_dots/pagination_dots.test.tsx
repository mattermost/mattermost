// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import PaginationDots from './pagination_dots';

describe('components/common/pagination_dots', () => {
    test('maps totalSteps and currentStep to Compass pages and activePage (1-indexed)', () => {
        renderWithContext(
            <PaginationDots
                totalSteps={3}
                currentStep={2}
            />,
        );

        const tabs = screen.getAllByRole('tab');
        expect(tabs).toHaveLength(3);
        expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
        expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
        expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
    });

    test('forwards orientation to Compass', () => {
        renderWithContext(
            <PaginationDots
                totalSteps={2}
                currentStep={1}
                orientation='vertical'
            />,
        );

        expect(screen.getByRole('tablist')).toBeInTheDocument();
        expect(screen.getAllByRole('tab')).toHaveLength(2);
    });
});
