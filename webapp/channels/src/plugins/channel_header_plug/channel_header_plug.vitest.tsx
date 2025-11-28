// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';

import {renderWithContext, screen, cleanup, act} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelHeaderPlug, {maxComponentsBeforeDropdown} from './channel_header_plug';

describe('plugins/ChannelHeaderPlug', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(async () => {
        await act(async () => {
            vi.runAllTimers();
        });
        vi.useRealTimers();
        cleanup();
    });

    const baseProps = {
        components: [],
        channel: TestHelper.getChannelMock({id: 'channel1'}),
        channelMember: TestHelper.getChannelMembershipMock({channel_id: 'channel1', user_id: 'user1'}),
        sidebarOpen: false,
        actions: {
            handleBindingClick: vi.fn(),
            postEphemeralCallResponseForChannel: vi.fn(),
            openAppsModal: vi.fn(),
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
            action: vi.fn(),
            dropdownText: 'some dropdown text ' + n,
            tooltipText: 'some tooltip text ' + n,
        };
    }

    test('should not render anything with no extended component', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <ChannelHeaderPlug
                    {...baseProps}
                />,
            );
            container = result.container;
            vi.runAllTimers();
        });

        expect(container!).toBeEmptyDOMElement();
    });

    test('should render a single plug', async () => {
        await act(async () => {
            renderWithContext(
                <ChannelHeaderPlug
                    {...baseProps}
                    components={[makeTestPlug()]}
                />,
            );
            vi.runAllTimers();
        });

        expect(screen.getByLabelText('some tooltip text 1')).toBeInTheDocument();
    });

    test(`should render ${maxComponentsBeforeDropdown} plugs in the header`, async () => {
        const components = [];
        for (let i = 0; i < maxComponentsBeforeDropdown; i++) {
            components.push(makeTestPlug(i));
        }

        await act(async () => {
            renderWithContext(
                <ChannelHeaderPlug
                    {...baseProps}
                    components={components}
                />,
            );
            vi.runAllTimers();
        });

        for (let i = 0; i < components.length; i++) {
            expect(screen.getByLabelText('some tooltip text ' + i)).toBeInTheDocument();
        }
    });

    test(`should render more than ${maxComponentsBeforeDropdown} plugs in a dropdown`, async () => {
        const components = [];
        for (let i = 0; i < maxComponentsBeforeDropdown + 1; i++) {
            components.push(makeTestPlug(i));
        }

        await act(async () => {
            renderWithContext(
                <ChannelHeaderPlug
                    {...baseProps}
                    components={components}
                />,
            );
            vi.runAllTimers();
        });

        for (let i = 0; i < components.length; i++) {
            expect(screen.queryByLabelText('some tooltip text ' + i)).not.toBeInTheDocument();
        }

        // Ideally, this would identify the dropdown button better, but this uses a custom dropdown which is
        // not at all accessible
        expect(screen.getByRole('button', {name: components.length.toString()})).toBeVisible();
    });

    test('should not render anything when the App Bar is visible', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
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
            container = result.container;
            vi.runAllTimers();
        });

        expect(container!).toBeEmptyDOMElement();
    });
});
