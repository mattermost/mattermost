// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import type {Post} from '@mattermost/types/posts';
import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import PropertyTypes from 'mattermost-redux/action_types/properties';
import {Client4} from 'mattermost-redux/client';

import {act, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import PostAttributesModal from './post_attributes_modal';

const GROUP_ID = 'group_id';
const CHANNEL_ID = 'channel_id';
const TEAM_ID = 'team_id';
const POST_ID = 'post_id';
const CURRENT_USER_ID = 'user_current';

const OPTIONS = [
    {id: 'opt_secret', name: 'SECRET', color: 'red'},
    {id: 'opt_unclassified', name: 'UNCLASSIFIED', color: 'green'},
];

const author = TestHelper.getUserMock({
    id: 'user_alice',
    username: 'alice',
    first_name: 'Alice',
    last_name: 'Adams',
});

const currentUser = TestHelper.getUserMock({
    id: CURRENT_USER_ID,
    username: 'bob',
    roles: 'system_user',
});

const post = {
    id: POST_ID,
    channel_id: CHANNEL_ID,
    user_id: author.id,
    message: 'the post being marked',
    create_at: 1600000000000,
} as Post;

function makeField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field_1',
        group_id: GROUP_ID,
        name: 'classification',
        type: 'select',
        object_type: 'post',
        target_type: 'channel',
        target_id: CHANNEL_ID,
        attrs: {options: OPTIONS, display_name: 'Classification'},
        permission_values: 'member',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'user_1',
        updated_by: 'user_1',
        ...overrides,
    };
}

function makeValue(overrides: Partial<PropertyValue<unknown>> = {}): PropertyValue<unknown> {
    return {
        id: 'value_1',
        target_id: POST_ID,
        target_type: 'post',
        group_id: GROUP_ID,
        field_id: 'field_1',
        value: 'opt_secret',
        create_at: 1,
        update_at: 1,
        delete_at: 0,
        created_by: 'user_1',
        updated_by: 'user_1',
        ...overrides,
    };
}

function makeState(fields: PropertyField[], values: Array<PropertyValue<unknown>>): DeepPartial<GlobalState> {
    const byId: Record<string, PropertyField> = {};
    fields.forEach((field) => {
        byId[field.id] = field;
    });

    const byTargetId: Record<string, Record<string, PropertyValue<unknown>>> = {};
    values.forEach((value) => {
        byTargetId[value.target_id] = {...byTargetId[value.target_id], [value.field_id]: value};
    });

    return {
        entities: {
            channels: {
                channels: {
                    [CHANNEL_ID]: {id: CHANNEL_ID, team_id: TEAM_ID, type: 'O', display_name: 'Town Square'},
                },
                myMembers: {},
            },
            general: {config: {}, license: {}},
            preferences: {myPreferences: {}},
            roles: {roles: {}},
            teams: {currentTeamId: TEAM_ID, teams: {[TEAM_ID]: {id: TEAM_ID}}, myMembers: {}},
            users: {
                currentUserId: CURRENT_USER_ID,
                profiles: {
                    [author.id]: author,
                    [CURRENT_USER_ID]: currentUser,
                },
            },
            properties: {
                fields: {byId, byObjectType: {post: {[GROUP_ID]: byId}}},
                values: {byTargetId, byFieldId: {}},
                groups: {
                    byId: {[GROUP_ID]: {id: GROUP_ID, name: 'post_attributes'}},
                    byName: {post_attributes: {id: GROUP_ID, name: 'post_attributes'}},
                },
            },
        },
    } as DeepPartial<GlobalState>;
}

function renderModal(fields: PropertyField[], values: Array<PropertyValue<unknown>>) {
    return renderWithContext(
        <PostAttributesModal
            post={post}
            onExited={jest.fn()}
        />,
        makeState(fields, values),
    );
}

async function openMenu(fieldName: string) {
    await userEvent.click(screen.getByTestId(`post-attribute-trigger-${fieldName}`));
}

describe('PostAttributesModal', () => {
    let patchSpy: jest.SpyInstance;

    beforeEach(() => {
        patchSpy = jest.spyOn(Client4, 'patchPropertyValues');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders the post reprise and the inert add button', () => {
        patchSpy.mockResolvedValue([]);
        renderModal([makeField()], [makeValue()]);

        expect(screen.getByTestId('post-attributes-reprise')).toHaveTextContent('the post being marked');

        const add = screen.getByTestId('post-attributes-add');
        expect(add).toHaveAttribute('aria-disabled', 'true');
        expect(add).not.toBeDisabled();
    });

    test('lists every visible field in sort_order then name', () => {
        patchSpy.mockResolvedValue([]);

        const fields = [
            makeField({id: 'f_c', name: 'caveats', attrs: {options: OPTIONS, display_name: 'Caveats', sort_order: 2}}),
            makeField({id: 'f_a', name: 'alpha', attrs: {options: OPTIONS, display_name: 'Alpha', sort_order: 1}}),
            makeField({id: 'f_b', name: 'beta', attrs: {options: OPTIONS, display_name: 'Beta', sort_order: 1}}),
        ];
        const values = fields.map((field) => makeValue({id: `v_${field.id}`, field_id: field.id}));

        renderModal(fields, values);

        const labels = screen.getAllByTestId(/^post-attribute-row-/).map((row) => row.getAttribute('data-testid'));

        expect(labels).toEqual([
            'post-attribute-row-alpha',
            'post-attribute-row-beta',
            'post-attribute-row-caveats',
        ]);
    });

    test('an unset `always` field is a row; an unset `when_set` field is not; a `hidden` field is not', () => {
        patchSpy.mockResolvedValue([]);

        const fields = [
            makeField({id: 'f_always', name: 'always_field', attrs: {options: OPTIONS, visibility: 'always'}}),
            makeField({id: 'f_when_set', name: 'when_set_field', attrs: {options: OPTIONS, visibility: 'when_set'}}),
            makeField({id: 'f_hidden', name: 'hidden_field', attrs: {options: OPTIONS, visibility: 'hidden'}}),
        ];

        renderModal(fields, []);

        expect(screen.getByTestId('post-attribute-row-always_field')).toBeInTheDocument();
        expect(screen.queryByTestId('post-attribute-row-when_set_field')).not.toBeInTheDocument();
        expect(screen.queryByTestId('post-attribute-row-hidden_field')).not.toBeInTheDocument();
    });

    test('a `hidden` field stays hidden even when it has a value', () => {
        patchSpy.mockResolvedValue([]);

        const field = makeField({id: 'f_hidden', name: 'hidden_field', attrs: {options: OPTIONS, visibility: 'hidden'}});

        renderModal([field], [makeValue({field_id: 'f_hidden'})]);

        expect(screen.queryByTestId('post-attribute-row-hidden_field')).not.toBeInTheDocument();
    });

    test('opening on a post with no values shows the channel\'s `always` fields and no empty state', () => {
        patchSpy.mockResolvedValue([]);

        const fields = [
            makeField({id: 'f_always', name: 'always_field', attrs: {options: OPTIONS, display_name: 'Always', visibility: 'always'}}),
        ];

        renderModal(fields, []);

        expect(screen.getByTestId('post-attribute-row-always_field')).toBeInTheDocument();
        expect(screen.getByTestId('post-attribute-trigger-always_field')).toBeInTheDocument();

        // Nothing to clear yet, and no "no attributes" placeholder.
        expect(screen.queryByTestId('post-attribute-clear-always_field')).not.toBeInTheDocument();
        expect(screen.getByTestId('post-attributes-add')).toBeInTheDocument();
    });

    test('a locked field renders the padlock, no trigger and no trash button', () => {
        patchSpy.mockResolvedValue([]);

        const field = makeField({permission_values: 'none'});

        renderModal([field], [makeValue()]);

        expect(screen.queryByTestId('post-attribute-trigger-classification')).not.toBeInTheDocument();
        expect(screen.queryByTestId('post-attribute-clear-classification')).not.toBeInTheDocument();
        expect(screen.getByRole('img', {name: 'This is a system-level property and cannot be modified.'})).toBeInTheDocument();
    });

    test('picking an option writes exactly one item, once', async () => {
        patchSpy.mockResolvedValue([makeValue({value: 'opt_unclassified', update_at: 2})]);

        renderModal([makeField()], [makeValue()]);

        await openMenu('classification');
        await userEvent.click(screen.getByRole('menuitemradio', {name: /UNCLASSIFIED/}));

        await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(1));

        expect(patchSpy).toHaveBeenCalledWith(
            'post_attributes',
            'post',
            POST_ID,
            [{field_id: 'field_1', value: 'opt_unclassified'}],
        );
    });

    test('the displayed value does not change until the write resolves, and the row is disabled while pending', async () => {
        let resolveWrite: (values: Array<PropertyValue<unknown>>) => void = () => {};
        patchSpy.mockReturnValue(new Promise((resolve) => {
            resolveWrite = resolve;
        }));

        renderModal([makeField()], [makeValue()]);

        await openMenu('classification');
        await userEvent.click(screen.getByRole('menuitemradio', {name: /UNCLASSIFIED/}));

        await waitFor(() => expect(screen.getByTestId('post-attribute-trigger-classification')).toBeDisabled());
        expect(screen.getByTestId('post-attribute-trigger-classification')).toHaveTextContent('SECRET');
        expect(screen.getByTestId('post-attribute-clear-classification')).toBeDisabled();

        await act(async () => {
            resolveWrite([makeValue({value: 'opt_unclassified', update_at: 2})]);
        });

        await waitFor(() => expect(screen.getByTestId('post-attribute-trigger-classification')).toHaveTextContent('UNCLASSIFIED'));
        expect(screen.getByTestId('post-attribute-trigger-classification')).not.toBeDisabled();
    });

    test('a write to one row leaves another row\'s in-flight state alone', async () => {
        const resolvers: Array<(values: Array<PropertyValue<unknown>>) => void> = [];
        patchSpy.mockImplementation(() => new Promise((resolve) => {
            resolvers.push(resolve);
        }));

        renderModal(
            [makeField(), makeField({id: 'field_2', name: 'caveat', attrs: {options: OPTIONS, display_name: 'Caveat'}})],
            [makeValue(), makeValue({id: 'value_2', field_id: 'field_2'})],
        );

        await openMenu('classification');
        await userEvent.click(screen.getByRole('menuitemradio', {name: /UNCLASSIFIED/}));
        await waitFor(() => expect(screen.getByTestId('post-attribute-trigger-classification')).toBeDisabled());

        // Second row, while the first is still in flight.
        await openMenu('caveat');
        await userEvent.click(screen.getByRole('menuitemradio', {name: /UNCLASSIFIED/}));
        await waitFor(() => expect(screen.getByTestId('post-attribute-trigger-caveat')).toBeDisabled());

        // The first row must still read as pending.
        expect(screen.getByTestId('post-attribute-trigger-classification')).toBeDisabled();

        // Resolving the first must not re-enable the second.
        await act(async () => {
            resolvers[0]([makeValue({value: 'opt_unclassified', update_at: 2})]);
        });

        await waitFor(() => expect(screen.getByTestId('post-attribute-trigger-classification')).not.toBeDisabled());
        expect(screen.getByTestId('post-attribute-trigger-caveat')).toBeDisabled();

        await act(async () => {
            resolvers[1]([makeValue({id: 'value_2', field_id: 'field_2', value: 'opt_unclassified', update_at: 2})]);
        });

        await waitFor(() => expect(screen.getByTestId('post-attribute-trigger-caveat')).not.toBeDisabled());
    });

    test('an error on one row survives a write starting on another', async () => {
        patchSpy.mockRejectedValueOnce({message: 'boom', status_code: 500});

        renderModal(
            [makeField(), makeField({id: 'field_2', name: 'caveat', attrs: {options: OPTIONS, display_name: 'Caveat'}})],
            [makeValue(), makeValue({id: 'value_2', field_id: 'field_2'})],
        );

        await openMenu('classification');
        await userEvent.click(screen.getByRole('menuitemradio', {name: /UNCLASSIFIED/}));
        await screen.findByTestId('post-attribute-error-classification');

        let resolveSecond: (values: Array<PropertyValue<unknown>>) => void = () => {};
        patchSpy.mockReturnValue(new Promise((resolve) => {
            resolveSecond = resolve;
        }));

        await openMenu('caveat');
        await userEvent.click(screen.getByRole('menuitemradio', {name: /UNCLASSIFIED/}));

        // The other row's failure is still on screen and still needs answering.
        expect(screen.getByTestId('post-attribute-error-classification')).toBeInTheDocument();

        await act(async () => {
            resolveSecond([makeValue({id: 'value_2', field_id: 'field_2', value: 'opt_unclassified', update_at: 2})]);
        });

        expect(screen.getByTestId('post-attribute-error-classification')).toBeInTheDocument();
    });

    test('a rejected write leaves the displayed value alone and surfaces the message', async () => {
        patchSpy.mockRejectedValue({message: 'boom', status_code: 500});

        renderModal([makeField()], [makeValue()]);

        await openMenu('classification');
        await userEvent.click(screen.getByRole('menuitemradio', {name: /UNCLASSIFIED/}));

        expect(await screen.findByRole('alert')).toHaveTextContent('Could not update this attribute. Please try again.');
        expect(screen.getByTestId('post-attribute-trigger-classification')).toHaveTextContent('SECRET');
        expect(screen.getByTestId('post-attribute-trigger-classification')).not.toBeDisabled();
    });

    test('a 403 on one row shows the permission message and leaves the other rows enabled', async () => {
        patchSpy.mockRejectedValue({message: 'forbidden', status_code: 403});

        const fields = [
            makeField(),
            makeField({id: 'field_2', name: 'caveats', attrs: {options: OPTIONS, display_name: 'Caveats'}}),
        ];
        const values = [makeValue(), makeValue({id: 'value_2', field_id: 'field_2'})];

        renderModal(fields, values);

        await openMenu('classification');
        await userEvent.click(screen.getByRole('menuitemradio', {name: /UNCLASSIFIED/}));

        expect(await screen.findByTestId('post-attribute-error-classification')).
            toHaveTextContent('You do not have permission to change this attribute');

        expect(screen.queryByTestId('post-attribute-error-caveats')).not.toBeInTheDocument();
        expect(screen.getByTestId('post-attribute-trigger-caveats')).not.toBeDisabled();
        expect(screen.getByTestId('post-attribute-clear-caveats')).not.toBeDisabled();
    });

    test('the trash button writes an empty value, and the row loses its trash button', async () => {
        patchSpy.mockResolvedValue([makeValue({value: '', update_at: 2})]);

        renderModal([makeField()], [makeValue()]);

        await userEvent.click(screen.getByTestId('post-attribute-clear-classification'));

        await waitFor(() => expect(patchSpy).toHaveBeenCalledWith(
            'post_attributes',
            'post',
            POST_ID,
            [{field_id: 'field_1', value: ''}],
        ));

        /*
         * `hasValue` treats an empty value as unset, so the trash button goes
         * with the value — no extra code, and the chip and the card row follow.
         * On a `when_set` field the whole row goes too, only `always` earns a
         * row with nothing in it.
         */
        await waitFor(() => expect(screen.queryByTestId('post-attribute-row-classification')).not.toBeInTheDocument());
    });

    test('clearing an `always` field keeps its row, with an empty trigger and no trash button', async () => {
        patchSpy.mockResolvedValue([makeValue({value: '', update_at: 2})]);

        const field = makeField({attrs: {options: OPTIONS, display_name: 'Classification', visibility: 'always'}});

        renderModal([field], [makeValue()]);

        await userEvent.click(screen.getByTestId('post-attribute-clear-classification'));

        await waitFor(() => expect(screen.queryByTestId('post-attribute-clear-classification')).not.toBeInTheDocument());

        const trigger = screen.getByTestId('post-attribute-trigger-classification');
        expect(trigger).toBeInTheDocument();
        expect(trigger).toHaveTextContent('');
    });

    test('a property_values_updated arriving while the modal is open updates the row', async () => {
        patchSpy.mockResolvedValue([]);

        const {store} = renderModal([makeField()], [makeValue()]);

        expect(screen.getByTestId('post-attribute-trigger-classification')).toHaveTextContent('SECRET');

        // Somebody else's edit, delivered by the socket handler's dispatch. The
        // row has to follow it, which it can only do by reading the slice rather
        // than a snapshot taken at mount.
        act(() => {
            store.dispatch({
                type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                data: {values: [makeValue({value: 'opt_unclassified', update_at: 3})]},
            });
        });

        await waitFor(() => expect(screen.getByTestId('post-attribute-trigger-classification')).toHaveTextContent('UNCLASSIFIED'));
    });

    test('a multiselect toggles one option without closing the menu', async () => {
        patchSpy.mockResolvedValue([]);

        const field = makeField({id: 'field_multi', name: 'caveats', type: 'multiselect', attrs: {options: OPTIONS, display_name: 'Caveats'}});

        renderModal([field], [makeValue({field_id: 'field_multi', value: ['opt_secret']})]);

        await openMenu('caveats');

        expect(screen.getByRole('menuitemcheckbox', {name: /SECRET/})).toHaveAttribute('aria-checked', 'true');

        await userEvent.click(screen.getByRole('menuitemcheckbox', {name: /UNCLASSIFIED/}));

        await waitFor(() => expect(patchSpy).toHaveBeenCalledWith(
            'post_attributes',
            'post',
            POST_ID,
            [{field_id: 'field_multi', value: ['opt_secret', 'opt_unclassified']}],
        ));

        // Still open, so a second option can be picked without reopening.
        expect(screen.getByRole('menuitemcheckbox', {name: /SECRET/})).toBeInTheDocument();
    });
});
