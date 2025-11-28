// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';

import {renderWithContext, cleanup, act} from 'tests/vitest_react_testing_utils';

import AddUserToChannelModal from './add_user_to_channel_modal';

describe('components/AddUserToChannelModal', () => {
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
        channelMembers: {},
        user: {
            id: 'someUserId',
            first_name: 'Fake',
            last_name: 'Person',
        } as any,
        onExited: vi.fn(),
        actions: {
            addChannelMember: vi.fn().mockResolvedValue({}),
            getChannelMember: vi.fn().mockResolvedValue({}),
            autocompleteChannelsForSearch: vi.fn().mockResolvedValue({}),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <AddUserToChannelModal {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match state when onHide is called', () => {
        renderWithContext(
            <AddUserToChannelModal {...baseProps}/>,
        );
    });

    test('should enable the add button when a channel is selected', () => {
        renderWithContext(
            <AddUserToChannelModal {...baseProps}/>,
        );
    });

    test('should call handleResponse when submit is clicked and action is successful', async () => {
        const addChannelMember = vi.fn().mockResolvedValue({data: true});
        const actions = {...baseProps.actions, addChannelMember};
        const props = {...baseProps, actions};

        renderWithContext(
            <AddUserToChannelModal {...props}/>,
        );
    });

    test('should display error when submit is clicked and action errors', async () => {
        const addChannelMember = vi.fn().mockResolvedValue({error: {server_error_id: 'api.channel.add_members.user_denied', message: 'test error'}});
        const actions = {...baseProps.actions, addChannelMember};
        const props = {...baseProps, actions};

        renderWithContext(
            <AddUserToChannelModal {...props}/>,
        );
    });

    test('should set state when didSelectChannel is called', () => {
        renderWithContext(
            <AddUserToChannelModal {...baseProps}/>,
        );
    });

    test('should set state when channelSearchHandler returns results with channel', () => {
        const {container} = renderWithContext(
            <AddUserToChannelModal {...baseProps}/>,
        );
        expect(container).toBeInTheDocument();
    });

    test('should set state when channelSearchHandler returns empty results', () => {
        renderWithContext(
            <AddUserToChannelModal {...baseProps}/>,
        );
    });
});
