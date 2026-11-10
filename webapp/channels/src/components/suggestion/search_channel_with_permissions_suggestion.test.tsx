// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {SearchChannelWithPermissionsSuggestion} from './search_channel_with_permissions_provider';

describe('SearchChannelWithPermissionsSuggestion', () => {
    const channel = TestHelper.getChannelMock({id: 'chan1', type: 'O', name: 'test', display_name: 'Test Channel', delete_at: 0});
    const baseProps = {
        id: 'test-suggestion',
        item: {channel, name: channel.name, deactivated: false, type: 'O' as const},
        isSelection: false,
        term: 'test',
        matchedPretext: 'test',
        onClick: jest.fn(),
        onMouseMove: jest.fn(),
    };

    function makeState(overrides: any[] = []) {
        return {plugins: {components: {ChannelIconOverride: overrides}}} as any;
    }

    it('should render override icon when matcher matches', () => {
        const {container} = renderWithContext(
            <SearchChannelWithPermissionsSuggestion
                ref={null}
                {...baseProps}
            />,
            makeState([{id: '1', pluginId: 'mbe', matcher: () => true, iconName: 'shield-outline'}]),
        );

        const icon = container.querySelector('i');
        expect(icon).toHaveClass('icon', 'icon-shield-outline');
        expect(icon).not.toHaveClass('icon-globe');
    });

    it('should render fallback globe icon when matcher returns false', () => {
        const {container} = renderWithContext(
            <SearchChannelWithPermissionsSuggestion
                ref={null}
                {...baseProps}
            />,
            makeState([{id: '1', pluginId: 'mbe', matcher: () => false, iconName: 'shield-outline'}]),
        );

        const icon = container.querySelector('i');
        expect(icon).toHaveClass('icon', 'icon-globe');
    });

    it('should announce "Public channel" for open channel', () => {
        const {container} = renderWithContext(
            <SearchChannelWithPermissionsSuggestion
                ref={null}
                {...baseProps}
            />,
            makeState(),
        );

        const span = container.querySelector('.suggestion-list__icon');
        expect(span).toHaveAttribute('aria-label', 'Public channel');
    });

    it('should announce "Private channel" for private channel', () => {
        const privateChannel = TestHelper.getChannelMock({id: 'chan2', type: 'P', name: 'private', display_name: 'Private Channel', delete_at: 0});
        const props = {
            ...baseProps,
            item: {channel: privateChannel, name: privateChannel.name, deactivated: false, type: 'P' as const},
        };
        const {container} = renderWithContext(
            <SearchChannelWithPermissionsSuggestion
                ref={null}
                {...props}
            />,
            makeState(),
        );

        const span = container.querySelector('.suggestion-list__icon');
        expect(span).toHaveAttribute('aria-label', 'Private channel');
    });

    it('should announce "Archived channel" for archived channel', () => {
        const archivedChannel = TestHelper.getChannelMock({id: 'chan3', type: 'O', name: 'archived', display_name: 'Archived Channel', delete_at: 1234});
        const props = {
            ...baseProps,
            item: {channel: archivedChannel, name: archivedChannel.name, deactivated: false, type: 'O' as const},
        };
        const {container} = renderWithContext(
            <SearchChannelWithPermissionsSuggestion
                ref={null}
                {...props}
            />,
            makeState(),
        );

        const span = container.querySelector('.suggestion-list__icon');
        expect(span).toHaveAttribute('aria-label', 'Archived channel');
    });
});
