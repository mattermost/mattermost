// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React, {useEffect} from 'react';

import type {FieldType, PropertyField} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, waitFor, within} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import PostAttributesComposer from './post_attributes_composer';
import {useComposerAttributes} from './use_composer_attributes';
import type {ComposerPropertyValue} from './use_staged_post_attributes';
import {useStagedPostAttributes} from './use_staged_post_attributes';

/*
 * The user picker is stubbed the same way `post_attributes_modal.test.tsx`
 * stubs it: react-select's async menu needs a debounce, a profile search and
 * a portal to reach a selectable option, none of which this suite is about.
 */
type UserSelectorStubProps = {
    id: string;
    isMulti: boolean;
    singleSelectOnChange?: (userId: string) => void;
    multiSelectInitialValue?: string[];
    multiSelectOnChange?: (userIds: string[]) => void;
};

jest.mock('components/admin_console/content_flagging/user_multiselector/user_multiselector', () => ({
    __esModule: true,
    UserSelector: ({id, isMulti, singleSelectOnChange, multiSelectOnChange, multiSelectInitialValue}: UserSelectorStubProps) => (
        <div data-testid={`user-selector-${id}`}>
            <input
                id={`${id}_input`}
                data-testid={`${id}-input`}
            />
            <button
                data-testid={`${id}-pick`}
                onClick={() => (isMulti ? multiSelectOnChange?.([...(multiSelectInitialValue ?? []), 'user_carol']) : singleSelectOnChange?.('user_carol'))}
            >
                {'pick'}
            </button>
        </div>
    ),
}));

const GROUP_ID = 'group_id';
const CHANNEL_ID = 'channel_id';
const TEAM_ID = 'team_id';
const CURRENT_USER_ID = 'user_current';

const OPTIONS = [
    {id: 'opt_secret', name: 'SECRET', color: 'red'},
    {id: 'opt_unclassified', name: 'UNCLASSIFIED', color: 'green'},
];

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

function makeState(fields: PropertyField[]): DeepPartial<GlobalState> {
    const byId: Record<string, PropertyField> = {};
    fields.forEach((field) => {
        byId[field.id] = field;
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
                    [CURRENT_USER_ID]: {id: CURRENT_USER_ID, username: 'bob', roles: 'system_user'},
                },
            },
            properties: {
                fields: {byId, byObjectType: {post: {[GROUP_ID]: byId}}},
                values: {byTargetId: {}, byFieldId: {}},
                groups: {
                    byId: {[GROUP_ID]: {id: GROUP_ID, name: 'post_attributes'}},
                    byName: {post_attributes: {id: GROUP_ID, name: 'post_attributes'}},
                },
            },
        },
    } as DeepPartial<GlobalState>;
}

/*
 * A spare field the picker will offer in addition to the field under test —
 * several assertions need the `+ Add attribute` control on screen, which is
 * not drawn once the channel has nothing left to offer.
 */
function spareField(): PropertyField {
    return makeField({id: 'f_spare', name: 'spare', attrs: {options: OPTIONS, display_name: 'Spare'}});
}

/**
 * A thin host around the same hook the real caller (`advanced_text_editor.tsx`)
 * uses, so the suite exercises the composer and its state together. The staged
 * values are echoed into the DOM so a test can see what would be sent, not just
 * what a chip shows.
 */
function Host({initialValues = []}: {initialValues?: ComposerPropertyValue[]}) {
    const staged = useStagedPostAttributes();
    const {chips, addable} = useComposerAttributes(CHANNEL_ID, staged.values, staged.added);

    // Seeds the hook through its own `change`, the only way a value gets in.
    useEffect(() => {
        initialValues.forEach(({field_id: fieldId, value}) => staged.change(fieldId, value));

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <>
            <PostAttributesComposer
                chips={chips}
                addable={addable}
                justAdded={staged.justAdded}
                onAdd={staged.add}
                onChange={staged.change}
                onRemove={staged.remove}
            />
            <output data-testid='staged-values'>{JSON.stringify(staged.values)}</output>
        </>
    );
}

function stagedValues(): ComposerPropertyValue[] {
    return JSON.parse(screen.getByTestId('staged-values').textContent || '[]');
}

function renderComposer(fields: PropertyField[], initialValues: ComposerPropertyValue[] = []) {
    return renderWithContext(
        <Host initialValues={initialValues}/>,
        makeState(fields),
    );
}

async function addAttribute(fieldName: string) {
    await userEvent.click(screen.getByTestId('post-attributes-add'));
    await userEvent.click(screen.getByTestId(`post-attribute-add-${fieldName}`));

    // The picker's items defer their `onClick` until the menu has finished
    // closing, so the chip is not there yet when the click returns.
    await waitFor(() => expect(screen.getByTestId(`post-attribute-chip-${fieldName}`)).toBeInTheDocument());
}

describe('PostAttributesComposer', () => {
    test('renders nothing with nothing staged, even if the channel has fields', () => {
        renderComposer([makeField(), spareField()]);

        expect(screen.queryByTestId('post-attributes-composer')).not.toBeInTheDocument();
    });

    test('an `always` field is treated like any other: no chip until the user picks it, and nothing staged', async () => {
        const always = makeField({attrs: {options: OPTIONS, display_name: 'Classification', visibility: 'always'}});

        renderComposer([always, spareField()], [{field_id: 'f_spare', value: 'opt_secret'}]);

        expect(screen.queryByTestId('post-attribute-chip-classification')).not.toBeInTheDocument();

        await userEvent.click(screen.getByTestId('post-attributes-add'));
        expect(screen.getByTestId('post-attribute-add-classification')).toBeInTheDocument();
        await userEvent.keyboard('{Escape}');

        await addAttribute('classification');

        expect(screen.getByTestId('post-attribute-chip-classification')).toBeInTheDocument();
        expect(stagedValues()).toEqual([{field_id: 'f_spare', value: 'opt_secret'}]);
    });

    test('an `always` field alone renders nothing in the chip row', () => {
        renderComposer([makeField({attrs: {options: OPTIONS, display_name: 'Classification', visibility: 'always'}})]);

        expect(screen.queryByTestId('post-attributes-composer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('post-attribute-chip-classification')).not.toBeInTheDocument();
    });

    test('a `when_set` field is absent until picked, then appears as a chip', async () => {
        // The composer's own `+ Add attribute` only appears once something is
        // already staged (see the "renders nothing" test above) — the spare
        // field, pre-staged, is what makes it reachable here. Picking the
        // very first attribute of a message is the separate `+` already in
        // the action row (`PostAttributesButton`), outside this component.
        renderComposer(
            [makeField({attrs: {options: OPTIONS, display_name: 'Classification', visibility: 'when_set'}}), spareField()],
            [{field_id: 'f_spare', value: 'opt_secret'}],
        );

        expect(screen.queryByTestId('post-attribute-chip-classification')).not.toBeInTheDocument();

        await addAttribute('classification');

        expect(screen.getByTestId('post-attribute-chip-classification')).toBeInTheDocument();
    });

    test('picking a field from the picker opens its value menu immediately', async () => {
        renderComposer(
            [makeField(), spareField()],
            [{field_id: 'field_1', value: 'opt_secret'}],
        );

        await addAttribute('spare');

        expect(screen.getByTestId('post-attribute-trigger-spare')).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('menuitemradio', {name: /SECRET/})).toBeInTheDocument();
    });

    test('clicking a staged chip reopens its value menu', async () => {
        renderComposer([makeField()], [{field_id: 'field_1', value: 'opt_secret'}]);

        const trigger = screen.getByTestId('post-attribute-trigger-classification');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        await userEvent.click(trigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    test('a staged value renders through the same PostAttributeChip a sent post would show', () => {
        renderComposer([makeField()], [{field_id: 'field_1', value: 'opt_secret'}]);

        const trigger = screen.getByTestId('post-attribute-trigger-classification');
        const chip = within(trigger).getByTestId('select-property');
        expect(chip).toHaveTextContent('SECRET');
        expect(chip).toHaveClass('PostAttributeChip');
    });

    test('a chip with a value shows only the value; the field name is its tooltip', async () => {
        renderComposer([makeField()], [{field_id: 'field_1', value: 'opt_secret'}]);

        const chip = screen.getByTestId('post-attribute-chip-classification');
        expect(chip).not.toHaveTextContent('Classification');
        expect(screen.getByTestId('post-attribute-trigger-classification')).toHaveAccessibleName('Classification: SECRET');

        await userEvent.hover(screen.getByTestId('post-attribute-trigger-classification'));
        expect(await screen.findByRole('tooltip')).toHaveTextContent('Classification');
    });

    test("picking a value writes the composer's state, keyed by field id", async () => {
        renderComposer([makeField()], [{field_id: 'field_1', value: 'opt_secret'}]);

        await userEvent.click(screen.getByTestId('post-attribute-trigger-classification'));
        await userEvent.click(screen.getByRole('menuitemradio', {name: /UNCLASSIFIED/}));

        await waitFor(() => expect(screen.getByTestId('post-attribute-trigger-classification')).toHaveTextContent('UNCLASSIFIED'));
    });

    test('the picker offers only fields not already staged', async () => {
        renderComposer(
            [makeField(), spareField()],
            [{field_id: 'field_1', value: 'opt_secret'}],
        );

        await userEvent.click(screen.getByTestId('post-attributes-add'));
        expect(screen.queryByTestId('post-attribute-add-classification')).not.toBeInTheDocument();
        expect(screen.getByTestId('post-attribute-add-spare')).toBeInTheDocument();
    });

    test('with nothing left to offer, the add control is not rendered', () => {
        renderComposer([makeField()], [{field_id: 'field_1', value: 'opt_secret'}]);

        expect(screen.queryByTestId('post-attributes-add')).not.toBeInTheDocument();
    });

    test('a locked field is neither shown nor offered by the picker', async () => {
        const locked = makeField({permission_values: 'none'});
        const lockedAlways = makeField({
            id: 'f_locked_always',
            name: 'locked_always',
            permission_values: 'none',
            attrs: {options: OPTIONS, display_name: 'Locked always', visibility: 'always'},
        });
        const editable = makeField({id: 'f_editable', name: 'editable', attrs: {options: OPTIONS, display_name: 'Editable'}});

        renderComposer(
            [locked, lockedAlways, editable, spareField()],
            [{field_id: 'field_1', value: 'opt_secret'}, {field_id: 'f_editable', value: 'opt_secret'}],
        );

        expect(screen.queryByTestId('post-attribute-chip-classification')).not.toBeInTheDocument();
        expect(screen.queryByTestId('post-attribute-chip-locked_always')).not.toBeInTheDocument();
        expect(screen.queryByRole('img', {name: "You don't have permission to modify this attribute."})).not.toBeInTheDocument();
        expect(screen.getByTestId('post-attribute-chip-editable')).toBeInTheDocument();
        expect(screen.getByTestId('post-attribute-trigger-editable')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('post-attributes-add'));
        expect(screen.queryByTestId('post-attribute-add-classification')).not.toBeInTheDocument();
        expect(screen.queryByTestId('post-attribute-add-locked_always')).not.toBeInTheDocument();
        expect(screen.getByTestId('post-attribute-add-spare')).toBeInTheDocument();
    });

    test('a field the composer has no control for is neither shown nor offered by the picker', async () => {
        const due = makeField({id: 'f_due', name: 'due', type: 'date' as FieldType, attrs: {display_name: 'Due'}});

        renderComposer([due, makeField(), spareField()], [{field_id: 'f_due', value: 1700000000000}, {field_id: 'field_1', value: 'opt_secret'}]);

        expect(screen.queryByTestId('post-attribute-chip-due')).not.toBeInTheDocument();
        expect(screen.getByTestId('post-attribute-chip-classification')).toBeInTheDocument();

        await userEvent.click(screen.getByTestId('post-attributes-add'));
        expect(screen.queryByTestId('post-attribute-add-due')).not.toBeInTheDocument();
        expect(screen.getByTestId('post-attribute-add-spare')).toBeInTheDocument();
    });

    test('with only locked fields, nothing is rendered', () => {
        renderComposer(
            [makeField({permission_values: 'none', attrs: {options: OPTIONS, display_name: 'Classification', visibility: 'always'}})],
            [{field_id: 'field_1', value: 'opt_secret'}],
        );

        expect(screen.queryByTestId('post-attributes-composer')).not.toBeInTheDocument();
    });

    test('removing a picked chip drops both its value and the chip', async () => {
        renderComposer(
            [makeField({attrs: {options: OPTIONS, display_name: 'Classification', visibility: 'when_set'}}), spareField()],
            [{field_id: 'f_spare', value: 'opt_secret'}],
        );

        await addAttribute('classification');
        await userEvent.click(screen.getByRole('menuitemradio', {name: /UNCLASSIFIED/}));
        await waitFor(() => expect(stagedValues()).toContainEqual({field_id: 'field_1', value: 'opt_unclassified'}));

        await userEvent.click(screen.getByRole('button', {name: 'Remove Classification'}));

        expect(screen.queryByTestId('post-attribute-chip-classification')).not.toBeInTheDocument();
        expect(stagedValues()).toEqual([{field_id: 'f_spare', value: 'opt_secret'}]);

        // Removed, it is offered again.
        await userEvent.click(screen.getByTestId('post-attributes-add'));
        expect(screen.getByTestId('post-attribute-add-classification')).toBeInTheDocument();
    });

    test('removing a picked text chip with no value yet drops the chip', async () => {
        const field = makeField({type: 'text', attrs: {display_name: 'Note'}});

        renderComposer([field, spareField()], [{field_id: 'f_spare', value: 'opt_secret'}]);

        await addAttribute('classification');

        // An option chip with no value can't be reached this way: its open
        // menu covers the ×, and closing the menu un-stages it on its own.
        await userEvent.click(screen.getByRole('button', {name: 'Remove Note'}));

        expect(screen.queryByTestId('post-attribute-chip-classification')).not.toBeInTheDocument();
    });

    test('a picked option chip with no value shows the field name and has its own accessible name', async () => {
        renderComposer(
            [makeField({attrs: {options: OPTIONS, display_name: 'Classification', visibility: 'when_set'}}), spareField()],
            [{field_id: 'f_spare', value: 'opt_secret'}],
        );

        await addAttribute('classification');

        const trigger = screen.getByTestId('post-attribute-trigger-classification');
        expect(trigger).toHaveTextContent('Classification');
        expect(trigger).toHaveAccessibleName('Select value for Classification');
    });

    test('closing a just-picked option chip without a value un-stages it', async () => {
        renderComposer(
            [makeField({attrs: {options: OPTIONS, display_name: 'Classification', visibility: 'when_set'}}), spareField()],
            [{field_id: 'f_spare', value: 'opt_secret'}],
        );

        await addAttribute('classification');
        await userEvent.keyboard('{Escape}');

        await waitFor(() => expect(screen.queryByTestId('post-attribute-chip-classification')).not.toBeInTheDocument());
        expect(stagedValues()).toEqual([{field_id: 'f_spare', value: 'opt_secret'}]);

        await userEvent.click(screen.getByTestId('post-attributes-add'));
        expect(screen.getByTestId('post-attribute-add-classification')).toBeInTheDocument();
    });

    test('picking a single-choice value closes the menu and keeps the chip', async () => {
        renderComposer(
            [makeField({attrs: {options: OPTIONS, display_name: 'Classification', visibility: 'when_set'}}), spareField()],
            [{field_id: 'f_spare', value: 'opt_secret'}],
        );

        await addAttribute('classification');
        await userEvent.click(screen.getByRole('menuitemradio', {name: /^SECRET/}));

        await waitFor(() => expect(stagedValues()).toContainEqual({field_id: 'field_1', value: 'opt_secret'}));
        await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
        expect(screen.getByTestId('post-attribute-chip-classification')).toBeInTheDocument();
        expect(screen.getByTestId('post-attribute-trigger-classification')).toHaveTextContent('SECRET');
    });

    test('reopening a chip that has a value and closing it changes nothing', async () => {
        renderComposer([makeField()], [{field_id: 'field_1', value: 'opt_secret'}]);

        await userEvent.click(screen.getByTestId('post-attribute-trigger-classification'));
        await userEvent.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());

        expect(screen.getByTestId('post-attribute-chip-classification')).toBeInTheDocument();
        expect(stagedValues()).toEqual([{field_id: 'field_1', value: 'opt_secret'}]);
    });

    test('removing an `always` field\'s chip drops it, as for any other field, and offers it again', async () => {
        const field = makeField({attrs: {options: OPTIONS, display_name: 'Classification', visibility: 'always'}});

        renderComposer([field, spareField()], [{field_id: 'f_spare', value: 'opt_secret'}]);

        await addAttribute('classification');
        await userEvent.click(screen.getByRole('menuitemradio', {name: /^SECRET/}));
        await waitFor(() => expect(stagedValues()).toContainEqual({field_id: 'field_1', value: 'opt_secret'}));

        await userEvent.click(screen.getByRole('button', {name: 'Remove Classification'}));

        expect(screen.queryByTestId('post-attribute-chip-classification')).not.toBeInTheDocument();
        expect(stagedValues()).toEqual([{field_id: 'f_spare', value: 'opt_secret'}]);

        await userEvent.click(screen.getByTestId('post-attributes-add'));
        expect(screen.getByTestId('post-attribute-add-classification')).toBeInTheDocument();
    });

    test('an emptied multiselect is dropped from the staged values, keeps its chip while open, and loses it on close', async () => {
        const field = makeField({type: 'multiselect', attrs: {options: OPTIONS, display_name: 'Classification', visibility: 'when_set'}});

        renderComposer([field, spareField()], [{field_id: 'f_spare', value: 'opt_secret'}]);

        await addAttribute('classification');

        await userEvent.click(screen.getByRole('menuitemcheckbox', {name: /^SECRET/}));
        await waitFor(() => expect(stagedValues()).toContainEqual({field_id: 'field_1', value: ['opt_secret']}));

        await userEvent.click(screen.getByRole('menuitemcheckbox', {name: /^SECRET/}));
        await waitFor(() => expect(stagedValues()).toEqual([{field_id: 'f_spare', value: 'opt_secret'}]));

        expect(screen.getByTestId('post-attribute-chip-classification')).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        await waitFor(() => expect(screen.queryByTestId('post-attribute-chip-classification')).not.toBeInTheDocument());
        expect(stagedValues()).toEqual([{field_id: 'f_spare', value: 'opt_secret'}]);
    });

    test('an emptied text value is dropped from the staged values, and the picked chip stays', async () => {
        const field = makeField({type: 'text', attrs: {display_name: 'Note'}});

        renderComposer([field, spareField()], [{field_id: 'f_spare', value: 'opt_secret'}]);

        await addAttribute('classification');

        await userEvent.type(screen.getByTestId('post-attribute-input-classification'), 'hello');
        await userEvent.tab();
        await waitFor(() => expect(stagedValues()).toContainEqual({field_id: 'field_1', value: 'hello'}));

        // Left, it rests as a chip; editing it again goes through the chip.
        await userEvent.click(screen.getByTestId('post-attribute-rest-classification'));
        await userEvent.clear(screen.getByTestId('post-attribute-input-classification'));
        await userEvent.tab();

        await waitFor(() => expect(stagedValues()).toEqual([{field_id: 'f_spare', value: 'opt_secret'}]));
        expect(screen.getByTestId('post-attribute-chip-classification')).toBeInTheDocument();

        // An emptied text chip rests as the field's name.
        expect(screen.getByTestId('post-attribute-rest-classification')).toHaveTextContent('Note');
    });

    test('picking a text field focuses its input', async () => {
        const field = makeField({type: 'text', attrs: {display_name: 'Note'}});

        renderComposer([field, spareField()], [{field_id: 'f_spare', value: 'opt_secret'}]);

        await addAttribute('classification');

        await waitFor(() => expect(screen.getByTestId('post-attribute-input-classification')).toHaveFocus());
    });

    test('picking a user field focuses its search input', async () => {
        const field = makeField({type: 'user', attrs: {display_name: 'Owner'}});

        renderComposer([field, spareField()], [{field_id: 'f_spare', value: 'opt_secret'}]);

        await addAttribute('classification');

        await waitFor(() => expect(screen.getByTestId('postAttributeValueUser-field_1-input')).toHaveFocus());
    });

    test('a staged text field that was not just picked rests as a chip and does not take focus', () => {
        renderComposer([makeField({type: 'text', attrs: {display_name: 'Note'}})], [{field_id: 'field_1', value: 'hello'}]);

        const rest = screen.getByTestId('post-attribute-rest-classification');
        expect(rest).not.toHaveFocus();
        expect(rest).toHaveAccessibleName('Note: hello');
        expect(within(rest).getByTestId('text-property')).toHaveTextContent('hello');
        expect(screen.queryByTestId('post-attribute-input-classification')).not.toBeInTheDocument();
    });

    test('a text chip at rest turns into its input on click, and back into a chip on blur', async () => {
        renderComposer([makeField({type: 'text', attrs: {display_name: 'Note'}})], [{field_id: 'field_1', value: 'hello'}]);

        await userEvent.click(screen.getByTestId('post-attribute-rest-classification'));

        const input = screen.getByTestId('post-attribute-input-classification');
        await waitFor(() => expect(input).toHaveFocus());
        expect(input).toHaveValue('hello');

        await userEvent.type(input, ' there');
        await userEvent.tab();

        await waitFor(() => expect(stagedValues()).toEqual([{field_id: 'field_1', value: 'hello there'}]));
        expect(screen.queryByTestId('post-attribute-input-classification')).not.toBeInTheDocument();
        expect(screen.getByTestId('post-attribute-rest-classification')).toHaveAccessibleName('Note: hello there');
    });

    test('pressing the × on a text chip being edited keeps focus in its input, so one click removes the chip', async () => {
        renderComposer([makeField({type: 'text', attrs: {display_name: 'Note'}})], [{field_id: 'field_1', value: 'hello'}]);

        await userEvent.click(screen.getByTestId('post-attribute-rest-classification'));
        const input = screen.getByTestId('post-attribute-input-classification');
        await waitFor(() => expect(input).toHaveFocus());

        // jsdom has no layout, so the × can't move away from the pointer here;
        // what the browser needs is that the press doesn't blur the input.
        const remove = screen.getByRole('button', {name: 'Remove Note'});
        await userEvent.pointer({keys: '[MouseLeft>]', target: remove});
        expect(input).toHaveFocus();

        await userEvent.click(remove);
        expect(screen.queryByTestId('post-attribute-chip-classification')).not.toBeInTheDocument();
        expect(stagedValues()).toEqual([]);
    });

    test('a user chip at rest shows the name with no profile popover, and turns into the user picker on click', async () => {
        renderComposer([makeField({type: 'user', attrs: {display_name: 'Owner'}})], [{field_id: 'field_1', value: CURRENT_USER_ID}]);

        const rest = screen.getByTestId('post-attribute-rest-classification');
        expect(rest).toHaveAccessibleName(/^Owner: /);
        expect(within(rest).getByTestId('user-property')).toBeInTheDocument();

        // The name is plain text: a button inside the chip's button would be
        // invalid, and the click belongs to the chip.
        expect(within(rest).queryByRole('button')).not.toBeInTheDocument();

        await userEvent.click(rest);

        await waitFor(() => expect(screen.getByTestId('postAttributeValueUser-field_1-input')).toHaveFocus());
    });

    test('`permission_values: creator` is writable for any user — there is no post yet, so the author is the composer', () => {
        const field = makeField({permission_values: 'creator', attrs: {options: OPTIONS, display_name: 'Classification'}});

        renderComposer([field], [{field_id: 'field_1', value: 'opt_secret'}]);

        expect(screen.getByTestId('post-attribute-trigger-classification')).toBeInTheDocument();
    });
});
