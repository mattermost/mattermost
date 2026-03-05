// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SearchChannelSuggestion from './search_channel_suggestion';

describe('components/suggestion/search_channel_suggestion', () => {
    const baseProps = {
        id: 'test-suggestion',
        item: TestHelper.getChannelMock(),
        isSelection: false,
        currentUserId: 'userid1',
        teammateIsBot: false,
        term: '',
        matchedPretext: '',
        onClick: jest.fn(),
        onMouseMove: jest.fn(),
    };

    test('should match snapshot', () => {
        const {container} = render(
            <SearchChannelSuggestion {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, isSelection is false', () => {
        const props = {...baseProps, isSelection: false};
        const {container} = render(
            <SearchChannelSuggestion {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, isSelection is true', () => {
        const props = {...baseProps, isSelection: true};
        const {container} = render(
            <SearchChannelSuggestion {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, channel type DM_CHANNEL', () => {
        const mockChannel = TestHelper.getChannelMock({type: 'D'});
        const props = {...baseProps, item: mockChannel, isSelection: true};
        const {container} = render(
            <SearchChannelSuggestion {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, channel type GM_CHANNEL', () => {
        const mockChannel = TestHelper.getChannelMock({type: 'G'});
        const props = {...baseProps, item: mockChannel, isSelection: true};
        const {container} = render(
            <SearchChannelSuggestion {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, channel type OPEN_CHANNEL', () => {
        const mockChannel = TestHelper.getChannelMock({type: 'O'});
        const props = {...baseProps, item: mockChannel, isSelection: true};
        const {container} = render(
            <SearchChannelSuggestion {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, channel type PRIVATE_CHANNEL', () => {
        const mockChannel = TestHelper.getChannelMock({type: 'P'});
        const props = {...baseProps, item: mockChannel, isSelection: true};
        const {container} = render(
            <SearchChannelSuggestion {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
