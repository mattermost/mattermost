// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import RhsPlugin from './rhs_plugin';

import ConnectedRhsPlugin from '.';

jest.mock('components/search_results_header', () => ({
    __esModule: true,
    default: ({children, newWindowHandler}: {children: React.ReactNode; newWindowHandler?: () => void}) => (
        <div
            data-testid='search-results-header'
            data-has-window-handler={newWindowHandler === undefined ? 'false' : 'true'}
        >
            {children}
        </div>
    ),
}));

jest.mock('plugins/pluggable', () => ({
    __esModule: true,
    default: () => <div data-testid='pluggable'/>,
}));

jest.mock('utils/popouts/popout_windows', () => ({
    popoutRhsPlugin: jest.fn(),
}));

const baseState: DeepPartial<GlobalState> = {
    entities: {
        general: {config: {}},
        teams: {
            currentTeamId: 'team-id',
            teams: {'team-id': {id: 'team-id', name: 'test-team'}},
        },
        channels: {
            currentChannelId: 'channel-id',
            channels: {'channel-id': {id: 'channel-id', name: 'test-channel'}},
        },
        preferences: {myPreferences: {}},
    },
    plugins: {
        plugins: {'plugin-id': {name: 'Test Plugin'}},
        components: {
            RightHandSidebarComponent: [],
        },
    },
    views: {
        rhs: {pluggableId: ''},
    },
};

describe('RhsPlugin', () => {
    describe('component', () => {
        it('passes newWindowHandler to SearchResultsHeader when showPopout is true', () => {
            renderWithContext(
                <RhsPlugin
                    showPluggable={true}
                    pluggableId='pluggable-id'
                    title='Test Title'
                    pluginId='plugin-id'
                    showPopout={true}
                />,
                baseState,
            );

            expect(screen.getByTestId('search-results-header')).toHaveAttribute('data-has-window-handler', 'true');
        });

        it('passes undefined for newWindowHandler to SearchResultsHeader when showPopout is false', () => {
            renderWithContext(
                <RhsPlugin
                    showPluggable={true}
                    pluggableId='pluggable-id'
                    title='Test Title'
                    pluginId='plugin-id'
                    showPopout={false}
                />,
                baseState,
            );

            expect(screen.getByTestId('search-results-header')).toHaveAttribute('data-has-window-handler', 'false');
        });

        it('defaults showPopout to true when the prop is omitted', () => {
            renderWithContext(
                <RhsPlugin
                    showPluggable={true}
                    pluggableId='pluggable-id'
                    title='Test Title'
                    pluginId='plugin-id'
                />,
                baseState,
            );

            expect(screen.getByTestId('search-results-header')).toHaveAttribute('data-has-window-handler', 'true');
        });
    });

    describe('mapStateToProps', () => {
        const pluggableId = 'pluggable-id';

        function stateWithRegisteredComponent(showPopout?: boolean): DeepPartial<GlobalState> {
            const component: Record<string, unknown> = {
                id: pluggableId,
                pluginId: 'plugin-id',
                title: 'Test Title',
            };
            if (showPopout !== undefined) {
                component.showPopout = showPopout;
            }
            return {
                ...baseState,
                plugins: {
                    ...baseState.plugins,
                    components: {
                        RightHandSidebarComponent: [component as any],
                    },
                },
                views: {
                    rhs: {pluggableId},
                },
            };
        }

        it('defaults showPopout to true when component showPopout field is undefined', () => {
            renderWithContext(<ConnectedRhsPlugin/>, stateWithRegisteredComponent(undefined));

            expect(screen.getByTestId('search-results-header')).toHaveAttribute('data-has-window-handler', 'true');
        });

        it('passes showPopout: false through to hide the popout button', () => {
            renderWithContext(<ConnectedRhsPlugin/>, stateWithRegisteredComponent(false));

            expect(screen.getByTestId('search-results-header')).toHaveAttribute('data-has-window-handler', 'false');
        });
    });
});
