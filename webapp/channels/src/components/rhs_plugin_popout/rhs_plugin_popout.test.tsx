// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter, Route} from 'react-router-dom';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import RhsPluginPopout from './rhs_plugin_popout';

jest.mock('components/loading_screen', () => ({
    __esModule: true,
    default: () => <div data-testid='loading-screen'>{'Loading Screen'}</div>,
}));

jest.mock('components/search_results_header', () => ({
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => (
        <div data-testid='search-results-header'>{children}</div>
    ),
}));

jest.mock('plugins/pluggable', () => ({
    __esModule: true,
    default: ({pluggableName, pluggableId}: {pluggableName: string; pluggableId: string}) => (
        <div data-testid={`pluggable-${pluggableName}-${pluggableId}`}>
            {`Pluggable: ${pluggableName} - ${pluggableId}`}
        </div>
    ),
}));

const mockUseParams = jest.spyOn(require('react-router-dom'), 'useParams');
const pluginId = 'test-plugin';
const pluggableId = 'pluggable-123';
const pluginTitle = 'Test Plugin Title';
const baseState = {
    entities: {
        general: {
            config: {
                SiteName: 'Test Server',
            },
        },
        channels: {
            channels: {},
        },
        teams: {
            teams: {},
        },
    },
    plugins: {
        plugins: {
            [pluginId]: {
                name: 'Test Plugin',
            },
        },
        components: {
            RightHandSidebarComponent: [{
                pluginId,
                id: pluggableId,
                title: pluginTitle,
            }],
        },
    },
};

describe('RhsPluginPopout', () => {
    beforeEach(() => {
        mockUseParams.mockReturnValue({pluginId});
    });

    it('should render LoadingScreen when plugin is not found', () => {
        mockUseParams.mockReturnValue({pluginId: 'non-existent-plugin'});

        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/rhs/team1/channel1/plugin/non-existent-plugin']}>
                <Route
                    path='/_popout/rhs/:team/:identifier/plugin/:pluginId'
                    component={RhsPluginPopout}
                />
            </MemoryRouter>,
            {
                ...baseState,
                plugins: {
                    plugins: {},
                },
            },
        );

        expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
        expect(screen.queryByTestId('search-results-header')).not.toBeInTheDocument();
        expect(screen.queryByTestId('pluggable-RightHandSidebarComponent-')).not.toBeInTheDocument();
    });

    it('should render SearchResultsHeader and Pluggable when plugin is found', () => {
        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/rhs/team1/channel1/plugin/test-plugin']}>
                <Route
                    path='/_popout/rhs/:team/:identifier/plugin/:pluginId'
                    component={RhsPluginPopout}
                />
            </MemoryRouter>,
            baseState,
        );

        expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
        expect(screen.getByTestId('search-results-header')).toBeInTheDocument();
        expect(screen.getByText(pluginTitle)).toBeInTheDocument();
        expect(screen.getByTestId(`pluggable-RightHandSidebarComponent-${pluggableId}`)).toBeInTheDocument();

        const pluggable = screen.getByTestId(`pluggable-RightHandSidebarComponent-${pluggableId}`);
        expect(pluggable).toBeInTheDocument();
        expect(pluggable).toHaveTextContent(`Pluggable: RightHandSidebarComponent - ${pluggableId}`);
    });

    it('should handle empty title when plugin component has no title', () => {
        mockUseParams.mockReturnValue({pluginId});

        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/rhs/team1/channel1/plugin/test-plugin']}>
                <Route
                    path='/_popout/rhs/:team/:identifier/plugin/:pluginId'
                    component={RhsPluginPopout}
                />
            </MemoryRouter>,
            {
                ...baseState,
                plugins: {
                    ...baseState.plugins,
                    components: {
                        ...baseState.plugins.components,
                        RightHandSidebarComponent: [{
                            ...baseState.plugins.components.RightHandSidebarComponent[0],
                            title: '',
                        }],
                    },
                },
            },
        );

        expect(screen.getByTestId('search-results-header')).toBeInTheDocument();
        expect(screen.getByTestId(`pluggable-RightHandSidebarComponent-${pluggableId}`)).toBeInTheDocument();
    });
});

