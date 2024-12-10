// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type {ChannelType} from '@mattermost/types/channels';

import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';
import {renderWithContext} from 'tests/react_testing_utils';

import FileSearchResultItem from './file_search_result_item';

describe('components/file_search_result/FileSearchResultItem', () => {
    const baseProps = {
        channelId: 'channel_id',
        fileInfo: TestHelper.getFileInfoMock({
            post_id: 'post_id_1'
        }),
        channelDisplayName: '',
        channelType: Constants.OPEN_CHANNEL as ChannelType,
        teamName: 'test-team-name',
        onClick: jest.fn(),
        actions: {
            openModal: jest.fn(),
        },
    };

    const initialState = {
        entities: {
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {},
            },
        },
    };

    test('should match component state with given props', () => {
        renderWithContext(<FileSearchResultItem {...baseProps}/>, initialState, {
            intlMessages: {
                'file_search_result_item.more_actions': 'More Actions',
                'file_search_result_item.download': 'Download'
            }
        });

        expect(screen.getByTestId('search-item-container')).toBeInTheDocument();
        expect(screen.getByText(baseProps.fileInfo.name)).toBeInTheDocument();
        expect(screen.getByLabelText('Download')).toBeInTheDocument();
        expect(screen.getByLabelText('More Actions')).toBeInTheDocument();
    });

    test('should render with channel name', () => {
        const props = {
            ...baseProps,
            channelDisplayName: 'test',
        };

        renderWithContext(<FileSearchResultItem {...props}/>, initialState);

        const channelName = screen.getByText('test');
        expect(channelName).toBeInTheDocument();
        expect(channelName).toHaveClass('TagText-bWgUzx');
    });

    test('should render with DM channel type', () => {
        const props = {
            ...baseProps,
            channelDisplayName: 'test',
            channelType: Constants.DM_CHANNEL as ChannelType,
        };

        renderWithContext(<FileSearchResultItem {...props}/>, initialState);

        const dmText = screen.getByText('Direct Message');
        expect(dmText).toBeInTheDocument();
        expect(dmText.closest('.Tag')).toBeInTheDocument();
    });

    test('should render with GM channel type', () => {
        const props = {
            ...baseProps,
            channelDisplayName: 'test',
            channelType: Constants.GM_CHANNEL as ChannelType,
        };

        renderWithContext(<FileSearchResultItem {...props}/>, initialState);

        const gmText = screen.getByText('Group Message');
        expect(gmText).toBeInTheDocument();
        expect(gmText.closest('.Tag')).toBeInTheDocument();
    });

    test('should handle menu actions correctly', () => {
        renderWithContext(<FileSearchResultItem {...baseProps}/>, initialState, {
            intlMessages: {
                'file_search_result_item.more_actions': 'More Actions',
                'file_search_result_item.open_in_channel': 'Open in channel',
                'file_search_result_item.copy_link': 'Copy link',
                'file_search_result_item.download': 'Download'
            }
        });

        const moreActionsButton = screen.getByLabelText('More Actions');
        userEvent.click(moreActionsButton);

        const openInChannelOption = screen.getByText('Open in channel');
        const copyLinkOption = screen.getByText('Copy link');

        expect(openInChannelOption).toBeInTheDocument();
        expect(copyLinkOption).toBeInTheDocument();
    });
});
