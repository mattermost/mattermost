// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import userEvent from '@testing-library/user-event';
import React, {useEffect} from 'react';

import type {PropertyField} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import PostAttributesComposer from './post_attributes_composer';
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

    // Seeds the hook through its own `change`, the only way a value gets in.
    useEffect(() => {
        initialValues.forEach(({field_id: fieldId, value}) => staged.change(fieldId, value));

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <>
            <PostAttributesComposer
                channelId={CHANNEL_ID}
                values={staged.values}
                added={staged.added}
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

    test('an `always` field renders a chip with no value staged, with no interaction required', () => {
        const field = makeField({attrs: {options: OPTIONS, display_name: 'Classification', visibility: 'always'}});

        renderComposer([field]);

        expect(screen.getByTestId('post-attribute-chip-classification')).toBeInTheDocument();
        expect(screen.getByTestId('post-attribute-trigger-classification')).toBeInTheDocument();
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

    test('a staged value renders through the same PropertyValueRenderer chip a sent post would show', () => {
        renderComposer([makeField()], [{field_id: 'field_1', value: 'opt_secret'}]);

        const trigger = screen.getByTestId('post-attribute-trigger-classification');
        expect(trigger.querySelector('.SelectProperty')).toHaveTextContent('SECRET');
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

    test('removing a picked chip with no value yet drops the chip', async () => {
        renderComposer(
            [makeField({attrs: {options: OPTIONS, display_name: 'Classification', visibility: 'when_set'}}), spareField()],
            [{field_id: 'f_spare', value: 'opt_secret'}],
        );

        await addAttribute('classification');
        await userEvent.keyboard('{Escape}');

        await userEvent.click(screen.getByRole('button', {name: 'Remove Classification'}));

        expect(screen.queryByTestId('post-attribute-chip-classification')).not.toBeInTheDocument();
    });

    test('removing an `always` chip clears its value but keeps the chip', async () => {
        const field = makeField({attrs: {options: OPTIONS, display_name: 'Classification', visibility: 'always'}});

        renderComposer([field], [{field_id: 'field_1', value: 'opt_secret'}]);

        expect(screen.getByTestId('post-attribute-trigger-classification')).toHaveTextContent('SECRET');

        await userEvent.click(screen.getByRole('button', {name: 'Remove Classification'}));

        expect(stagedValues()).toEqual([]);
        expect(screen.getByTestId('post-attribute-chip-classification')).toBeInTheDocument();
        expect(screen.getByTestId('post-attribute-trigger-classification')).not.toHaveTextContent('SECRET');

        // Nothing left to remove, so the button goes.
        expect(screen.queryByRole('button', {name: 'Remove Classification'})).not.toBeInTheDocument();
    });

    test('an empty `always` chip offers no remove button', () => {
        renderComposer([makeField({attrs: {options: OPTIONS, display_name: 'Classification', visibility: 'always'}})]);

        expect(screen.getByTestId('post-attribute-chip-classification')).toBeInTheDocument();
        expect(screen.queryByTestId('post-attribute-remove-classification')).not.toBeInTheDocument();
    });

    test('an emptied value is dropped from the staged values, and the picked chip stays', async () => {
        const field = makeField({type: 'multiselect', attrs: {options: OPTIONS, display_name: 'Classification', visibility: 'when_set'}});

        renderComposer([field, spareField()], [{field_id: 'f_spare', value: 'opt_secret'}]);

        await addAttribute('classification');

        await userEvent.click(screen.getByRole('menuitemcheckbox', {name: /^SECRET/}));
        await waitFor(() => expect(stagedValues()).toContainEqual({field_id: 'field_1', value: ['opt_secret']}));

        await userEvent.click(screen.getByRole('menuitemcheckbox', {name: /^SECRET/}));
        await waitFor(() => expect(stagedValues()).toEqual([{field_id: 'f_spare', value: 'opt_secret'}]));

        expect(screen.getByTestId('post-attribute-chip-classification')).toBeInTheDocument();
    });

    test('an emptied text value is dropped from the staged values', async () => {
        const field = makeField({type: 'text', attrs: {display_name: 'Note', visibility: 'always'}});

        renderComposer([field], [{field_id: 'field_1', value: 'hello'}]);

        const input = screen.getByTestId('post-attribute-input-classification');
        await userEvent.clear(input);
        await userEvent.tab();

        expect(stagedValues()).toEqual([]);
        expect(screen.getByTestId('post-attribute-chip-classification')).toBeInTheDocument();
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

    test('a staged text field that was not just picked does not take focus', () => {
        renderComposer([makeField({type: 'text', attrs: {display_name: 'Note', visibility: 'always'}})]);

        expect(screen.getByTestId('post-attribute-input-classification')).not.toHaveFocus();
    });

    test('`permission_values: creator` is writable for any user — there is no post yet, so the author is the composer', () => {
        const field = makeField({permission_values: 'creator', attrs: {options: OPTIONS, display_name: 'Classification', visibility: 'always'}});

        renderComposer([field]);

        expect(screen.getByTestId('post-attribute-trigger-classification')).toBeInTheDocument();
    });
});
