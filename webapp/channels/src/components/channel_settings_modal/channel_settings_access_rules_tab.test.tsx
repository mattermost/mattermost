// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelSettingsAccessRulesTab from './channel_settings_access_rules_tab';

describe('components/channel_settings_modal/ChannelSettingsAccessRulesTab', () => {
    const baseProps = {
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
            name: 'test-channel',
            display_name: 'Test Channel',
            type: 'P',
        }),
        setAreThereUnsavedChanges: jest.fn(),
        showTabSwitchError: false,
    };

    const initialState = {
        entities: {
            general: {
                config: {},
            },
            users: {
                currentUserId: 'current_user_id',
            },
        },
        plugins: {
            components: {},
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });

    test('should render access rules title and subtitle', () => {
        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        expect(screen.getByRole('heading', {name: 'Access Rules'})).toBeInTheDocument();
        expect(screen.getByText('Select user attributes and values as rules to restrict channel membership')).toBeInTheDocument();
    });

    test('should render access rules description', () => {
        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        expect(screen.getByText('Select attributes and values that users must match in addition to access this channel. All selected attributes are required.')).toBeInTheDocument();
    });

    test('should render with main container class', () => {
        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        expect(screen.getByText('Access Rules').closest('.ChannelSettingsModal__accessRulesTab')).toBeInTheDocument();
    });

    test('should handle missing optional props gracefully', () => {
        const minimalProps = {
            channel: baseProps.channel,
        };

        expect(() => {
            renderWithContext(
                <ChannelSettingsAccessRulesTab {...minimalProps}/>,
                initialState,
            );
        }).not.toThrow();

        expect(screen.getByRole('heading', {name: 'Access Rules'})).toBeInTheDocument();
    });

    test('should render header section with correct structure', () => {
        renderWithContext(
            <ChannelSettingsAccessRulesTab {...baseProps}/>,
            initialState,
        );

        const header = screen.getByText('Access Rules').closest('.ChannelSettingsModal__accessRulesHeader');
        expect(header).toBeInTheDocument();

        // Check that both title and subtitle are within the header
        const title = screen.getByRole('heading', {name: 'Access Rules'});
        const subtitle = screen.getByText('Select user attributes and values as rules to restrict channel membership');

        expect(header).toContainElement(title);
        expect(header).toContainElement(subtitle);
    });

    test('should render with different channel types', () => {
        const publicChannel = TestHelper.getChannelMock({
            id: 'public_channel_id',
            name: 'public-channel',
            display_name: 'Public Channel',
            type: 'O',
        });

        const propsWithPublicChannel = {
            ...baseProps,
            channel: publicChannel,
        };

        renderWithContext(
            <ChannelSettingsAccessRulesTab {...propsWithPublicChannel}/>,
            initialState,
        );

        expect(screen.getByRole('heading', {name: 'Access Rules'})).toBeInTheDocument();
        expect(screen.getByText('Select user attributes and values as rules to restrict channel membership')).toBeInTheDocument();
    });
});
