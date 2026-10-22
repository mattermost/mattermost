// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {makeGetSidebarCategoryNamesForTeam} from 'mattermost-redux/selectors/entities/channel_categories';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import CategorySelector from './category_selector';

const baseState = {
    entities: {
        general: {
            config: {FeatureFlagManagedChannelCategories: 'true'},
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

describe('CategorySelector', () => {
    const baseProps = {
        value: '',
        onChange: jest.fn(),
        getOptions: makeGetSidebarCategoryNamesForTeam(),
    };

    beforeEach(() => {
        baseProps.onChange.mockClear();
    });

    it('should render with the selected value', () => {
        renderWithContext(
            <CategorySelector
                {...baseProps}
                value='Operations'
            />,
            baseState,
        );

        expect(screen.getByText('Operations')).toBeInTheDocument();
    });

    it('should show existing categories as options', async () => {
        renderWithContext(<CategorySelector {...baseProps}/>, baseState);

        const input = screen.getByRole('combobox');
        await userEvent.click(input);

        expect(screen.getByText('Operations')).toBeInTheDocument();
        expect(screen.getByText('Intel')).toBeInTheDocument();
    });

    it('should call onChange when a category is selected', async () => {
        renderWithContext(<CategorySelector {...baseProps}/>, baseState);

        const input = screen.getByRole('combobox');
        await userEvent.click(input);
        await userEvent.click(screen.getByText('Operations'));

        expect(baseProps.onChange).toHaveBeenCalledWith('Operations');
    });

    it('should be disabled when disabled prop is true', () => {
        const {container} = renderWithContext(
            <CategorySelector
                {...baseProps}
                disabled={true}
            />,
            baseState,
        );

        const selectControl = container.querySelector('.CategorySelector__control--is-disabled');
        expect(selectControl).toBeInTheDocument();
    });

    it('should not show create option for single character input', async () => {
        renderWithContext(<CategorySelector {...baseProps}/>, baseState);

        const input = screen.getByRole('combobox');
        await userEvent.click(input);
        await userEvent.type(input, 'N');

        expect(screen.queryByText(/Create new category/)).not.toBeInTheDocument();
    });

    it('should use default placeholder when not overridden', () => {
        renderWithContext(<CategorySelector {...baseProps}/>, baseState);

        expect(screen.getByText('Choose a default category (optional)')).toBeInTheDocument();
    });

    it('should use label and placeholder overrides when provided', async () => {
        renderWithContext(
            <CategorySelector
                {...baseProps}
                label='Custom label'
                placeholder='Custom placeholder'
            />,
            baseState,
        );

        expect(screen.getByText('Custom placeholder')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('combobox'));
        expect(screen.getByText('Custom label')).toBeInTheDocument();
    });

    it('should not render help text when helpText prop is not provided', () => {
        const {container} = renderWithContext(<CategorySelector {...baseProps}/>, baseState);

        expect(container.querySelector('.Input___customMessage')).not.toBeInTheDocument();
    });

    it('should render help text when helpText prop is provided', () => {
        renderWithContext(
            <CategorySelector
                {...baseProps}
                helpText='Choose where new channels will appear in the sidebar'
            />,
            baseState,
        );

        expect(screen.getByText('Choose where new channels will appear in the sidebar')).toBeInTheDocument();
    });

    it('should use options from injected getOptions', async () => {
        const injectedOptions = ['Alpha', 'Beta'];
        const getOptions = () => injectedOptions;
        renderWithContext(
            <CategorySelector
                {...baseProps}
                getOptions={getOptions}
            />,
            baseState,
        );

        const input = screen.getByRole('combobox');
        await userEvent.click(input);

        expect(screen.getByText('Alpha')).toBeInTheDocument();
        expect(screen.getByText('Beta')).toBeInTheDocument();
    });
});
