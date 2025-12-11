// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithIntl} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SearchChannelSuggestion from './search_channel_suggestion';

describe('components/suggestion/search_channel_suggestion', () => {
    const mockChannel = TestHelper.getChannelMock();

    const baseProps = {
        id: 'test-suggestion',
        item: mockChannel,
        isSelection: false,
        currentUserId: 'userid1',
        teammateIsBot: false,
        term: '',
        matchedPretext: '',
        onClick: vi.fn(),
        onMouseMove: vi.fn(),
    };

    test('should match snapshot', () => {
        const {container} = renderWithIntl(
            <SearchChannelSuggestion {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, isSelection is false', () => {
        const props = {...baseProps, isSelection: false};
        const {container} = renderWithIntl(
            <SearchChannelSuggestion {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, isSelection is true', () => {
        const props = {...baseProps, isSelection: true};
        const {container} = renderWithIntl(
            <SearchChannelSuggestion {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, channel type DM_CHANNEL', () => {
        const channel = {...mockChannel, type: 'D' as const};
        const props = {...baseProps, item: channel, isSelection: true};
        const {container} = renderWithIntl(
            <SearchChannelSuggestion {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, channel type GM_CHANNEL', () => {
        const channel = {...mockChannel, type: 'G' as const};
        const props = {...baseProps, item: channel, isSelection: true};
        const {container} = renderWithIntl(
            <SearchChannelSuggestion {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, channel type OPEN_CHANNEL', () => {
        const channel = {...mockChannel, type: 'O' as const};
        const props = {...baseProps, item: channel, isSelection: true};
        const {container} = renderWithIntl(
            <SearchChannelSuggestion {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, channel type PRIVATE_CHANNEL', () => {
        const channel = {...mockChannel, type: 'P' as const};
        const props = {...baseProps, item: channel, isSelection: true};
        const {container} = renderWithIntl(
            <SearchChannelSuggestion {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
