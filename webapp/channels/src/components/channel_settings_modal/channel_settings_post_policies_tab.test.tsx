// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {renderWithContext, screen, waitFor, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelSettingsPostPoliciesTab from './channel_settings_post_policies_tab';

jest.mock('hooks/useChannelAccessControlActions');

// Mock the CELEditor with a plain textarea so userEvent.type works in jsdom
// (Monaco doesn't render a real textarea). The mock forwards `onChange`,
// `value`, and surfaces `postAttributes` / `userAttributes` via data
// attributes so we can assert the editor receives them.
jest.mock(
    'components/admin_console/access_control/editors/cel_editor/editor',
    () => {
        const MockCELEditor = (props: any) => {
            return (
                <textarea
                    data-testid='cel-editor-mock'
                    data-user-attrs={JSON.stringify(props.userAttributes)}
                    data-post-attrs={JSON.stringify(props.postAttributes)}
                    value={props.value}
                    placeholder={props.placeholder}
                    disabled={props.disabled}
                    onChange={(e) => props.onChange(e.target.value)}
                />
            );
        };
        return {__esModule: true, default: MockCELEditor};
    },
);

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

    // A rule that satisfies the both-sides-required guard. Used everywhere a
    // valid expression needs to be saved.
    const validRule = (lvl: string) => `post.attributes.lvl == "${lvl}" && user.attributes.rank == "R1"`;

    let getPropertyFieldsSpy: jest.SpyInstance;

    beforeEach(() => {
        Object.values(mockActions).forEach((m) => (m as jest.Mock).mockReset());
        mockUseChannelAccessControlActions.mockReturnValue(mockActions);
        // Default: no existing policy. Component treats 404 as empty.
        mockActions.getChannelPolicy.mockRejectedValue(new Error('Policy not found (404)'));
        // Default: no CPA fields and no post property fields. Tests that need
        // them override these.
        mockActions.getAccessControlFields.mockResolvedValue({data: []});
        getPropertyFieldsSpy = jest.
            spyOn(Client4, 'getPropertyFields').
            mockResolvedValue([]);
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
                    {actions: ['post_filter'], expression: validRule('L1')},
                    {actions: ['post_filter'], expression: validRule('L2')},
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

        const editors = screen.getAllByTestId('cel-editor-mock') as HTMLTextAreaElement[];
        expect(editors[0].value).toBe(validRule('L1'));

        await userEvent.clear(editors[0]);
        await userEvent.type(editors[0], validRule('L3'));
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
        expect(postFilterExprs).toEqual(expect.arrayContaining([validRule('L3'), validRule('L2')]));
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
        const editor = screen.getByTestId('cel-editor-mock') as HTMLTextAreaElement;
        await userEvent.type(editor, validRule('L1'));
        await userEvent.click(screen.getByTestId('post-policy-save-0'));

        await waitFor(() => expect(mockActions.saveChannelPolicy).toHaveBeenCalledTimes(1));
        const sent = mockActions.saveChannelPolicy.mock.calls[0][0];
        expect(sent.id).toBe('channel_id');
        expect(sent.rules).toEqual([
            {actions: ['post_filter'], expression: validRule('L1')},
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

        // Use a syntactically valid (both-sides) expression so the
        // client-side guard passes and the server returns the error.
        await userEvent.type(screen.getByTestId('cel-editor-mock'), validRule('Bogus'));
        await userEvent.click(screen.getByTestId('post-policy-save-0'));

        await waitFor(() => expect(screen.getByTestId('post-policy-error-0')).toHaveTextContent('invalid CEL: unexpected token'));

        // The card stays so the user can fix it.
        expect(screen.getByTestId('post-policy-card-0')).toBeInTheDocument();
    });

    test('deleting a saved card writes the policy without that rule', async () => {
        mockActions.getChannelPolicy.mockResolvedValue({
            data: {
                id: 'channel_id',
                name: 'Test Channel',
                type: 'channel',
                rules: [
                    {actions: ['post_filter'], expression: validRule('L1')},
                    {actions: ['post_filter'], expression: validRule('L2')},
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
        expect(postFilterExprs).toEqual([validRule('L2')]);
    });

    // ----- Slice 7 additions -----

    test('blocks save and shows inline error when rule references only post.attributes', async () => {
        renderWithContext(
            <ChannelSettingsPostPoliciesTab {...baseProps}/>,
            initialState,
        );
        await waitFor(() => screen.getByTestId('post-policies-empty'));

        await userEvent.click(screen.getByTestId('post-policies-add'));
        await userEvent.type(screen.getByTestId('cel-editor-mock'), 'post.attributes.lvl == "L1"');
        await userEvent.click(screen.getByTestId('post-policy-save-0'));

        // Local guard fires synchronously, no server call.
        expect(mockActions.saveChannelPolicy).not.toHaveBeenCalled();
        expect(screen.getByTestId('post-policy-error-0')).toHaveTextContent(
            /at least one post\.attributes.*and one user\.attributes/i,
        );
    });

    test('blocks save and shows inline error when rule references only user.attributes', async () => {
        renderWithContext(
            <ChannelSettingsPostPoliciesTab {...baseProps}/>,
            initialState,
        );
        await waitFor(() => screen.getByTestId('post-policies-empty'));

        await userEvent.click(screen.getByTestId('post-policies-add'));
        await userEvent.type(screen.getByTestId('cel-editor-mock'), 'user.attributes.rank == "R1"');
        await userEvent.click(screen.getByTestId('post-policy-save-0'));

        expect(mockActions.saveChannelPolicy).not.toHaveBeenCalled();
        expect(screen.getByTestId('post-policy-error-0')).toHaveTextContent(
            /at least one post\.attributes.*and one user\.attributes/i,
        );
    });

    test('hands fetched CPA fields and post property fields to the editor', async () => {
        mockActions.getAccessControlFields.mockResolvedValue({
            data: [
                {name: 'rank', attrs: {}},
                {name: 'department', attrs: {}},
            ],
        });
        getPropertyFieldsSpy.mockResolvedValue([
            {
                id: 'f1',
                name: 'secretlevel',
                type: 'select',
                attrs: {options: [{id: 'o1', name: 'L1'}, {id: 'o2', name: 'L2'}]},
            },
            {
                id: 'f2',
                name: 'tags',
                type: 'multiselect',
                attrs: {options: [{id: 't1', name: 'eng'}]},
            },
            {
                id: 'f3',
                name: 'note',
                type: 'text',
            },
        ]);

        renderWithContext(
            <ChannelSettingsPostPoliciesTab {...baseProps}/>,
            initialState,
        );
        await waitFor(() => screen.getByTestId('post-policies-empty'));

        await userEvent.click(screen.getByTestId('post-policies-add'));
        const editor = screen.getByTestId('cel-editor-mock');

        const userAttrs = JSON.parse(editor.getAttribute('data-user-attrs') || '[]');
        expect(userAttrs).toEqual([
            {attribute: 'rank', values: []},
            {attribute: 'department', values: []},
        ]);

        const postAttrs = JSON.parse(editor.getAttribute('data-post-attrs') || '[]');
        expect(postAttrs).toEqual([
            {attribute: 'secretlevel', values: ['L1', 'L2']},
            {attribute: 'tags', values: ['eng']},
            {attribute: 'note', values: []},
        ]);

        // Channel-scoped fetch was issued with the right group/object/target.
        expect(getPropertyFieldsSpy).toHaveBeenCalledWith(
            'channel_post_properties',
            'post',
            'channel',
            'channel_id',
            {perPage: 100},
        );
    });

    test('non-fatal: attribute fetch failure still lets the editor render', async () => {
        mockActions.getAccessControlFields.mockRejectedValue(new Error('boom'));
        getPropertyFieldsSpy.mockRejectedValue(new Error('boom'));

        renderWithContext(
            <ChannelSettingsPostPoliciesTab {...baseProps}/>,
            initialState,
        );
        await waitFor(() => screen.getByTestId('post-policies-empty'));

        await userEvent.click(screen.getByTestId('post-policies-add'));
        const editor = screen.getByTestId('cel-editor-mock');

        // Empty arrays land at the editor — completion list is empty but
        // the user can still type a rule by hand.
        expect(JSON.parse(editor.getAttribute('data-user-attrs') || 'null')).toEqual([]);
        expect(JSON.parse(editor.getAttribute('data-post-attrs') || 'null')).toEqual([]);
    });
});
