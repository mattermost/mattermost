// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import NoResultsIndicator from './no_results_indicator';
import {NoResultsLayout, NoResultsVariant} from './types';

describe('components/NoResultsIndicator', () => {
    test('horizontal layout renders a custom graphic directly', () => {
        renderWithContext(
            <NoResultsIndicator
                layout={NoResultsLayout.Horizontal}
                iconGraphic={<svg data-testid='custom-graphic'/>}
                title='End of the list'
            />,
        );

        const wrapper = screen.getByTestId('no-results-wrapper');
        expect(wrapper).toHaveClass('horizontal-layout');
        expect(wrapper).not.toHaveClass('no-results__wrapper--compass');
        expect(screen.getByTestId('custom-graphic').parentElement).toBe(wrapper);
        expect(wrapper.querySelector('.no-results__variant-wrapper')).toBeNull();
    });

    test('vertical layout renders through the Compass empty state', () => {
        renderWithContext(
            <NoResultsIndicator
                variant={NoResultsVariant.Mentions}
            />,
        );

        const wrapper = screen.getByTestId('no-results-wrapper');
        expect(wrapper).toHaveClass('no-results__wrapper--compass');
        expect(wrapper.querySelector('.no-results__variant-wrapper')).toBeNull();
        expect(screen.getByTestId('no-results-title')).toHaveTextContent('No mentions yet');
    });
});
