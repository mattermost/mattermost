// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderPlug, {maxComponentsBeforeDropdown} from './channel_header_plug';

describe('plugins/ChannelHeaderPlug', () => {
    const baseProps = {
        components: [],
        channel: TestHelper.getChannelMock({id: 'channel1'}),
        channelMember: TestHelper.getChannelMembershipMock({channel_id: 'channel1', user_id: 'user1'}),
        sidebarOpen: false,
        actions: {
            handleBindingClick: jest.fn(),
            postEphemeralCallResponseForChannel: jest.fn(),
            openAppsModal: jest.fn(),
        },
        appBindings: [],
        appsEnabled: false,
        shouldShowAppBar: false,
    };

    function makeTestPlug(n = 1) {
        return {
            id: 'someid' + n,
            pluginId: 'pluginid' + n,
            icon: <i className='fa fa-anchor'/>,
            action: jest.fn,
            dropdownText: 'some dropdown text ' + n,
            tooltipText: 'some tooltip text ' + n,
        };
    }

    test('should not render anything with no extended component', () => {
        const {container} = renderWithContext(
            <ChannelHeaderPlug
                {...baseProps}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('should render a single plug', () => {
        renderWithContext(
            <ChannelHeaderPlug
                {...baseProps}
                components={[makeTestPlug()]}
            />,
        );

        expect(screen.getByLabelText('some tooltip text 1')).toBeInTheDocument();
    });

    test(`should render ${maxComponentsBeforeDropdown} plugs in the header`, () => {
        const components = [];
        for (let i = 0; i < maxComponentsBeforeDropdown; i++) {
            components.push(makeTestPlug(i));
        }

        renderWithContext(
            <ChannelHeaderPlug
                {...baseProps}
                components={components}
            />,
        );

        for (let i = 0; i < components.length; i++) {
            expect(screen.getByLabelText('some tooltip text ' + i)).toBeInTheDocument();
        }
    });

    test(`should render more than ${maxComponentsBeforeDropdown} plugs in a dropdown`, () => {
        const components = [];
        for (let i = 0; i < maxComponentsBeforeDropdown + 1; i++) {
            components.push(makeTestPlug(i));
        }

        renderWithContext(
            <ChannelHeaderPlug
                {...baseProps}
                components={components}
            />,
        );

        for (let i = 0; i < components.length; i++) {
            expect(screen.queryByLabelText('some tooltip text ' + i)).not.toBeInTheDocument();
        }

        // Ideally, this would identify the dropdown button better, but this uses a custom dropdown which is
        // not at all accessible
        expect(screen.getByRole('button', {name: components.length.toString()})).toBeVisible();
    });

    test('should not render anything when the App Bar is visible', () => {
        const {container} = renderWithContext(
            <ChannelHeaderPlug
                {...baseProps}
                components={[
                    makeTestPlug(1),
                    makeTestPlug(2),
                    makeTestPlug(3),
                    makeTestPlug(4),
                ]}
                shouldShowAppBar={true}
            />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('blocks external app binding icon when BlockExternalImages is true and renders internal/unblocked icons', () => {
        const externalBinding = {
            app_id: 'app1',
            location: 'channel_header_1',
            label: 'App 1',
            icon: 'https://evil.example/icon.png',
        };
        const internalBinding = {
            app_id: 'app2',
            location: 'channel_header_2',
            label: 'App 2',
            icon: 'https://mm.example.com/static/icon.png',
        };

        const {container, unmount} = renderWithContext(
            <ChannelHeaderPlug
                {...baseProps}
                appsEnabled={true}
                appBindings={[externalBinding, internalBinding]}
            />,
            {
                entities: {
                    general: {
                        config: {
                            BlockExternalImages: 'true',
                            SiteURL: 'https://mm.example.com',
                        },
                    },
                },
            },
        );

        expect(container.querySelector('img[src="https://evil.example/icon.png"]')).toBeNull();
        const blockedButton = container.querySelector('#app1_channel_header_1');
        expect(blockedButton).not.toBeNull();
        expect(blockedButton!.querySelector('.icon--standard svg')).not.toBeNull();
        expect(container.querySelector('img[src="https://mm.example.com/static/icon.png"]')).not.toBeNull();
        unmount();

        const {container: unblockedContainer} = renderWithContext(
            <ChannelHeaderPlug
                {...baseProps}
                appsEnabled={true}
                appBindings={[externalBinding]}
            />,
            {
                entities: {
                    general: {
                        config: {
                            BlockExternalImages: 'false',
                            SiteURL: 'https://mm.example.com',
                        },
                    },
                },
            },
        );

        expect(unblockedContainer.querySelector('img[src="https://evil.example/icon.png"]')).not.toBeNull();
    });

    test('blocks external app binding icons in dropdown when BlockExternalImages is true and renders internal icons', () => {
        const appBindings = [
            {
                app_id: 'external_app',
                location: 'channel_header_external',
                label: 'External App',
                icon: 'https://evil.example/dropdown-icon.png',
            },
            ...Array.from({length: maxComponentsBeforeDropdown}, (_, idx) => ({
                app_id: `internal_app_${idx}`,
                location: `channel_header_${idx}`,
                label: `Internal App ${idx}`,
                icon: `https://mm.example.com/static/icon_${idx}.png`,
            })),
        ];

        const {container} = renderWithContext(
            <ChannelHeaderPlug
                {...baseProps}
                appsEnabled={true}
                appBindings={appBindings}
            />,
            {
                entities: {
                    general: {
                        config: {
                            BlockExternalImages: 'true',
                            SiteURL: 'https://mm.example.com',
                        },
                    },
                },
            },
        );

        expect(screen.getByRole('button', {name: appBindings.length.toString()})).toBeVisible();
        expect(container.querySelector('img[src="https://evil.example/dropdown-icon.png"]')).toBeNull();
        expect(container.querySelector('img[src="https://mm.example.com/static/icon_0.png"]')).not.toBeNull();
    });
});
