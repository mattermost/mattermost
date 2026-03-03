// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import WikiView from './wiki_view';

// Mock child components
jest.mock('./wiki_page_header', () => ({
    __esModule: true,
    default: () => <div data-testid='wiki-page-header'>{'Wiki Page Header'}</div>,
}));

jest.mock('./wiki_page_editor', () => ({
    __esModule: true,
    default: () => <div data-testid='wiki-page-editor'>{'Wiki Page Editor'}</div>,
}));

jest.mock('./page_viewer', () => ({
    __esModule: true,
    default: () => <div data-testid='page-viewer'>{'Page Viewer'}</div>,
}));

jest.mock('components/pages_hierarchy_panel', () => ({
    __esModule: true,
    default: () => <div data-testid='pages-hierarchy-panel'>{'Pages Hierarchy Panel'}</div>,
}));

jest.mock('components/loading_screen', () => ({
    __esModule: true,
    default: () => <div data-testid='loading-screen'>{'Loading...'}</div>,
}));

// Mock hooks
jest.mock('./hooks', () => ({
    useWikiPageData: () => ({isLoading: false}),
    useWikiPageActions: () => ({
        handleSave: jest.fn(),
        handlePublish: jest.fn(),
        handleDelete: jest.fn(),
    }),
    useFullscreen: () => ({
        isFullscreen: false,
        toggleFullscreen: jest.fn(),
    }),
    useAutoPageSelection: jest.fn(),
    useVersionHistory: () => ({
        isVersionHistoryOpen: false,
        openVersionHistory: jest.fn(),
        closeVersionHistory: jest.fn(),
    }),
}));

jest.mock('hooks/usePublishedDraftCleanup', () => ({
    usePublishedDraftCleanup: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
    ...jest.requireActual('react-router-dom'),
    useRouteMatch: () => ({
        params: {
            pageId: 'page-123',
            channelId: 'channel-123',
            wikiId: 'wiki-123',
        },
        path: '/wiki/:channelId/:wikiId/:pageId',
    }),
    useHistory: () => ({
        push: jest.fn(),
        replace: jest.fn(),
    }),
    useLocation: () => ({
        pathname: '/wiki/channel-123/wiki-123/page-123',
        search: '',
        hash: '',
    }),
}));

describe('components/wiki_view/WikiView', () => {
    const mockUserId = 'user-id-123';
    const mockTeamId = 'team-id-456';
    const mockChannelId = 'channel-123';

    const getInitialState = (): DeepPartial<GlobalState> => ({
        entities: {
            users: {
                currentUserId: mockUserId,
                profiles: {
                    [mockUserId]: {
                        id: mockUserId,
                        username: 'testuser',
                    },
                },
            },
            teams: {
                currentTeamId: mockTeamId,
                teams: {
                    [mockTeamId]: {
                        id: mockTeamId,
                        name: 'test-team',
                        display_name: 'Test Team',
                    },
                },
            },
            channels: {
                channels: {
                    [mockChannelId]: {
                        id: mockChannelId,
                        name: 'test-channel',
                        display_name: 'Test Channel',
                        team_id: mockTeamId,
                    },
                },
            },
            posts: {
                posts: {},
            },
        },
        views: {
            rhs: {
                rhsState: null,
            },
            pagesHierarchy: {
                isPanelCollapsed: false,
                lastViewedPage: {},
            },
        },
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        test('should render wiki view container', () => {
            renderWithContext(<WikiView/>, getInitialState());

            // Should render pages hierarchy panel
            expect(screen.getByTestId('pages-hierarchy-panel')).toBeInTheDocument();
        });

        test('should render wiki page header', () => {
            renderWithContext(<WikiView/>, getInitialState());

            expect(screen.getByTestId('wiki-page-header')).toBeInTheDocument();
        });
    });

    describe('Loading state', () => {
        test('should not show loading screen when not loading', () => {
            renderWithContext(<WikiView/>, getInitialState());

            expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
        });
    });
});
