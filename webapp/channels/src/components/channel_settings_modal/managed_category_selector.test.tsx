// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ManagedCategorySelector from './managed_category_selector';

const baseState = {
    entities: {
        general: {
            config: {EnableManagedChannelCategories: 'true'},
        },
        teams: {
            currentTeamId: 'team1',
        },
        channelCategories: {
            byId: {},
            orderByTeam: {},
            managedCategoryMappings: {
                team1: {
                    channel1: 'Operations',
                    channel2: 'Operations',
                    channel3: 'Intel',
                },
            },
        },
    },
};

describe('ManagedCategorySelector', () => {
    const baseProps = {
        value: '',
        onChange: jest.fn(),
    };

    beforeEach(() => {
        baseProps.onChange.mockClear();
    });

    it('should render with the selected value', () => {
        renderWithContext(
            <ManagedCategorySelector
                {...baseProps}
                value='Operations'
            />,
            baseState,
        );

        expect(screen.getByText('Operations')).toBeInTheDocument();
    });

    it('should show existing categories as options', async () => {
        renderWithContext(<ManagedCategorySelector {...baseProps}/>, baseState);

        const input = screen.getByRole('combobox');
        await userEvent.click(input);

        expect(screen.getByText('Operations')).toBeInTheDocument();
        expect(screen.getByText('Intel')).toBeInTheDocument();
    });

    it('should call onChange when a category is selected', async () => {
        renderWithContext(<ManagedCategorySelector {...baseProps}/>, baseState);

        const input = screen.getByRole('combobox');
        await userEvent.click(input);
        await userEvent.click(screen.getByText('Operations'));

        expect(baseProps.onChange).toHaveBeenCalledWith('Operations');
    });

    it('should be disabled when disabled prop is true', () => {
        const {container} = renderWithContext(
            <ManagedCategorySelector
                {...baseProps}
                disabled={true}
            />,
            baseState,
        );

        const selectControl = container.querySelector('.ManagedCategory__control--is-disabled');
        expect(selectControl).toBeInTheDocument();
    });

    it('should not show create option for single character input', async () => {
        renderWithContext(<ManagedCategorySelector {...baseProps}/>, baseState);

        const input = screen.getByRole('combobox');
        await userEvent.click(input);
        await userEvent.type(input, 'N');

        expect(screen.queryByText(/Create new category/)).not.toBeInTheDocument();
    });
});
