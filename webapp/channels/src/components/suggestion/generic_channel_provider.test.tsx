// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {GenericChannelSuggestion} from './generic_channel_provider';

describe('GenericChannelSuggestion', () => {
    const channel = TestHelper.getChannelMock({id: 'chan1', type: 'O', name: 'test', display_name: 'Test Channel'});
    const baseProps = {
        id: 'test-suggestion',
        item: channel,
        isSelection: false,
        term: 'test',
        matchedPretext: 'test',
        onClick: jest.fn(),
        onMouseMove: jest.fn(),
    };

    function makeState(overrides: any[] = []) {
        return {plugins: {components: {ChannelIconOverride: overrides}}} as any;
    }

    test('should render override icon when matcher matches', () => {
        const {container} = renderWithContext(
            <GenericChannelSuggestion
                ref={null}
                {...baseProps}
            />,
            makeState([{id: '1', pluginId: 'mbe', matcher: () => true, iconName: 'shield-outline'}]),
        );

        const icon = container.querySelector('i');
        expect(icon).toHaveClass('icon', 'icon-shield-outline');
        expect(icon).not.toHaveClass('icon-globe');
    });

    test('should render fallback globe icon when matcher returns false', () => {
        const {container} = renderWithContext(
            <GenericChannelSuggestion
                ref={null}
                {...baseProps}
            />,
            makeState([{id: '1', pluginId: 'mbe', matcher: () => false, iconName: 'shield-outline'}]),
        );

        const icon = container.querySelector('i');
        expect(icon).toHaveClass('icon', 'icon-globe');
    });
});
