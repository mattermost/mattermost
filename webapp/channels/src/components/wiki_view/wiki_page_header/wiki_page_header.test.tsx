// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import WikiPageHeader from './wiki_page_header';

// Mock child components
jest.mock('../../pages_hierarchy_panel/page_actions_menu', () => ({
    __esModule: true,
    default: (props: {buttonTestId?: string}) => (
        <button data-testid={props.buttonTestId || 'page-actions-menu'}>
            {'Actions'}
        </button>
    ),
}));

jest.mock('../page_breadcrumb', () => ({
    __esModule: true,
    default: () => <nav data-testid='page-breadcrumb'>{'Breadcrumb'}</nav>,
}));

jest.mock('components/bookmark_channel_select', () => ({
    __esModule: true,
    default: () => <div data-testid='bookmark-channel-select'>{'Bookmark Select'}</div>,
}));

describe('components/wiki_view/wiki_page_header/WikiPageHeader', () => {
    const mockUserId = 'user-id-123';
    const mockTeamId = 'team-id-456';
    const mockChannelId = 'channel-123';
    const mockWikiId = 'wiki-123';
    const mockPageId = 'page-123';

    const defaultProps = {
        wikiId: mockWikiId,
        pageId: mockPageId,
        channelId: mockChannelId,
        isDraft: false,
        onEdit: jest.fn(),
        onPublish: jest.fn(),
        onToggleComments: jest.fn(),
    };

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
                posts: {
                    [mockPageId]: {
                        id: mockPageId,
                        channel_id: mockChannelId,
                        user_id: mockUserId,
                        message: 'Page content',
                        type: 'page',
                        props: {
                            title: 'Test Page',
                            wiki_id: mockWikiId,
                        },
                    },
                },
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
        test('should render header container', () => {
            renderWithContext(<WikiPageHeader {...defaultProps}/>, getInitialState());

            expect(screen.getByTestId('wiki-page-header')).toBeInTheDocument();
        });

        test('should render breadcrumb', () => {
            renderWithContext(<WikiPageHeader {...defaultProps}/>, getInitialState());

            expect(screen.getByTestId('page-breadcrumb')).toBeInTheDocument();
        });

        test('should render edit button when not in draft mode', () => {
            renderWithContext(<WikiPageHeader {...defaultProps}/>, getInitialState());

            expect(screen.getByTestId('wiki-page-edit-button')).toBeInTheDocument();
        });

        test('should render publish button when in draft mode', () => {
            renderWithContext(
                <WikiPageHeader
                    {...defaultProps}
                    isDraft={true}
                />,
                getInitialState(),
            );

            expect(screen.getByTestId('wiki-page-publish-button')).toBeInTheDocument();
        });

        test('should render comments toggle button for non-draft page', () => {
            renderWithContext(<WikiPageHeader {...defaultProps}/>, getInitialState());

            expect(screen.getByTestId('wiki-page-toggle-comments')).toBeInTheDocument();
        });

        test('should render page actions menu when pageId is provided', () => {
            renderWithContext(<WikiPageHeader {...defaultProps}/>, getInitialState());

            expect(screen.getByTestId('wiki-page-more-actions')).toBeInTheDocument();
        });
    });

    describe('User Interactions', () => {
        test('should call onEdit when edit button is clicked', () => {
            const onEdit = jest.fn();
            renderWithContext(
                <WikiPageHeader
                    {...defaultProps}
                    onEdit={onEdit}
                />,
                getInitialState(),
            );

            fireEvent.click(screen.getByTestId('wiki-page-edit-button'));

            expect(onEdit).toHaveBeenCalledTimes(1);
        });

        test('should call onPublish when publish button is clicked', () => {
            const onPublish = jest.fn();
            renderWithContext(
                <WikiPageHeader
                    {...defaultProps}
                    isDraft={true}
                    onPublish={onPublish}
                />,
                getInitialState(),
            );

            fireEvent.click(screen.getByTestId('wiki-page-publish-button'));

            expect(onPublish).toHaveBeenCalledTimes(1);
        });

        test('should call onToggleComments when comments button is clicked', () => {
            const onToggleComments = jest.fn();
            renderWithContext(
                <WikiPageHeader
                    {...defaultProps}
                    onToggleComments={onToggleComments}
                />,
                getInitialState(),
            );

            fireEvent.click(screen.getByTestId('wiki-page-toggle-comments'));

            expect(onToggleComments).toHaveBeenCalledTimes(1);
        });
    });

    describe('Fullscreen functionality', () => {
        test('should render fullscreen button when onToggleFullscreen is provided', () => {
            renderWithContext(
                <WikiPageHeader
                    {...defaultProps}
                    onToggleFullscreen={jest.fn()}
                />,
                getInitialState(),
            );

            expect(screen.getByTestId('wiki-page-fullscreen-button')).toBeInTheDocument();
        });

        test('should call onToggleFullscreen when fullscreen button is clicked', () => {
            const onToggleFullscreen = jest.fn();
            renderWithContext(
                <WikiPageHeader
                    {...defaultProps}
                    onToggleFullscreen={onToggleFullscreen}
                />,
                getInitialState(),
            );

            fireEvent.click(screen.getByTestId('wiki-page-fullscreen-button'));

            expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
        });
    });

    describe('Draft vs Published page', () => {
        test('should show Update button for existing page in edit mode', () => {
            renderWithContext(
                <WikiPageHeader
                    {...defaultProps}
                    isDraft={true}
                    isExistingPage={true}
                />,
                getInitialState(),
            );

            const publishButton = screen.getByTestId('wiki-page-publish-button');
            expect(publishButton).toHaveTextContent('Update');
        });

        test('should show Publish button for new draft', () => {
            renderWithContext(
                <WikiPageHeader
                    {...defaultProps}
                    isDraft={true}
                    isExistingPage={false}
                />,
                getInitialState(),
            );

            const publishButton = screen.getByTestId('wiki-page-publish-button');
            expect(publishButton).toHaveTextContent('Publish');
        });
    });

    describe('Edit button disabled state', () => {
        test('should disable edit button when canEdit is false', () => {
            renderWithContext(
                <WikiPageHeader
                    {...defaultProps}
                    canEdit={false}
                />,
                getInitialState(),
            );

            expect(screen.getByTestId('wiki-page-edit-button')).toBeDisabled();
        });

        test('should enable edit button when canEdit is true', () => {
            renderWithContext(
                <WikiPageHeader
                    {...defaultProps}
                    canEdit={true}
                />,
                getInitialState(),
            );

            expect(screen.getByTestId('wiki-page-edit-button')).toBeEnabled();
        });
    });
});
