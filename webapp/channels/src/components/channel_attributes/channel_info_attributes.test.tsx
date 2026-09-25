// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';
import {PROPERTY_TEXT_VALUE_MAX_LENGTH} from 'mattermost-redux/constants/properties';

import {clearPropertyFieldOptionWalks} from 'components/property_fields/graph/page_all_access_control_field_options';
import {clearGraphOptionNameCache} from 'components/property_fields/graph/use_graph_option_names';

import {renderWithContext} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import ChannelInfoAttributes from './channel_info_attributes';
import type {ChannelInfoAttributesHandle} from './channel_info_attributes';

jest.mock('mattermost-redux/actions/properties', () => ({
    fetchPropertyFields: jest.fn(() => () => Promise.resolve({data: []})),
}));

let mockChannelPermissions: Record<string, boolean> = {};
jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/roles'),
    haveIChannelPermission: jest.fn().mockImplementation((_state, _teamId, _channelId, permission) => (
        mockChannelPermissions[permission] ?? false
    )),
}));

const GROUP_ID = 'group1';
const CHANNEL_ID = 'channel1';
const TEAM_ID = 'team1';

type FieldOptions = {
    required?: boolean;
    editable?: boolean;
    changePolicy?: string;
    options?: Array<{id: string; name: string; color?: string; rank?: number}>;
    actions?: string[];
    permissionValues?: PropertyField['permission_values'];
    type?: PropertyField['type'];
};

function field(id: string, {required, editable, changePolicy, options, actions = ['display_label_info'], permissionValues = 'member', type = 'select'}: FieldOptions = {}): PropertyField {
    return {
        id,
        group_id: GROUP_ID,
        name: id,
        type,
        target_id: '',
        target_type: 'system',
        object_type: 'channel',
        permission_values: permissionValues,
        attrs: {
            actions,

            // Option name deliberately unlike the attribute's label, so a query for
            // one cannot accidentally match the other.
            options: options ?? [{id: `opt_${id}`, name: `VALUE_${id.toUpperCase()}`, color: '#1e325c'}],
            display_name: id.charAt(0).toUpperCase() + id.slice(1),
            ...(required === undefined ? {} : {required}),
            ...(editable === undefined ? {} : {editable}),
            ...(changePolicy === undefined ? {} : {change_policy: changePolicy}),
        },
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    };
}

function value(fieldId: string, raw: unknown): PropertyValue<unknown> {
    return {
        id: `value_${fieldId}`,
        target_id: CHANNEL_ID,
        target_type: 'channel',
        group_id: GROUP_ID,
        field_id: fieldId,
        value: raw,
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: '',
        updated_by: '',
    };
}

function makeState(fields: PropertyField[], values: Array<PropertyValue<unknown>>, flag = 'true'): DeepPartial<GlobalState> {
    const byTargetId: Record<string, Record<string, PropertyValue<unknown>>> = {};
    for (const v of values) {
        byTargetId[v.target_id] = {...byTargetId[v.target_id], [v.field_id]: v};
    }

    return {
        entities: {
            general: {
                config: {FeatureFlagChannelAttributes: flag},
                license: {IsLicensed: 'true', SkuShortName: 'advanced'},
            },
            channels: {
                channels: {[CHANNEL_ID]: {id: CHANNEL_ID, team_id: TEAM_ID, type: 'P'}},
            },
            users: {
                currentUserId: 'user1',
                profiles: {user1: {id: 'user1', roles: 'system_user'}},
            },
            properties: {
                groups: {byId: {[GROUP_ID]: {id: GROUP_ID, name: 'access_control'}}, byName: {access_control: {id: GROUP_ID, name: 'access_control'}}},
                fields: {
                    byId: Object.fromEntries(fields.map((f) => [f.id, f])),
                    byObjectType: {channel: {[GROUP_ID]: Object.fromEntries(fields.map((f) => [f.id, f]))}},
                },
                values: {byTargetId, byFieldId: {}},
            },
        },
    } as DeepPartial<GlobalState>;
}

describe('ChannelInfoAttributes', () => {
    beforeEach(() => {
        mockChannelPermissions = {read_channel: true, manage_channel_roles: true};
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders a row for an attribute with a value', () => {
        renderWithContext(
            <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
            makeState([field('program')], [value('program', 'opt_program')]),
        );

        expect(screen.getByTestId('channelInfoAttributeRow-program')).toBeInTheDocument();
        expect(screen.getByTestId('attributeChip')).toHaveTextContent('VALUE_PROGRAM');
    });

    test('renders a required attribute with no value as Not set', () => {
        renderWithContext(
            <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
            makeState([field('program', {required: true})], []),
        );

        expect(screen.getByTestId('channelInfoAttributeRow-program')).toBeInTheDocument();
        expect(screen.getByText('Not set')).toBeInTheDocument();
        expect(screen.queryByTestId('attributeChip')).not.toBeInTheDocument();
    });

    test('shows Classification rather than the stored unique name', () => {
        const classification = field('classification', {required: true, type: 'rank'});
        delete classification.attrs!.display_name;

        renderWithContext(
            <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
            makeState([classification], []),
        );

        expect(screen.getByTestId('channelInfoAttributeRow-classification')).toBeInTheDocument();
        expect(screen.getByText('Classification')).toBeInTheDocument();
        expect(screen.queryByText('classification')).not.toBeInTheDocument();
    });

    test('omits an optional attribute with no value rather than showing an empty row', () => {
        renderWithContext(
            <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
            makeState([field('program')], []),
        );

        // Reachable through Add Attribute instead, which is why the section itself
        // still renders for a user who may set it.
        expect(screen.queryByTestId('channelInfoAttributeRow-program')).not.toBeInTheDocument();
        expect(screen.getByTestId('channelInfoAddAttributeButton')).toBeInTheDocument();
    });

    test('renders nothing at all when there is neither a row nor anything to add', () => {
        mockChannelPermissions = {};

        renderWithContext(
            <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
            makeState([field('program', {permissionValues: 'admin'})], []),
        );

        expect(screen.queryByTestId('channelInfoAttributes')).not.toBeInTheDocument();
    });

    test('marks a locked attribute rather than hiding it', () => {
        // Hiding it would make a correctly configured channel look like one
        // missing a marking.
        renderWithContext(
            <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
            makeState([field('program', {editable: false})], [value('program', 'opt_program')]),
        );

        expect(screen.getByTestId('channelInfoAttributeRow-program')).toBeInTheDocument();
        expect(screen.getByLabelText('This attribute cannot be changed after it is set')).toBeInTheDocument();
    });

    test('treats an attribute with no editable key as editable', () => {
        renderWithContext(
            <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
            makeState([field('program')], [value('program', 'opt_program')]),
        );

        expect(screen.queryByLabelText('This attribute cannot be changed after it is set')).not.toBeInTheDocument();
    });

    test('renders nothing when the feature flag is off', () => {
        renderWithContext(
            <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
            makeState([field('program')], [value('program', 'opt_program')], 'false'),
        );

        expect(screen.queryByTestId('channelInfoAttributes')).not.toBeInTheDocument();
    });

    // This panel is the only place a value can be edited, so a display setting
    // must not be able to hide an attribute from the people who administer it.
    test('renders an attribute designated only for the header, with its edit affordance', () => {
        renderWithContext(
            <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
            makeState([field('program', {actions: ['display_label_header']})], [value('program', 'opt_program')]),
        );

        expect(screen.getByTestId('channelInfoAttributeRow-program')).toBeInTheDocument();
        expect(screen.getByTestId('channelInfoAttributeEdit-program')).toBeInTheDocument();
    });

    test('renders an attribute with no display designation at all', () => {
        renderWithContext(
            <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
            makeState([field('program', {actions: []})], [value('program', 'opt_program')]),
        );

        expect(screen.getByTestId('channelInfoAttributeRow-program')).toBeInTheDocument();
    });

    describe('a regular member', () => {
        beforeEach(() => {
            mockChannelPermissions = {read_channel: true};
        });

        test('sees the value but no way to change it, even on a member-tier field', () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('program')], [value('program', 'opt_program')]),
            );

            expect(screen.getByTestId('channelInfoAttributeRow-program')).toBeInTheDocument();
            expect(screen.queryByTestId('channelInfoAttributeEdit-program')).not.toBeInTheDocument();
            expect(screen.queryByTestId('channelInfoAddAttributeButton')).not.toBeInTheDocument();
        });

        // An unset required attribute is the admin's problem to fix; showing a
        // member an empty row they cannot fill only reads as a broken channel.
        test('is not shown a required attribute that is still unset', () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('program', {required: true})], []),
            );

            expect(screen.queryByTestId('channelInfoAttributes')).not.toBeInTheDocument();
        });
    });

    describe('editing', () => {
        test('offers an edit affordance to a user with the setter tier', () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('program')], [value('program', 'opt_program')]),
            );

            expect(screen.getByTestId('channelInfoAttributeEdit-program')).toBeInTheDocument();
        });

        test('withholds the edit affordance from a user without the setter tier', () => {
            mockChannelPermissions = {};

            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('program', {permissionValues: 'admin'})], [value('program', 'opt_program')]),
            );

            expect(screen.queryByTestId('channelInfoAttributeEdit-program')).not.toBeInTheDocument();
        });

        test('requires the admin tier to be satisfied by manage_channel_roles', () => {
            mockChannelPermissions = {read_channel: true};

            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('program', {permissionValues: 'admin'})], [value('program', 'opt_program')]),
            );

            expect(screen.queryByTestId('channelInfoAttributeEdit-program')).not.toBeInTheDocument();
        });

        // The lock means "may not be changed once set". A required, locked
        // attribute whose creation-time write failed has no value to protect, and
        // blocking it there would strand the channel as "Not set" forever — with
        // no way to fix it, since that is the documented retry path.
        test('still allows the first set of a locked attribute that was never filled', () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('program', {editable: false, required: true})], []),
            );

            expect(screen.getByTestId('channelInfoAttributeEdit-program')).toBeInTheDocument();
            expect(screen.queryByLabelText('This attribute cannot be changed after it is set')).not.toBeInTheDocument();
        });

        test('never offers editing for a locked attribute, whatever the tier', () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('program', {editable: false})], [value('program', 'opt_program')]),
            );

            expect(screen.queryByTestId('channelInfoAttributeEdit-program')).not.toBeInTheDocument();
            expect(screen.getByLabelText('This attribute cannot be changed after it is set')).toBeInTheDocument();
        });

        test('writes the selected value through the property API', async () => {
            const patchSpy = jest.spyOn(Client4, 'patchPropertyValues').mockResolvedValue([]);

            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('program', {required: true})], [value('program', null)]),
            );

            // A required-but-unset row is the one reachable without a value.
            await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-program'));
            await userEvent.click(await screen.findByText('VALUE_PROGRAM'));

            await waitFor(() => expect(patchSpy).toHaveBeenCalledWith(
                'access_control',
                'channel',
                CHANNEL_ID,
                [{field_id: 'program', value: 'opt_program'}],
            ));
        });

        test('clears a single-select value with the keyboard from the options menu', async () => {
            const patchSpy = jest.spyOn(Client4, 'patchPropertyValues').mockResolvedValue([]);

            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('program')], [value('program', 'opt_program')]),
            );

            await userEvent.tab();
            expect(screen.getByRole('button', {name: 'Edit Program'})).toHaveFocus();

            await userEvent.keyboard('{Enter}');
            expect(await screen.findByRole('menuitem', {name: 'Clear Program'})).toHaveFocus();
            await userEvent.keyboard('{Enter}');

            await waitFor(() => expect(patchSpy).toHaveBeenCalledWith(
                'access_control',
                'channel',
                CHANNEL_ID,
                [{field_id: 'program', value: null}],
            ));
            expect(patchSpy).toHaveBeenCalledTimes(1);
        });

        test('opens the menu via keyboard and selects an option', async () => {
            const patchSpy = jest.spyOn(Client4, 'patchPropertyValues').mockResolvedValue([]);

            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('program', {required: true})], [value('program', null)]),
            );

            await userEvent.tab();
            const trigger = screen.getByRole('button', {name: 'Edit Program'});
            expect(trigger).toHaveFocus();

            await userEvent.keyboard('{Enter}');

            expect(await screen.findByRole('menu', {name: 'Program'})).toBeInTheDocument();
            await userEvent.click(screen.getByText('VALUE_PROGRAM'));

            await waitFor(() => expect(patchSpy).toHaveBeenCalledWith(
                'access_control',
                'channel',
                CHANNEL_ID,
                [{field_id: 'program', value: 'opt_program'}],
            ));
        });

        test('renders no remove control beside a single-select value', () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('program')], [value('program', 'opt_program')]),
            );

            expect(screen.getByTestId('channelInfoAttributeEdit-program')).toHaveTextContent('VALUE_PROGRAM');
            expect(screen.queryByRole('button', {name: 'Clear Program'})).not.toBeInTheDocument();
        });

        test('clears a value from the options menu without requiring the chip remove control', async () => {
            const patchSpy = jest.spyOn(Client4, 'patchPropertyValues').mockResolvedValue([]);

            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('program')], [value('program', 'opt_program')]),
            );

            await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-program'));
            await userEvent.click(await screen.findByTestId('channelAttributeClear-program'));

            await waitFor(() => expect(patchSpy).toHaveBeenCalledWith(
                'access_control',
                'channel',
                CHANNEL_ID,
                [{field_id: 'program', value: null}],
            ));
        });

        test('names a select editor with the attribute label, not the shared placeholder', async () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('program', {required: true})], [value('program', null)]),
            );

            await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-program'));

            expect(await screen.findByRole('menu', {name: 'Program'})).toBeInTheDocument();
        });

        test('names a text editor with the attribute label, not the shared placeholder', async () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('note', {required: true, type: 'text'})], [value('note', null)]),
            );

            await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-note'));

            expect(await screen.findByLabelText('Note')).toBeInTheDocument();
        });

        test('stops a text value at the length the server accepts', async () => {
            const patchSpy = jest.spyOn(Client4, 'patchPropertyValues').mockResolvedValue([]);

            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('note', {required: true, type: 'text'})], [value('note', null)]),
            );

            await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-note'));

            const input = await screen.findByTestId('channelAttributeEdit-note');
            expect(input).toHaveAttribute('maxLength', String(PROPERTY_TEXT_VALUE_MAX_LENGTH));

            await userEvent.type(input, 'x'.repeat(PROPERTY_TEXT_VALUE_MAX_LENGTH + 5));
            await userEvent.type(input, '{Enter}');

            await waitFor(() => expect(patchSpy).toHaveBeenCalledWith(
                'access_control',
                'channel',
                CHANNEL_ID,
                [{field_id: 'note', value: 'x'.repeat(PROPERTY_TEXT_VALUE_MAX_LENGTH)}],
            ));
        });

        test('names the attribute when the write fails, and keeps the row', async () => {
            jest.spyOn(Client4, 'patchPropertyValues').mockRejectedValue(new Error('403'));

            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('program', {required: true})], [value('program', null)]),
            );

            await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-program'));
            await userEvent.click(await screen.findByText('VALUE_PROGRAM'));

            expect(await screen.findByTestId('channelInfoAttributeError-program')).toHaveTextContent("Couldn't save Program");
            expect(screen.getByTestId('channelInfoAttributeRow-program')).toBeInTheDocument();
        });

        test('an earlier save resolving cannot clobber a later save still in flight', async () => {
            let resolveFirst: (value: Array<PropertyValue<unknown>>) => void = () => {};
            let resolveSecond: (value: Array<PropertyValue<unknown>>) => void = () => {};
            const patchSpy = jest.spyOn(Client4, 'patchPropertyValues').
                mockImplementationOnce(() => new Promise((resolve) => {
                    resolveFirst = resolve;
                })).
                mockImplementationOnce(() => new Promise((resolve) => {
                    resolveSecond = resolve;
                }));

            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState(
                    [field('program', {required: true}), field('team', {required: true})],
                    [value('program', null), value('team', null)],
                ),
            );

            await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-program'));
            await userEvent.click(await screen.findByText('VALUE_PROGRAM'));
            await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(1));

            // Program's save is still in flight -- submit team before it
            // resolves, so both requests overlap within one visit.
            await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-team'));
            await userEvent.click(await screen.findByText('VALUE_TEAM'));
            await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(2));

            // The earlier (program) request resolving must not mark team as
            // failed -- only team's own request owns that row.
            await act(async () => {
                resolveFirst([]);
            });
            expect(screen.queryByTestId('channelInfoAttributeError-team')).not.toBeInTheDocument();

            resolveSecond([]);
            await waitFor(() => expect(screen.queryByTestId('channelInfoAttributeError-program')).not.toBeInTheDocument());
        });
    });

    test('drops editing state when the channel changes', async () => {
        // Channel Info stays mounted across a switch, so a row left open would
        // otherwise reappear open over a different channel's value.
        const state = makeState([field('program', {required: true})], []);
        const {rerender} = renderWithContext(<ChannelInfoAttributes channelId={CHANNEL_ID}/>, state);

        await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-program'));
        expect(await screen.findByRole('menu', {name: 'Program'})).toBeInTheDocument();

        rerender(<ChannelInfoAttributes channelId='channel2'/>);

        expect(screen.queryByRole('menu', {name: 'Program'})).not.toBeInTheDocument();
    });

    describe('add attribute', () => {
        test('offers an optional unset attribute', async () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('shown', {required: true}), field('optional')], [value('shown', 'opt_shown')]),
            );

            expect(screen.getByTestId('channelInfoAddAttributeButton')).toBeInTheDocument();
            expect(screen.queryByTestId('channelInfoAttributeRow-optional')).not.toBeInTheDocument();
        });

        test('does not offer an attribute that already has a value', () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('program')], [value('program', 'opt_program')]),
            );

            expect(screen.queryByTestId('channelInfoAddAttributeButton')).not.toBeInTheDocument();
        });

        test('does not offer a required attribute, which is already listed', () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('program', {required: true})], []),
            );

            expect(screen.queryByTestId('channelInfoAddAttributeButton')).not.toBeInTheDocument();
        });

        test('is absent for a user without the setter tier', () => {
            mockChannelPermissions = {};

            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('shown', {required: true}), field('optional', {permissionValues: 'admin'})], [value('shown', 'opt_shown')]),
            );

            expect(screen.queryByTestId('channelInfoAddAttributeButton')).not.toBeInTheDocument();
        });
    });
    describe('change policy', () => {
        const RANKS = [
            {id: 'opt_low', name: 'LOW', rank: 1},
            {id: 'opt_mid', name: 'MID', rank: 2},
            {id: 'opt_high', name: 'HIGH', rank: 3},
        ];

        const rankField = (changePolicy: string) => field('level', {changePolicy, options: RANKS, type: 'rank'});

        test('raise_only offers only the rungs above the current one', async () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([rankField('raise_only')], [value('level', 'opt_mid')]),
            );

            await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-level'));

            expect(await screen.findByText('HIGH')).toBeInTheDocument();
            expect(screen.queryByText('LOW')).not.toBeInTheDocument();
        });

        test('lower_only is the mirror', async () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([rankField('lower_only')], [value('level', 'opt_mid')]),
            );

            await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-level'));

            expect(await screen.findByText('LOW')).toBeInTheDocument();
            expect(screen.queryByText('HIGH')).not.toBeInTheDocument();
        });

        // Offering the editor here would open a dropdown with nothing in it.
        test('reads as locked at the top rung under raise_only', () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([rankField('raise_only')], [value('level', 'opt_high')]),
            );

            expect(screen.queryByTestId('channelInfoAttributeEdit-level')).not.toBeInTheDocument();
            expect(screen.getByLabelText('This attribute can only be raised, never lowered')).toBeInTheDocument();
        });

        test('names the rule that applies rather than a generic lock', () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([rankField('lower_only')], [value('level', 'opt_low')]),
            );

            expect(screen.getByLabelText('This attribute can only be lowered, never raised')).toBeInTheDocument();
        });

        // The stored option is gone from the field, so the chip renders nothing.
        // The value is still there, and the server will refuse to replace it.
        test('a value that fails to render still counts as set', () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('program', {editable: false})], [value('program', 'opt_deleted')]),
            );

            expect(screen.queryByTestId('channelInfoAttributeEdit-program')).not.toBeInTheDocument();
            expect(screen.getByLabelText('This attribute cannot be changed after it is set')).toBeInTheDocument();
            expect(screen.queryByTestId('channelInfoAddAttributeButton')).not.toBeInTheDocument();
        });
    });

    describe('graph attributes', () => {
        const graphProgram = (overrides: FieldOptions = {}) => field('program', {type: 'graph', ...overrides});

        beforeEach(() => {
            // The picker pages the options endpoint and caches the walk and the
            // option names at module level, so both outlive a single test.
            clearPropertyFieldOptionWalks();
            clearGraphOptionNameCache();
            jest.spyOn(Client4, 'getPropertyFieldOptions').mockResolvedValue({
                options: [{id: 'opt_program', name: 'VALUE_PROGRAM', create_at: 1}],
                has_more: false,
            });
        });

        test('saves a picked option as an array of ids', async () => {
            const patchSpy = jest.spyOn(Client4, 'patchPropertyValues').mockResolvedValue([]);

            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([graphProgram({required: true})], [value('program', null)]),
            );

            await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-program'));
            await userEvent.click(await screen.findByRole('menuitemcheckbox', {name: 'VALUE_PROGRAM'}));

            await waitFor(() => expect(patchSpy).toHaveBeenCalledWith(
                'access_control',
                'channel',
                CHANNEL_ID,
                [{field_id: 'program', value: ['opt_program']}],
            ));
        });

        test('deselecting the only selected value saves null', async () => {
            const patchSpy = jest.spyOn(Client4, 'patchPropertyValues').mockResolvedValue([]);

            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([graphProgram()], [value('program', ['opt_program'])]),
            );

            await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-program'));
            const option = await screen.findByRole('menuitemcheckbox', {name: 'VALUE_PROGRAM'});
            expect(option).toHaveAttribute('aria-checked', 'true');

            await userEvent.click(option);

            await waitFor(() => expect(patchSpy).toHaveBeenCalledWith(
                'access_control',
                'channel',
                CHANNEL_ID,
                [{field_id: 'program', value: null}],
            ));
        });

        test('offers an unset graph attribute in the Add attribute menu', async () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([field('shown', {required: true}), graphProgram()], [value('shown', 'opt_shown')]),
            );

            await userEvent.click(screen.getByTestId('channelInfoAddAttributeButton'));

            expect(await screen.findByTestId('channelInfoAddAttribute-program')).toBeInTheDocument();
        });

        test('a locked graph attribute renders the read-only chip and no picker', () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([graphProgram({changePolicy: 'never'})], [value('program', ['opt_program'])]),
            );

            expect(screen.getByTestId('attributeChip')).toHaveTextContent('VALUE_PROGRAM');
            expect(screen.getByTestId('channelInfoAttributeLock-program')).toBeInTheDocument();
            expect(screen.queryByTestId('channelInfoAttributeEdit-program')).not.toBeInTheDocument();
        });
    });

    describe('multiselect', () => {
        const multiOptions = [
            {id: 'opt_a', name: 'VALUE_A'},
            {id: 'opt_b', name: 'VALUE_B'},
        ];
        const multiField = (overrides: FieldOptions = {}) => field('tags', {type: 'multiselect', options: multiOptions, ...overrides});

        test('a read-only multiselect renders one chip per value, not a joined list', () => {
            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([multiField({changePolicy: 'never'})], [value('tags', ['opt_a', 'opt_b'])]),
            );

            const chips = screen.getAllByTestId('attributeChip');
            expect(chips).toHaveLength(2);
            expect(chips[0]).toHaveTextContent('VALUE_A');
            expect(chips[1]).toHaveTextContent('VALUE_B');

            // The joined displayValue reads as one marking rather than two.
            expect(screen.queryByText('VALUE_A, VALUE_B')).not.toBeInTheDocument();
        });

        test('picking a second option adds a chip alongside the first', async () => {
            const patchSpy = jest.spyOn(Client4, 'patchPropertyValues').mockResolvedValue([]);

            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([multiField()], [value('tags', ['opt_a'])]),
            );

            await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-tags'));
            await userEvent.click(await screen.findByText('VALUE_B'));

            await waitFor(() => expect(patchSpy).toHaveBeenCalledWith(
                'access_control',
                'channel',
                CHANNEL_ID,
                [{field_id: 'tags', value: ['opt_a', 'opt_b']}],
            ));
        });

        test('removing one chip keeps the other, without opening the menu', async () => {
            const patchSpy = jest.spyOn(Client4, 'patchPropertyValues').mockResolvedValue([]);

            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([multiField()], [value('tags', ['opt_a', 'opt_b'])]),
            );

            await userEvent.click(screen.getByRole('button', {name: 'Remove VALUE_A'}));

            expect(screen.queryByRole('menu', {name: 'Tags'})).not.toBeInTheDocument();
            await waitFor(() => expect(patchSpy).toHaveBeenCalledWith(
                'access_control',
                'channel',
                CHANNEL_ID,
                [{field_id: 'tags', value: ['opt_b']}],
            ));
            expect(patchSpy).toHaveBeenCalledTimes(1);
        });

        test('removing the last chip saves null', async () => {
            const patchSpy = jest.spyOn(Client4, 'patchPropertyValues').mockResolvedValue([]);

            renderWithContext(
                <ChannelInfoAttributes channelId={CHANNEL_ID}/>,
                makeState([multiField()], [value('tags', ['opt_a'])]),
            );

            await userEvent.click(screen.getByRole('button', {name: 'Remove VALUE_A'}));

            await waitFor(() => expect(patchSpy).toHaveBeenCalledWith(
                'access_control',
                'channel',
                CHANNEL_ID,
                [{field_id: 'tags', value: null}],
            ));
        });
    });

    describe('deferred mode', () => {
        test('stages an edit locally, without writing through the property API', async () => {
            const patchSpy = jest.spyOn(Client4, 'patchPropertyValues').mockResolvedValue([]);

            renderWithContext(
                <ChannelInfoAttributes
                    channelId={CHANNEL_ID}
                    deferred={true}
                />,
                makeState([field('program', {required: true})], [value('program', null)]),
            );

            await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-program'));
            expect(await screen.findByRole('menu', {name: 'Program'})).toBeInTheDocument();
            await userEvent.click(screen.getByRole('menuitem', {name: 'VALUE_PROGRAM'}));

            // The menu closes on pick, so this chip can only be the trigger's.
            await waitFor(() => expect(screen.queryByRole('menu', {name: 'Program'})).not.toBeInTheDocument());
            expect(await screen.findByTestId('attributeChip')).toHaveTextContent('VALUE_PROGRAM');
            expect(patchSpy).not.toHaveBeenCalled();
        });

        test('reports pending state through onPendingChange as edits are staged and flushed', async () => {
            const patchSpy = jest.spyOn(Client4, 'patchPropertyValues').mockResolvedValue([]);
            const onPendingChange = jest.fn();
            const ref = React.createRef<ChannelInfoAttributesHandle>();

            renderWithContext(
                <ChannelInfoAttributes
                    ref={ref}
                    channelId={CHANNEL_ID}
                    deferred={true}
                    onPendingChange={onPendingChange}
                />,
                makeState([field('program', {required: true})], [value('program', null)]),
            );

            expect(onPendingChange).toHaveBeenLastCalledWith(false);

            await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-program'));
            expect(await screen.findByRole('menu', {name: 'Program'})).toBeInTheDocument();
            await userEvent.click(screen.getByRole('menuitem', {name: 'VALUE_PROGRAM'}));

            await waitFor(() => expect(onPendingChange).toHaveBeenLastCalledWith(true));
            expect(ref.current?.hasPendingChanges()).toBe(true);

            await act(async () => {
                await ref.current?.flush();
            });

            expect(patchSpy).toHaveBeenCalledWith(
                'access_control',
                'channel',
                CHANNEL_ID,
                [{field_id: 'program', value: 'opt_program'}],
            );
            expect(ref.current?.hasPendingChanges()).toBe(false);
            expect(onPendingChange).toHaveBeenLastCalledWith(false);
        });

        test('discard reverts a staged edit without ever saving it', async () => {
            const patchSpy = jest.spyOn(Client4, 'patchPropertyValues').mockResolvedValue([]);
            const ref = React.createRef<ChannelInfoAttributesHandle>();

            renderWithContext(
                <ChannelInfoAttributes
                    ref={ref}
                    channelId={CHANNEL_ID}
                    deferred={true}
                />,
                makeState([field('program', {required: true})], [value('program', null)]),
            );

            await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-program'));
            expect(await screen.findByRole('menu', {name: 'Program'})).toBeInTheDocument();
            await userEvent.click(screen.getByRole('menuitem', {name: 'VALUE_PROGRAM'}));
            await waitFor(() => expect(ref.current?.hasPendingChanges()).toBe(true));

            act(() => {
                ref.current?.discard();
            });

            expect(screen.queryByTestId('attributeChip')).not.toBeInTheDocument();
            expect(ref.current?.hasPendingChanges()).toBe(false);
            expect(patchSpy).not.toHaveBeenCalled();
        });

        test('flush reports failure and keeps the edit staged for a retry', async () => {
            jest.spyOn(Client4, 'patchPropertyValues').mockRejectedValue(new Error('403'));
            const ref = React.createRef<ChannelInfoAttributesHandle>();

            renderWithContext(
                <ChannelInfoAttributes
                    ref={ref}
                    channelId={CHANNEL_ID}
                    deferred={true}
                />,
                makeState([field('program', {required: true})], [value('program', null)]),
            );

            await userEvent.click(screen.getByTestId('channelInfoAttributeEdit-program'));
            expect(await screen.findByRole('menu', {name: 'Program'})).toBeInTheDocument();
            await userEvent.click(screen.getByRole('menuitem', {name: 'VALUE_PROGRAM'}));
            await waitFor(() => expect(ref.current?.hasPendingChanges()).toBe(true));

            let flushed: boolean | undefined;
            await act(async () => {
                flushed = await ref.current?.flush();
            });

            expect(flushed).toBe(false);
            expect(ref.current?.hasPendingChanges()).toBe(true);
            expect(await screen.findByTestId('channelInfoAttributeError-program')).toBeInTheDocument();
        });
    });
});
