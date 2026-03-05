// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

import ActionBar from './action_bar';
import type {Props} from './action_bar';

describe('channel_members_rhs/action_bar', () => {
    const actionBarDefaultProps: Props = {
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

    test('should display Add button', async () => {
        const testProps: Props = {...actionBarDefaultProps};

        renderWithContext(
            <ActionBar
                {...testProps}
            />,
        );

        expect(screen.getByText('Add')).toBeInTheDocument();
        await userEvent.click(screen.getByText('Add'));
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

    test('should display Manage', async () => {
        const testProps: Props = {...actionBarDefaultProps};

        renderWithContext(
            <ActionBar
                {...testProps}
            />,
        );

        expect(screen.getByText('Manage')).toBeInTheDocument();
        await userEvent.click(screen.getByText('Manage'));
        expect(testProps.actions.startEditing).toHaveBeenCalled();
    });

    test('should display Done', async () => {
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
        await userEvent.click(screen.getByText('Done'));
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
});
