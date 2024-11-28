// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';

import type {ChannelType} from '@mattermost/types/channels';

import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';
import {renderWithIntl} from 'tests/react_testing_utils';

import FileSearchResultItem from './file_search_result_item';

describe('components/file_search_result/FileSearchResultItem', () => {
    const baseProps = {
        channelId: 'channel_id',
        fileInfo: TestHelper.getFileInfoMock({}),
        channelDisplayName: '',
        channelType: Constants.OPEN_CHANNEL as ChannelType,
        teamName: 'test-team-name',
        onClick: jest.fn(),
        actions: {
            openModal: jest.fn(),
        },
    };

    test('should render file search result item correctly', () => {
        renderWithIntl(<FileSearchResultItem {...baseProps}/>);

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

        renderWithIntl(<FileSearchResultItem {...props}/>);

        expect(screen.getByText('test')).toBeInTheDocument();
    });

    test('should render with DM channel type', () => {
        const props = {
            ...baseProps,
            channelDisplayName: 'test',
            channelType: Constants.DM_CHANNEL as ChannelType,
        };

        renderWithIntl(<FileSearchResultItem {...props}/>);

        expect(screen.getByText('Direct Message')).toBeInTheDocument();
    });

    test('should render with GM channel type', () => {
        const props = {
            ...baseProps,
            channelDisplayName: 'test',
            channelType: Constants.GM_CHANNEL as ChannelType,
        };

        renderWithIntl(<FileSearchResultItem {...props}/>);

        expect(screen.getByText('Group Message')).toBeInTheDocument();
    });
});
