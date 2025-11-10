// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import * as officialChannelUtils from 'utils/official_channel_utils';
import {TestHelper} from 'utils/test_helper';

import ActionBar from './action_bar';
import type {Props} from './action_bar';

describe('channel_members_rhs/action_bar', () => {
    const actionBarDefaultProps: Props = {
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
            name: 'channel_name',
            type: 'O' as const,
        }),
        channelType: Constants.OPEN_CHANNEL,
        membersCount: 12,
        canManageMembers: true,
        editing: false,
        actions: {
            startEditing: jest.fn(),
            stopEditing: jest.fn(),
            inviteMembers: jest.fn(),
        },
    };

    beforeEach(() => {
        actionBarDefaultProps.actions = {
            startEditing: jest.fn(),
            stopEditing: jest.fn(),
            inviteMembers: jest.fn(),
        };
    });

    test('should display the members count', () => {
        const testProps: Props = {...actionBarDefaultProps};

        renderWithContext(
            <ActionBar
                {...testProps}
            />,
        );

        expect(screen.getByText(`${testProps.membersCount} members`)).toBeInTheDocument();
    });

    test('should display Add button', () => {
        const testProps: Props = {...actionBarDefaultProps};

        renderWithContext(
            <ActionBar
                {...testProps}
            />,
        );

        expect(screen.getByText('Add')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Add'));
        expect(testProps.actions.inviteMembers).toHaveBeenCalled();
    });

    test('should not display Add button to members', () => {
        const testProps: Props = {...actionBarDefaultProps, canManageMembers: false};

        renderWithContext(
            <ActionBar
                {...testProps}
            />,
        );

        expect(screen.queryByText('Add')).not.toBeInTheDocument();
    });

    test('should display Manage', () => {
        const testProps: Props = {...actionBarDefaultProps};

        renderWithContext(
            <ActionBar
                {...testProps}
            />,
        );

        expect(screen.getByText('Manage')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Manage'));
        expect(testProps.actions.startEditing).toHaveBeenCalled();
    });

    test('should display Done', () => {
        const testProps: Props = {
            ...actionBarDefaultProps,
            editing: true,
        };

        renderWithContext(
            <ActionBar
                {...testProps}
            />,
        );

        expect(screen.getByText('Done')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Done'));
        expect(testProps.actions.stopEditing).toHaveBeenCalled();
    });

    test('should not display manage button to members', () => {
        const testProps: Props = {...actionBarDefaultProps, canManageMembers: false};

        renderWithContext(
            <ActionBar
                {...testProps}
            />,
        );

        expect(screen.queryByText('Manage')).not.toBeInTheDocument();
    });

    test('should not display Add button for official TUNAG channels', () => {
        // Mock the official channel detection function to return true
        jest.spyOn(officialChannelUtils, 'isOfficialTunagChannel').mockReturnValue(true);

        const officialChannel = TestHelper.getChannelMock({
            id: 'tunag_channel_id',
            name: 'tunag-12345-subdomain-admin',
            type: 'O' as const,
        });

        const testProps: Props = {
            ...actionBarDefaultProps,
            channel: officialChannel,
        };

        renderWithContext(
            <ActionBar
                {...testProps}
            />,
        );

        expect(screen.queryByText('Add')).not.toBeInTheDocument();
    });

    test('should not display Manage button for official TUNAG channels', () => {
        // Mock the official channel detection function to return true
        jest.spyOn(officialChannelUtils, 'isOfficialTunagChannel').mockReturnValue(true);

        const officialChannel = TestHelper.getChannelMock({
            id: 'tunag_channel_id',
            name: 'tunag-12345-subdomain-admin',
            type: 'O' as const,
        });

        const testProps: Props = {
            ...actionBarDefaultProps,
            channel: officialChannel,
        };

        renderWithContext(
            <ActionBar
                {...testProps}
            />,
        );

        expect(screen.queryByText('Manage')).not.toBeInTheDocument();
    });

    test('should display Add and Manage buttons for non-official channels', () => {
        // Mock the official channel detection function to return false
        jest.spyOn(officialChannelUtils, 'isOfficialTunagChannel').mockReturnValue(false);

        const regularChannel = TestHelper.getChannelMock({
            id: 'regular_channel_id',
            name: 'regular-channel',
            type: 'O' as const,
        });

        const testProps: Props = {
            ...actionBarDefaultProps,
            channel: regularChannel,
        };

        renderWithContext(
            <ActionBar
                {...testProps}
            />,
        );

        expect(screen.getByText('Add')).toBeInTheDocument();
        expect(screen.getByText('Manage')).toBeInTheDocument();
    });
});
