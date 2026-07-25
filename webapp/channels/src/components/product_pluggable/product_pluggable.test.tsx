// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ProductPluggable from './product_pluggable';

jest.mock('components/async_load', () => ({
    makeAsyncPluggableComponent: () => ({pluggableName}: {pluggableName: string}) => (
        <div data-testid={`pluggable-${pluggableName}`}/>
    ),
}));

describe('ProductPluggable', () => {
    it('wraps the pluggable in a wide product-wrapper when wrapped and the team sidebar is hidden', () => {
        const product = {...TestHelper.makeProduct('boards'), wrapped: true, showTeamSidebar: false};

        const {container} = renderWithContext(<ProductPluggable product={product}/>);

        const wrapper = container.querySelector('.product-wrapper');
        expect(wrapper).toBeInTheDocument();
        expect(wrapper).toHaveClass('wide');
        expect(screen.getByTestId('pluggable-Product')).toBeInTheDocument();
    });

    it('omits the wide modifier when the team sidebar is shown', () => {
        const product = {...TestHelper.makeProduct('boards'), wrapped: true, showTeamSidebar: true};

        const {container} = renderWithContext(<ProductPluggable product={product}/>);

        const wrapper = container.querySelector('.product-wrapper');
        expect(wrapper).toBeInTheDocument();
        expect(wrapper).not.toHaveClass('wide');
    });

    it('renders the pluggable without a wrapper when not wrapped', () => {
        const product = {...TestHelper.makeProduct('boards'), wrapped: false};

        const {container} = renderWithContext(<ProductPluggable product={product}/>);

        expect(container.querySelector('.product-wrapper')).not.toBeInTheDocument();
        expect(screen.getByTestId('pluggable-Product')).toBeInTheDocument();
    });
});
