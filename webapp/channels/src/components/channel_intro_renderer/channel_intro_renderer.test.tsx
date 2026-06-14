// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {ChannelIntroRegistration} from 'types/store/plugins';

import ChannelIntroRenderer from './channel_intro_renderer';

const mockChannel = TestHelper.getChannelMock({id: 'channel-1'});

const makeRegistration = (component: React.ComponentType<any>): ChannelIntroRegistration => ({
    id: 'reg-1',
    pluginId: 'test-plugin',
    matcher: () => true,
    component,
});

const minimalState = {
    entities: {
        general: {config: {}},
        preferences: {myPreferences: {}},
        users: {currentUserId: 'user1', profiles: {}},
    },
} as any;

describe('components/channel_intro_renderer/ChannelIntroRenderer', () => {
    it('renders the plugin component with channel prop', () => {
        const PluginComponent = () => <div data-testid='plugin-component'/>;
        const reg = makeRegistration(PluginComponent);

        renderWithContext(
            <ChannelIntroRenderer
                registration={reg}
                channel={mockChannel}
            />,
            minimalState,
        );

        expect(screen.getByTestId('plugin-component')).toBeInTheDocument();
    });

    it('error boundary catches a crashing component and host area stays mounted', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const Crasher = (): null => {
            throw new Error('test crash');
        };
        const reg = makeRegistration(Crasher);

        const {container} = renderWithContext(
            <ChannelIntroRenderer
                registration={reg}
                channel={mockChannel}
            />,
            minimalState,
        );

        expect(screen.getByText(/An error occurred/i)).toBeInTheDocument();
        expect(screen.getByText(/Refresh/i)).toBeInTheDocument();

        // Container is still mounted — the crash did not tear down the host DOM
        expect(container).toBeInTheDocument();

        consoleSpy.mockRestore();
    });
});
