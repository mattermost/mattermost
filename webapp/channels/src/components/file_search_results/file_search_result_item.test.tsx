// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import {renderWithContext} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import FileSearchResultItem from './file_search_result_item';

describe('components/file_search_result/FileSearchResultItem', () => {
    const baseProps = {
        channelId: 'channel_id',
        fileInfo: TestHelper.getFileInfoMock({}),
        channelDisplayName: '',
        channelType: Constants.OPEN_CHANNEL as ChannelType,
        teamName: 'test-team-name',
        channel: TestHelper.getChannelMock(),
        enableSharedChannelsPlugins: false,
        onClick: jest.fn(),
        actions: {
            openModal: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <FileSearchResultItem {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with channel name', () => {
        const props = {
            ...baseProps,
            channelDisplayName: 'test',
        };

        const {container} = renderWithContext(
            <FileSearchResultItem {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with DM', () => {
        const props = {
            ...baseProps,
            channelDisplayName: 'test',
            channelType: Constants.DM_CHANNEL as ChannelType,
        };

        const {container} = renderWithContext(
            <FileSearchResultItem {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with GM', () => {
        const props = {
            ...baseProps,
            channelDisplayName: 'test',
            channelType: Constants.GM_CHANNEL as ChannelType,
        };

        const {container} = renderWithContext(
            <FileSearchResultItem {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
