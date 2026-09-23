// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React from 'react';

import type {Post} from '@mattermost/types/posts';
import type {FieldType, PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import PropertyTypes from 'mattermost-redux/action_types/properties';
import {Client4} from 'mattermost-redux/client';

import {act, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import PostAttributesModal from './post_attributes_modal';

/*
 * The user picker is stubbed, the way `content_reviewers.test.tsx` stubs it:
 * react-select's async menu needs a debounce, a profile search and a portal to
 * reach a selectable option, none of which says anything about what this modal
 * writes. The stub keeps the real contract — `singleSelectOnChange` hands back
 * one id, `multiSelectOnChange` hands back the whole array, and both read their
 * current value from the `*InitialValue` props — and the row suite renders the
 * real component to keep the stub honest about that wiring.
 */
type UserSelectorStubProps = {
    id: string;
    isMulti: boolean;
    disabled?: boolean;
    singleSelectInitialValue?: string;
    singleSelectOnChange?: (userId: string) => void;
    multiSelectInitialValue?: string[];
    multiSelectOnChange?: (userIds: string[]) => void;
};

jest.mock('components/admin_console/content_flagging/user_multiselector/user_multiselector', () => ({
    __esModule: true,
    UserSelector: ({id, isMulti, disabled, singleSelectInitialValue, singleSelectOnChange, multiSelectInitialValue, multiSelectOnChange}: UserSelectorStubProps) => {
        const stored = isMulti ? (multiSelectInitialValue ?? []) : [singleSelectInitialValue ?? ''];

        return (
            <div data-testid={`user-selector-${id}`}>
                <span data-testid={`${id}-value`}>{stored.filter(Boolean).join(',')}</span>
                <button
                    data-testid={`${id}-pick`}
                    disabled={disabled}
                    onClick={() => (isMulti ? multiSelectOnChange?.([...(multiSelectInitialValue ?? []), 'user_carol']) : singleSelectOnChange?.('user_carol'))}
                >
                    {'pick'}
                </button>
                <button
                    data-testid={`${id}-deselect`}
                    disabled={disabled}
                    onClick={() => (isMulti ? multiSelectOnChange?.((multiSelectInitialValue ?? []).slice(0, -1)) : singleSelectOnChange?.(''))}
                >
                    {'deselect'}
                </button>
            </div>
        );
    },
}));

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

/*
 * A field the picker will offer. `makeField`'s defaults already make one —
 * unset, writable, and of a type that has a control — so this only gives it a
 * name of its own. Several tests below need the `+ Add attribute` button to be
 * on screen, which it is not when the channel has nothing left to offer.
 */
function spareField(): PropertyField {
    return makeField({id: 'f_spare', name: 'spare', attrs: {options: OPTIONS, display_name: 'Spare'}});
}

async function addAttribute(fieldName: string) {
    await userEvent.click(screen.getByTestId('post-attributes-add'));
    await userEvent.click(screen.getByTestId(`post-attribute-add-${fieldName}`));

    // The picker's items defer their `onClick` until the menu has finished
    // closing, so the row is not there yet when the click returns.
    await waitFor(() => expect(screen.getByTestId(`post-attribute-row-${fieldName}`)).toBeInTheDocument());
}

describe('PostAttributesModal', () => {
    let patchSpy: jest.SpyInstance;

    beforeEach(() => {
        patchSpy = jest.spyOn(Client4, 'patchPropertyValues');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders the post reprise and an add button that advertises a menu', () => {
        patchSpy.mockResolvedValue([]);
        renderModal([makeField(), spareField()], [makeValue()]);

        expect(screen.getByTestId('post-attributes-reprise')).toHaveTextContent('the post being marked');

        const add = screen.getByTestId('post-attributes-add');

        /*
         * Both of these come from the menu rather than from this component, and
         * they are what the button says about itself now that it is live. ARIA
         * reads `aria-haspopup='true'` as `menu`, which is what the menu emits.
         */
        expect(add).toHaveAttribute('aria-haspopup', 'true');
        expect(add).toHaveAttribute('aria-expanded', 'false');
        expect(add).not.toBeDisabled();
    });

    test('the add button keeps its tab stop', async () => {
        patchSpy.mockResolvedValue([]);
        renderModal([makeField(), spareField()], [makeValue()]);

        const add = screen.getByTestId('post-attributes-add');

        // Native `disabled` would make this unreachable: jsdom skips disabled
        // controls when tabbing, exactly as a browser and a screen reader do.
        // The cap stops a control that is genuinely out of the tab order from
        // looping forever.
        for (let i = 0; i < 30 && document.activeElement !== add; i++) {
            // eslint-disable-next-line no-await-in-loop
            await userEvent.tab();
        }

        expect(add).toHaveFocus();
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

    test('unset, only an `always` field is a row — `when_set` and `hidden` both wait for a value', () => {
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

    /*
     * The modal is an edit surface, and `visibility` says where an attribute is
     * advertised rather than who may see it — the server sends hidden fields and
     * their values to every client that can read the post. So a set `hidden`
     * field is a row here and nothing on the message list, which is the whole
     * point of marking it hidden. Same split as CPA's profile popover and its
     * Settings form.
     */
    test('a set `hidden` field is a row, the same as a set `when_set` one', () => {
        patchSpy.mockResolvedValue([]);

        const fields = [
            makeField({id: 'f_hidden', name: 'hidden_field', attrs: {options: OPTIONS, visibility: 'hidden'}}),
            makeField({id: 'f_when_set', name: 'when_set_field', attrs: {options: OPTIONS, visibility: 'when_set'}}),
        ];
        const values = [
            makeValue({field_id: 'f_hidden'}),
            makeValue({field_id: 'f_when_set'}),
        ];

        renderModal(fields, values);

        expect(screen.getByTestId('post-attribute-row-hidden_field')).toBeInTheDocument();
        expect(screen.getByTestId('post-attribute-row-when_set_field')).toBeInTheDocument();
    });

    test('opening on a post with no values shows the channel\'s `always` fields and no empty state', () => {
        patchSpy.mockResolvedValue([]);

        // The spare field is what keeps the `+ Add attribute` assertion below
        // meaningful: the button is drawn when there is something left to offer,
        // and this channel has one unset `when_set` field.
        const fields = [
            makeField({id: 'f_always', name: 'always_field', attrs: {options: OPTIONS, display_name: 'Always', visibility: 'always'}}),
            spareField(),
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

    describe('adding an attribute', () => {
        test('gives the field a row with nothing in it, and writes nothing', async () => {
            patchSpy.mockResolvedValue([]);

            renderModal([spareField()], []);

            expect(screen.queryByTestId('post-attribute-row-spare')).not.toBeInTheDocument();

            await addAttribute('spare');

            expect(screen.getByTestId('post-attribute-trigger-spare')).toHaveTextContent('');
            expect(screen.queryByTestId('post-attribute-clear-spare')).not.toBeInTheDocument();

            // Nothing is written.
            expect(patchSpy).not.toHaveBeenCalled();
        });

        test('the added row reads the store, the same as every other row', async () => {
            patchSpy.mockResolvedValue([]);

            const {store} = renderModal([spareField()], []);

            await addAttribute('spare');

            /*
             * This is the assertion that says the added set holds visibility and
             * not values: the set decided the row exists, and the value the row
             * shows arrived afterwards from somebody else's edit. If the set
             * carried a copy of anything, this row would still be empty.
             */
            act(() => {
                store.dispatch({
                    type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                    data: {values: [makeValue({id: 'value_spare', field_id: 'f_spare', value: 'opt_unclassified'})]},
                });
            });

            await waitFor(() => expect(screen.getByTestId('post-attribute-trigger-spare')).toHaveTextContent('UNCLASSIFIED'));
        });

        test('the last candidate takes the button with it', async () => {
            patchSpy.mockResolvedValue([]);

            const fields = [
                makeField({id: 'f_a', name: 'alpha', attrs: {options: OPTIONS, display_name: 'Alpha'}}),
                makeField({id: 'f_b', name: 'beta', attrs: {options: OPTIONS, display_name: 'Beta'}}),
            ];

            renderModal(fields, []);

            await addAttribute('alpha');

            // One candidate left, so the button is still worth drawing.
            expect(screen.getByTestId('post-attributes-add')).toBeInTheDocument();

            await addAttribute('beta');

            await waitFor(() => expect(screen.queryByTestId('post-attributes-add')).not.toBeInTheDocument());
        });

        test('a channel whose fields are all `always` never draws the button', async () => {
            patchSpy.mockResolvedValue([]);

            const fields = [
                makeField({id: 'f_a', name: 'alpha', attrs: {options: OPTIONS, display_name: 'Alpha', visibility: 'always'}}),
                makeField({id: 'f_b', name: 'beta', attrs: {options: OPTIONS, display_name: 'Beta', visibility: 'always'}}),
            ];

            renderModal(fields, []);

            expect(screen.getByTestId('post-attribute-row-alpha')).toBeInTheDocument();
            expect(screen.getByTestId('post-attribute-row-beta')).toBeInTheDocument();

            /*
             * Absent, not disabled. Such a channel shows every field it has from
             * the first day, so its candidate list is empty on every post, and a
             * disabled control would be the only `+ Add attribute` those users
             * ever saw.
             */
            expect(screen.queryByTestId('post-attributes-add')).not.toBeInTheDocument();
        });

        test('clearing an added row leaves it; clearing a row that was never added removes it', async () => {
            patchSpy.mockResolvedValue([]);

            renderModal([makeField(), spareField()], [makeValue()]);

            await addAttribute('spare');

            patchSpy.mockResolvedValue([makeValue({id: 'value_spare', field_id: 'f_spare', value: 'opt_secret', update_at: 2})]);
            await openMenu('spare');
            await userEvent.click(screen.getByRole('menuitemradio', {name: /SECRET/}));

            await waitFor(() => expect(screen.getByTestId('post-attribute-clear-spare')).toBeInTheDocument());

            patchSpy.mockResolvedValue([makeValue({id: 'value_spare', field_id: 'f_spare', value: '', update_at: 3})]);
            await userEvent.click(screen.getByTestId('post-attribute-clear-spare'));

            await waitFor(() => expect(screen.queryByTestId('post-attribute-clear-spare')).not.toBeInTheDocument());

            /*
             * The two rules meet here and neither predicts it alone: clearing a
             * `when_set` field takes its row away, and a field the user asked for
             * during this opening keeps its row until the modal closes. Emptying
             * a row you just added is an edit, not an undo of the add.
             */
            expect(screen.getByTestId('post-attribute-row-spare')).toBeInTheDocument();

            patchSpy.mockResolvedValue([makeValue({value: '', update_at: 4})]);
            await userEvent.click(screen.getByTestId('post-attribute-clear-classification'));

            await waitFor(() => expect(screen.queryByTestId('post-attribute-row-classification')).not.toBeInTheDocument());
        });

        test('reopening drops an added row left empty and keeps one that was given a value', async () => {
            patchSpy.mockResolvedValue([]);

            const fields = [
                makeField({id: 'f_empty', name: 'empty_field', attrs: {options: OPTIONS, display_name: 'Empty'}}),
                makeField({id: 'f_kept', name: 'kept_field', attrs: {options: OPTIONS, display_name: 'Kept'}}),
            ];
            const kept = makeValue({id: 'value_kept', field_id: 'f_kept', value: 'opt_secret', update_at: 2});

            const {unmount} = renderModal(fields, []);

            await addAttribute('empty_field');
            await addAttribute('kept_field');

            patchSpy.mockResolvedValue([kept]);
            await openMenu('kept_field');
            await userEvent.click(screen.getByRole('menuitemradio', {name: /SECRET/}));

            await waitFor(() => expect(screen.getByTestId('post-attribute-trigger-kept_field')).toHaveTextContent('SECRET'));

            unmount();

            // Reopened over exactly what the first opening left in the store: one
            // value written, and nothing at all for the other field. The added
            // set went with the modal, so only the value can bring a row back —
            // which is the only thing that tells "added" from "set" apart.
            renderModal(fields, [kept]);

            expect(screen.getByTestId('post-attribute-row-kept_field')).toBeInTheDocument();
            expect(screen.queryByTestId('post-attribute-row-empty_field')).not.toBeInTheDocument();
        });
    });

    describe('the user controls', () => {
        const userField = makeField({id: 'field_user', name: 'reviewer', type: 'user', attrs: {display_name: 'Reviewer'}});
        const multiuserField = makeField({id: 'field_multiuser', name: 'reviewers', type: 'multiuser', attrs: {display_name: 'Reviewers'}});

        test('picking a user writes one item carrying a single id', async () => {
            patchSpy.mockResolvedValue([]);

            renderModal([userField], [makeValue({field_id: 'field_user', value: 'user_alice'})]);

            await userEvent.click(screen.getByTestId('postAttributeValueUser-field_user-pick'));

            await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(1));
            expect(patchSpy).toHaveBeenCalledWith(
                'post_attributes',
                'post',
                POST_ID,
                [{field_id: 'field_user', value: 'user_carol'}],
            );
        });

        test('picking a user for a multiuser field writes one item carrying the whole array', async () => {
            patchSpy.mockResolvedValue([]);

            renderModal([multiuserField], [makeValue({field_id: 'field_multiuser', value: ['user_alice']})]);

            await userEvent.click(screen.getByTestId('postAttributeValueUser-field_multiuser-pick'));

            await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(1));
            expect(patchSpy).toHaveBeenCalledWith(
                'post_attributes',
                'post',
                POST_ID,
                [{field_id: 'field_multiuser', value: ['user_alice', 'user_carol']}],
            );
        });

        test('deselecting one user of a multiuser writes the remaining array', async () => {
            patchSpy.mockResolvedValue([]);

            renderModal([multiuserField], [makeValue({field_id: 'field_multiuser', value: ['user_alice', 'user_bob']})]);

            await userEvent.click(screen.getByTestId('postAttributeValueUser-field_multiuser-deselect'));

            await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(1));
            expect(patchSpy).toHaveBeenCalledWith(
                'post_attributes',
                'post',
                POST_ID,
                [{field_id: 'field_multiuser', value: ['user_alice']}],
            );
        });

        // No staged value, on the two controls that arrived last. The picker
        // reads the slice, so an in-flight write leaves it showing what is
        // stored — staging here would show `user_carol` before the server agreed.
        test('the row stays disabled and the picker keeps the stored value while a write is in flight', async () => {
            let resolveWrite: (values: Array<PropertyValue<unknown>>) => void = () => {};
            patchSpy.mockReturnValue(new Promise((resolve) => {
                resolveWrite = resolve;
            }));

            renderModal([userField], [makeValue({id: 'value_user', field_id: 'field_user', value: 'user_alice'})]);

            await userEvent.click(screen.getByTestId('postAttributeValueUser-field_user-pick'));

            await waitFor(() => expect(screen.getByTestId('postAttributeValueUser-field_user-pick')).toBeDisabled());
            expect(screen.getByTestId('postAttributeValueUser-field_user-value')).toHaveTextContent('user_alice');
            expect(screen.getByTestId('post-attribute-clear-reviewer')).toBeDisabled();

            await act(async () => {
                resolveWrite([makeValue({id: 'value_user', field_id: 'field_user', value: 'user_carol', update_at: 2})]);
            });

            await waitFor(() => expect(screen.getByTestId('postAttributeValueUser-field_user-value')).toHaveTextContent('user_carol'));
            expect(screen.getByTestId('postAttributeValueUser-field_user-pick')).not.toBeDisabled();
        });

        // Omitted rather than disabled again, for the two types that could not
        // reach a locked row until they had controls of their own.
        test.each([
            ['user', 'field_user', 'reviewer', 'user_alice'],
            ['multiuser', 'field_multiuser', 'reviewers', ['user_alice', 'user_bob']],
        ])('a locked %s row renders the padlock, no picker and no trash button', (type, fieldId, name, stored) => {
            patchSpy.mockResolvedValue([]);

            const field = makeField({id: fieldId, name, type: type as FieldType, attrs: {display_name: name}, permission_values: 'none'});

            renderModal([field], [makeValue({field_id: fieldId, value: stored})]);

            expect(screen.queryByTestId(`user-selector-postAttributeValueUser-${fieldId}`)).not.toBeInTheDocument();
            expect(screen.queryByTestId(`post-attribute-clear-${name}`)).not.toBeInTheDocument();
            expect(screen.getByRole('img', {name: 'This is a system-level property and cannot be modified.'})).toBeInTheDocument();
        });
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
