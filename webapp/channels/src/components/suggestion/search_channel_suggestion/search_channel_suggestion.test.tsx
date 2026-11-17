// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import SearchChannelSuggestion from './search_channel_suggestion';

function makeState(overrides: any[] = []) {
    return {plugins: {components: {ChannelIconOverride: overrides}}} as any;
}

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

    test('should render override icon for open channel when matcher matches', () => {
        const mockChannel = TestHelper.getChannelMock({type: 'O'});
        const props = {...baseProps, item: mockChannel};
        const {container} = renderWithContext(
            <SearchChannelSuggestion {...props}/>,
            makeState([{id: '1', pluginId: 'mbe', matcher: () => true, iconName: 'shield-outline'}]),
        );

        const icon = container.querySelector('i');
        expect(icon).toHaveClass('icon', 'icon-shield-outline');
        expect(icon).not.toHaveClass('icon-globe');
    });

    test('should render fallback icon for open channel when matcher returns false', () => {
        const mockChannel = TestHelper.getChannelMock({type: 'O'});
        const props = {...baseProps, item: mockChannel};
        const {container} = renderWithContext(
            <SearchChannelSuggestion {...props}/>,
            makeState([{id: '1', pluginId: 'mbe', matcher: () => false, iconName: 'shield-outline'}]),
        );

        const icon = container.querySelector('i');
        expect(icon).toHaveClass('icon', 'icon-globe');
    });
});
