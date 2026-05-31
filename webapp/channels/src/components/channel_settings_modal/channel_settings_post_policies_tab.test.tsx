// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelSettingsPostPoliciesTab from './channel_settings_post_policies_tab';

jest.mock('hooks/useChannelAccessControlActions');

const mockUseChannelAccessControlActions = useChannelAccessControlActions as jest.MockedFunction<typeof useChannelAccessControlActions>;

describe('components/channel_settings_modal/ChannelSettingsPostPoliciesTab', () => {
    const mockActions = {
        getAccessControlFields: jest.fn(),
        getVisualAST: jest.fn(),
        searchUsers: jest.fn(),
        getChannelPolicy: jest.fn(),
        saveChannelPolicy: jest.fn(),
        deleteChannelPolicy: jest.fn(),
        getChannelMembers: jest.fn(),
        createJob: jest.fn(),
        createAccessControlSyncJob: jest.fn(),
        updateAccessControlPoliciesActive: jest.fn(),
        validateExpressionAgainstRequester: jest.fn(),
    };

    const baseProps = {
        channel: TestHelper.getChannelMock({
            id: 'channel_id',
            name: 'test-channel',
            display_name: 'Test Channel',
            type: 'P',
        }),
        setAreThereUnsavedChanges: jest.fn(),
    };

    const initialState = {
        entities: {
            general: {config: {}},
            users: {currentUserId: 'u1', profiles: {u1: {id: 'u1'}}},
            roles: {roles: {}},
            channels: {channels: {}, membersInChannel: {}, messageCounts: {}},
            teams: {teams: {}},
            preferences: {myPreferences: {}},
        },
        plugins: {components: {}},
    };

    beforeEach(() => {
        Object.values(mockActions).forEach((m) => (m as jest.Mock).mockReset());
        mockUseChannelAccessControlActions.mockReturnValue(mockActions);
        // Default: no existing policy. Component treats 404 as empty.
        mockActions.getChannelPolicy.mockRejectedValue(new Error('Policy not found (404)'));
        console.error = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders the empty state when no post policies exist', async () => {
        renderWithContext(
            <ChannelSettingsPostPoliciesTab {...baseProps}/>,
            initialState,
        );

        await waitFor(() => {
            expect(screen.getByTestId('post-policies-empty')).toBeInTheDocument();
        });
        expect(screen.queryByTestId('post-policy-card-0')).not.toBeInTheDocument();
    });

    test('seeds one card per existing post_filter rule and preserves membership rule on save', async () => {
        mockActions.getChannelPolicy.mockResolvedValue({
            data: {
                id: 'channel_id',
                name: 'Test Channel',
                type: 'channel',
                rules: [
                    {actions: ['membership'], expression: 'user.attributes.team == "ops"'},
                    {actions: ['post_filter'], expression: 'post.attributes.lvl == "L1"'},
                    {actions: ['post_filter'], expression: 'post.attributes.lvl == "L2"'},
                ],
            },
        });
        mockActions.saveChannelPolicy.mockResolvedValue({data: {success: true}});

        renderWithContext(
            <ChannelSettingsPostPoliciesTab {...baseProps}/>,
            initialState,
        );

        await waitFor(() => {
            expect(screen.getByTestId('post-policy-card-0')).toBeInTheDocument();
        });
        expect(screen.getByTestId('post-policy-card-1')).toBeInTheDocument();
        expect(screen.queryByTestId('post-policy-card-2')).not.toBeInTheDocument();

        const textarea = screen.getByTestId('post-policy-expression-0') as HTMLTextAreaElement;
        expect(textarea.value).toBe('post.attributes.lvl == "L1"');

        await userEvent.clear(textarea);
        await userEvent.type(textarea, 'post.attributes.lvl == "L3"');
        await userEvent.click(screen.getByTestId('post-policy-save-0'));

        await waitFor(() => {
            expect(mockActions.saveChannelPolicy).toHaveBeenCalledTimes(1);
        });
        const sent = mockActions.saveChannelPolicy.mock.calls[0][0];

        // Membership rule must survive the save.
        expect(sent.rules).toEqual(expect.arrayContaining([
            expect.objectContaining({actions: ['membership'], expression: 'user.attributes.team == "ops"'}),
        ]));

        // Post-filter rules: original L2 + edited L3 (L1 replaced).
        const postFilterExprs = sent.rules.
            filter((r: any) => r.actions?.includes('post_filter')).
            map((r: any) => r.expression);
        expect(postFilterExprs).toEqual(expect.arrayContaining(['post.attributes.lvl == "L3"', 'post.attributes.lvl == "L2"']));
        expect(postFilterExprs).toHaveLength(2);
    });

    test('add then cancel a draft card without hitting the server', async () => {
        renderWithContext(
            <ChannelSettingsPostPoliciesTab {...baseProps}/>,
            initialState,
        );
        await waitFor(() => screen.getByTestId('post-policies-empty'));

        await userEvent.click(screen.getByTestId('post-policies-add'));
        expect(screen.getByTestId('post-policy-card-0')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('post-policy-delete-0'));
        expect(screen.queryByTestId('post-policy-card-0')).not.toBeInTheDocument();
        expect(mockActions.saveChannelPolicy).not.toHaveBeenCalled();
    });

    test('saving a new draft sends a post_filter rule to saveChannelPolicy', async () => {
        mockActions.saveChannelPolicy.mockResolvedValue({data: {success: true}});

        renderWithContext(
            <ChannelSettingsPostPoliciesTab {...baseProps}/>,
            initialState,
        );
        await waitFor(() => screen.getByTestId('post-policies-empty'));

        await userEvent.click(screen.getByTestId('post-policies-add'));
        const textarea = screen.getByTestId('post-policy-expression-0');
        await userEvent.type(textarea, 'post.attributes.x == "y"');
        await userEvent.click(screen.getByTestId('post-policy-save-0'));

        await waitFor(() => expect(mockActions.saveChannelPolicy).toHaveBeenCalledTimes(1));
        const sent = mockActions.saveChannelPolicy.mock.calls[0][0];
        expect(sent.id).toBe('channel_id');
        expect(sent.rules).toEqual([
            {actions: ['post_filter'], expression: 'post.attributes.x == "y"'},
        ]);
    });

    test('renders server-side validation error inline and keeps card editable', async () => {
        mockActions.saveChannelPolicy.mockResolvedValue({
            error: {message: 'invalid CEL: unexpected token'},
        });

        renderWithContext(
            <ChannelSettingsPostPoliciesTab {...baseProps}/>,
            initialState,
        );
        await waitFor(() => screen.getByTestId('post-policies-empty'));

        await userEvent.click(screen.getByTestId('post-policies-add'));
        await userEvent.type(screen.getByTestId('post-policy-expression-0'), 'totally bogus');
        await userEvent.click(screen.getByTestId('post-policy-save-0'));

        await waitFor(() => expect(screen.getByTestId('post-policy-error-0')).toHaveTextContent('invalid CEL: unexpected token'));

        // The card stays so the user can fix it; the save button re-enables once
        // the error is cleared (typing clears it).
        expect(screen.getByTestId('post-policy-card-0')).toBeInTheDocument();
    });

    test('deleting a saved card writes the policy without that rule', async () => {
        mockActions.getChannelPolicy.mockResolvedValue({
            data: {
                id: 'channel_id',
                name: 'Test Channel',
                type: 'channel',
                rules: [
                    {actions: ['post_filter'], expression: 'post.attributes.lvl == "L1"'},
                    {actions: ['post_filter'], expression: 'post.attributes.lvl == "L2"'},
                ],
            },
        });
        mockActions.saveChannelPolicy.mockResolvedValue({data: {success: true}});

        renderWithContext(
            <ChannelSettingsPostPoliciesTab {...baseProps}/>,
            initialState,
        );

        await waitFor(() => expect(screen.getByTestId('post-policy-card-0')).toBeInTheDocument());
        await userEvent.click(screen.getByTestId('post-policy-delete-0'));

        await waitFor(() => expect(mockActions.saveChannelPolicy).toHaveBeenCalledTimes(1));
        const sent = mockActions.saveChannelPolicy.mock.calls[0][0];
        const postFilterExprs = sent.rules.
            filter((r: any) => r.actions?.includes('post_filter')).
            map((r: any) => r.expression);
        expect(postFilterExprs).toEqual(['post.attributes.lvl == "L2"']);
    });
});
