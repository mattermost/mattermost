// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as ReactRedux from 'react-redux';
import {MemoryRouter, Route} from 'react-router-dom';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import RhsPluginPopout from './rhs_plugin_popout';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
}));

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

const mockUseSelector = ReactRedux.useSelector as jest.MockedFunction<typeof ReactRedux.useSelector>;
const mockUseParams = jest.spyOn(require('react-router-dom'), 'useParams');

describe('RhsPluginPopout', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render LoadingScreen when plugin is not found', () => {
        const pluginId = 'non-existent-plugin';
        mockUseParams.mockReturnValue({pluginId});
        mockUseSelector.mockReturnValue({
            showPluggable: false,
            pluggableId: '',
            title: '',
        });

        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/rhs/team1/channel1/plugin/non-existent-plugin']}>
                <Route
                    path='/_popout/rhs/:team/:identifier/plugin/:pluginId'
                    component={RhsPluginPopout}
                />
            </MemoryRouter>,
        );

        expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
        expect(screen.queryByTestId('search-results-header')).not.toBeInTheDocument();
        expect(screen.queryByTestId('pluggable-RightHandSidebarComponent-')).not.toBeInTheDocument();
    });

    it('should render SearchResultsHeader and Pluggable when plugin is found', () => {
        const pluginId = 'test-plugin';
        const pluggableId = 'pluggable-123';
        const pluginTitle = 'Test Plugin Title';

        mockUseParams.mockReturnValue({pluginId});
        mockUseSelector.mockReturnValue({
            showPluggable: true,
            pluggableId,
            title: pluginTitle,
        });

        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/rhs/team1/channel1/plugin/test-plugin']}>
                <Route
                    path='/_popout/rhs/:team/:identifier/plugin/:pluginId'
                    component={RhsPluginPopout}
                />
            </MemoryRouter>,
        );

        expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
        expect(screen.getByTestId('search-results-header')).toBeInTheDocument();
        expect(screen.getByText(pluginTitle)).toBeInTheDocument();
        expect(screen.getByTestId(`pluggable-RightHandSidebarComponent-${pluggableId}`)).toBeInTheDocument();
    });

    it('should pass correct props to Pluggable component', () => {
        const pluginId = 'test-plugin';
        const pluggableId = 'pluggable-789';
        const pluginTitle = 'Plugin Title';

        mockUseParams.mockReturnValue({pluginId});
        mockUseSelector.mockReturnValue({
            showPluggable: true,
            pluggableId,
            title: pluginTitle,
        });

        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/rhs/team1/channel1/plugin/test-plugin']}>
                <Route
                    path='/_popout/rhs/:team/:identifier/plugin/:pluginId'
                    component={RhsPluginPopout}
                />
            </MemoryRouter>,
        );

        const pluggable = screen.getByTestId(`pluggable-RightHandSidebarComponent-${pluggableId}`);
        expect(pluggable).toBeInTheDocument();
        expect(pluggable).toHaveTextContent(`Pluggable: RightHandSidebarComponent - ${pluggableId}`);
    });

    it('should handle empty title when plugin component has no title', () => {
        const pluginId = 'test-plugin';
        const pluggableId = 'pluggable-empty-title';

        mockUseParams.mockReturnValue({pluginId});
        mockUseSelector.mockReturnValue({
            showPluggable: true,
            pluggableId,
            title: '',
        });

        renderWithContext(
            <MemoryRouter initialEntries={['/_popout/rhs/team1/channel1/plugin/test-plugin']}>
                <Route
                    path='/_popout/rhs/:team/:identifier/plugin/:pluginId'
                    component={RhsPluginPopout}
                />
            </MemoryRouter>,
        );

        expect(screen.getByTestId('search-results-header')).toBeInTheDocument();
        expect(screen.getByTestId(`pluggable-RightHandSidebarComponent-${pluggableId}`)).toBeInTheDocument();
    });
});

