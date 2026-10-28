// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {UserProfile} from '@mattermost/types/users';

import {installA11yFocusShim} from 'tests/helpers/a11y_focus_shim';
import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UserSettingsGeneral from './user_settings_general';

describe('components/user_settings/general/UserSettingsGeneral custom attribute Combobox', () => {
    const user: UserProfile = TestHelper.getUserMock({
        id: 'user_id',
        username: 'user_name',
        first_name: 'first_name',
        last_name: 'last_name',
        nickname: 'nickname',
        position: '',
        email: '',
        password: '',
        auth_service: '',
        last_picture_update: 0,
    });

    const requiredProps = {
        intl: defaultIntl,
        user,
        updateSection: jest.fn(),
        updateTab: jest.fn(),
        activeSection: '',
        closeModal: jest.fn(),
        collapseModal: jest.fn(),
        isMobileView: false,
        customProfileAttributeFields: [],
        actions: {
            logError: jest.fn(),
            clearErrors: jest.fn(),
            updateMe: jest.fn(),
            sendVerificationEmail: jest.fn(),
            setDefaultProfileImage: jest.fn(),
            uploadProfileImage: jest.fn(),
            saveCustomProfileAttribute: jest.fn(),
            getCustomProfileAttributeValues: jest.fn(),
        },
        maxFileSize: 1024,
        ldapPositionAttributeSet: false,
        samlPositionAttributeSet: false,
        ldapPictureAttributeSet: false,
        lockProfileFieldsForEmailUsers: 'none' as const,
        canEditOtherUsers: false,
        enableCustomProfileAttributes: false,
    };

    const customProfileAttribute: UserPropertyField = {
        id: 'field1',
        group_id: 'custom_profile_attributes',
        name: 'Test Attribute',
        type: 'text',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        created_by: '',
        updated_by: '',
        target_id: '',
        target_type: '',
        object_type: '',
        attrs: {
            sort_order: 0,
            visibility: 'when_set',
            value_type: '',
        },
    };

    const COMBOBOX_ID = 'customProfileAttribute_field1';
    const OPTIONS = [
        {id: 'opt1', name: 'Option 1', color: ''},
        {id: 'opt2', name: 'Option 2', color: ''},
        {id: 'opt3', name: 'Option 3', color: ''},
    ];

    const buildField = (type: UserPropertyField['type'], attrs: Partial<UserPropertyField['attrs']> = {}): UserPropertyField => ({
        ...customProfileAttribute,
        type,
        attrs: {
            value_type: '',
            visibility: 'when_set',
            sort_order: 0,
            options: OPTIONS,
            ...attrs,
        },
    });

    const renderEditor = (field: UserPropertyField, value?: string | string[]) => {
        const saveCustomProfileAttribute = jest.fn().mockResolvedValue({data: {}});
        const customProfileAttributes: Record<string, string | string[]> = value === undefined ? {} : {field1: value};
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [field],
            user: {...user, custom_profile_attributes: customProfileAttributes},
            activeSection: 'customAttribute_field1',
            actions: {...requiredProps.actions, saveCustomProfileAttribute},
        };
        const view = renderWithContext(<UserSettingsGeneral {...props}/>);
        return {...view, saveCustomProfileAttribute};
    };

    const getCombobox = (name = 'Test Attribute') => screen.getByRole('combobox', {name});

    const getSelections = (name = 'Test Attribute') => screen.queryByRole('toolbar', {name: `${name} selections`});

    const getChipLabels = () => {
        const selections = getSelections();
        return selections ? within(selections).queryAllByRole('button').map((chip) => chip.textContent) : [];
    };

    describe('structure', () => {
        test('puts the id and test id on the input and derives listbox and option ids from it', async () => {
            renderEditor(buildField('select'));

            const combobox = getCombobox();
            expect(combobox).toHaveAttribute('id', COMBOBOX_ID);
            expect(combobox).toHaveAttribute('data-testid', COMBOBOX_ID);
            expect(screen.getByTestId(COMBOBOX_ID)).toBe(combobox);
            expect(document.getElementById(`${COMBOBOX_ID}_input`)).toBeNull();

            await userEvent.click(combobox);

            expect(screen.getByRole('listbox')).toHaveAttribute('id', `${COMBOBOX_ID}-listbox`);
            const option = screen.getByRole('option', {name: 'Option 1'});
            expect(option).toHaveAttribute('id', `${COMBOBOX_ID}-listbox-option-opt1`);
            expect(option).toHaveAttribute('data-testid', `${COMBOBOX_ID}-option-opt1`);
            expect(screen.getByTestId(`${COMBOBOX_ID}-option-opt3`)).toHaveAccessibleName('Option 3');
        });

        test('lists options in definition order', async () => {
            renderEditor(buildField('select', {options: [OPTIONS[2], OPTIONS[0], OPTIONS[1]]}));

            await userEvent.click(getCombobox());

            expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Option 3', 'Option 1', 'Option 2']);
        });

        test('names the input and clear button after attrs.display_name when set', () => {
            renderEditor(buildField('select', {display_name: 'Friendly Name'}), 'opt1');

            expect(getCombobox('Friendly Name')).toHaveValue('Option 1');
            expect(screen.getByTestId(`${COMBOBOX_ID}-clear`)).toHaveAccessibleName('Clear Friendly Name');
            expect(screen.queryByRole('combobox', {name: 'Test Attribute'})).not.toBeInTheDocument();
        });

        test('names the multiselect selections group after attrs.display_name when set', () => {
            renderEditor(buildField('multiselect', {display_name: 'Friendly Name'}), ['opt1']);

            const selections = screen.getByRole('toolbar', {name: 'Friendly Name selections'});
            expect(within(selections).getByText('Option 1')).toBeInTheDocument();
        });

        test('renders a rank field as a single clearable combobox and saves the picked id', async () => {
            const rankOptions = [
                {id: 'senior', name: 'Senior', color: ''},
                {id: 'junior', name: 'Junior', color: ''},
                {id: 'mid', name: 'Mid', color: ''},
            ];
            const {saveCustomProfileAttribute} = renderEditor(buildField('rank', {options: rankOptions}), 'junior');

            const combobox = getCombobox();
            expect(combobox).toHaveValue('Junior');
            expect(screen.getByTestId(`${COMBOBOX_ID}-clear`)).toBeInTheDocument();
            expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();

            await userEvent.click(combobox);
            expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Senior', 'Junior', 'Mid']);
            await userEvent.click(screen.getByRole('option', {name: 'Mid'}));
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));

            expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', 'mid');
        });

        test('portals the menu above the modal with z-index 1100', async () => {
            renderEditor(buildField('select'));

            await userEvent.click(getCombobox());

            let layer: HTMLElement | null = screen.getByRole('listbox');
            while (layer && !layer.style.zIndex) {
                layer = layer.parentElement;
            }
            expect(layer?.style.zIndex).toBe('1100');
        });

        test('shows a field without options as an empty combobox with a no-results message', async () => {
            renderEditor(buildField('select', {options: undefined}));

            await userEvent.click(getCombobox());

            expect(screen.queryAllByRole('option')).toHaveLength(0);
            expect(screen.getByText('No results')).toBeInTheDocument();
        });
    });

    describe('values', () => {
        test('shows an empty single field as unset, with the placeholder and no clear button', () => {
            renderEditor(buildField('select'), '');

            expect(getCombobox()).toHaveValue('');
            expect(getCombobox()).toHaveAttribute('placeholder', 'Select');
            expect(screen.queryByTestId(`${COMBOBOX_ID}-clear`)).not.toBeInTheDocument();
        });

        test('shows a single field holding an array draft as unset', () => {
            renderEditor(buildField('select'), ['opt1']);

            expect(getCombobox()).toHaveValue('');
            expect(screen.queryByTestId(`${COMBOBOX_ID}-clear`)).not.toBeInTheDocument();
        });

        test('shows a missing single id raw, like multiselect, and an untouched Save sends it back', async () => {
            const {saveCustomProfileAttribute} = renderEditor(buildField('select'), 'gone');

            expect(getCombobox()).toHaveValue('gone');
            expect(screen.getByTestId(`${COMBOBOX_ID}-clear`)).toBeInTheDocument();
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));

            expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', 'gone');
        });

        test('renders multiselect chips in stored value order, with raw ids for missing options', () => {
            renderEditor(buildField('multiselect'), ['opt3', 'gone', 'opt1']);

            expect(getChipLabels()).toEqual(['Option 3', 'gone', 'Option 1']);
        });

        test('saves missing multiselect ids untouched when the user saves without changes', async () => {
            const {saveCustomProfileAttribute} = renderEditor(buildField('multiselect'), ['opt1', 'gone']);

            await userEvent.click(screen.getByRole('button', {name: 'Save'}));

            expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', ['opt1', 'gone']);
        });

        test('treats a plain string multiselect value as one selection', async () => {
            const {saveCustomProfileAttribute} = renderEditor(buildField('multiselect'), 'opt2');

            expect(getChipLabels()).toEqual(['Option 2']);
            await userEvent.click(getCombobox());
            await userEvent.click(screen.getByRole('option', {name: 'Option 3'}));
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));

            expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', ['opt2', 'opt3']);
        });

        test('shows an empty multiselect with the placeholder, no chips and no clear button, and saves []', async () => {
            const {saveCustomProfileAttribute} = renderEditor(buildField('multiselect'), '');

            expect(getCombobox()).toHaveAttribute('placeholder', 'Select');
            expect(getChipLabels()).toEqual([]);
            expect(screen.queryByTestId(`${COMBOBOX_ID}-clear`)).not.toBeInTheDocument();
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));

            expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', []);
        });

        test('marks selected multiselect rows and toggles one off when clicked again', async () => {
            const {saveCustomProfileAttribute} = renderEditor(buildField('multiselect'), ['opt1', 'opt2']);

            await userEvent.click(getCombobox());
            expect(screen.getByRole('option', {name: 'Option 1'})).toHaveAttribute('aria-selected', 'true');
            expect(screen.getByRole('option', {name: 'Option 3'})).toHaveAttribute('aria-selected', 'false');

            await userEvent.click(screen.getByRole('option', {name: 'Option 1'}));
            expect(getChipLabels()).toEqual(['Option 2']);
            await userEvent.click(screen.getByRole('button', {name: 'Save'}));

            expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', ['opt2']);
        });

        test('saves [] rather than null after the last multiselect chip is removed', async () => {
            const user = userEvent.setup();
            const {saveCustomProfileAttribute} = renderEditor(buildField('multiselect'), ['opt1', 'opt2']);

            await user.click(getCombobox());
            await user.keyboard('{Backspace}');
            expect(getChipLabels()).toEqual(['Option 1']);
            await user.keyboard('{Backspace}');
            expect(getChipLabels()).toEqual([]);
            await user.click(screen.getByRole('button', {name: 'Save'}));

            expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', []);
        });
    });

    describe('keyboard', () => {
        installA11yFocusShim();

        let documentKeyDown: jest.Mock;

        beforeEach(() => {
            documentKeyDown = jest.fn();
            document.addEventListener('keydown', documentKeyDown);
        });

        afterEach(() => {
            document.removeEventListener('keydown', documentKeyDown);
        });

        const documentKeys = () => documentKeyDown.mock.calls.map(([e]: [KeyboardEvent]) => e.key);

        const getSettingList = () => document.querySelector('.setting-list');

        const expectClosed = () => {
            expect(getCombobox()).toHaveAttribute('aria-expanded', 'false');
            expect(screen.queryAllByRole('option')).toHaveLength(0);
        };

        const expectOpen = () => {
            expect(getCombobox()).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
        };

        // Compass opens on any input focus, so a focused, closed field is reached by clicking then Escape.
        const focusClosedField = async (user: ReturnType<typeof userEvent.setup>) => {
            await user.click(getCombobox());
            await user.keyboard('{Escape}');
            expect(getCombobox()).toHaveFocus();
            expect(getCombobox()).toHaveAttribute('aria-expanded', 'false');
        };

        test('opens a single field with the menu closed and focus in the section, not on the input', () => {
            renderEditor(buildField('select'));

            expect(getSettingList()).toHaveFocus();
            expectClosed();
        });

        test('opens a single field with a value with the menu closed and the clear button focused', () => {
            renderEditor(buildField('select'), 'opt1');

            expect(screen.getByTestId(`${COMBOBOX_ID}-clear`)).toHaveFocus();
            expect(getCombobox()).not.toHaveFocus();
            expectClosed();
        });

        test('opens a multiselect with values with the menu closed and the first chip focused', () => {
            renderEditor(buildField('multiselect'), ['opt1', 'opt2']);

            const [firstChip] = within(getSelections()!).getAllByRole('button');
            expect(getChipLabels()).toEqual(['Option 1', 'Option 2']);
            expect(firstChip).toHaveFocus();
            expect(getCombobox()).not.toHaveFocus();
            expectClosed();
        });

        test.each(['select', 'multiselect'] as const)('clicking a %s input opens its menu', async (type) => {
            const user = userEvent.setup();
            renderEditor(buildField(type), type === 'multiselect' ? ['opt1'] : 'opt1');
            expectClosed();

            await user.click(getCombobox());

            expect(getCombobox()).toHaveFocus();
            expect(document.activeElement?.closest('[data-chip]')).toBeNull();
            expectOpen();
        });

        test.each([
            ['select', '{ArrowDown}'],
            ['select', '{ArrowUp}'],
            ['select', '{Alt>}{ArrowDown}{/Alt}'],
            ['multiselect', '{ArrowDown}'],
            ['multiselect', '{ArrowUp}'],
            ['multiselect', '{Alt>}{ArrowDown}{/Alt}'],
        ] as const)('%s %s on a focused, closed input opens the menu', async (type, keys) => {
            const user = userEvent.setup();
            renderEditor(buildField(type));
            await focusClosedField(user);

            await user.keyboard(keys);

            expectOpen();
        });

        test.each(['select', 'multiselect'] as const)('typing in a focused, closed %s input opens a filtered menu', async (type) => {
            const user = userEvent.setup();
            renderEditor(buildField(type));
            await focusClosedField(user);

            await user.keyboard('3');

            expect(getCombobox()).toHaveAttribute('aria-expanded', 'true');
            expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Option 3']);
        });

        test.each([
            ['select', undefined],
            ['multiselect', []],
        ] as const)('Enter right after an empty %s section opens saves it', async (type, saved) => {
            const user = userEvent.setup();
            const {saveCustomProfileAttribute} = renderEditor(buildField(type));
            expect(getSettingList()).toHaveFocus();

            await user.keyboard('{Enter}');

            expect(saveCustomProfileAttribute).toHaveBeenCalledTimes(1);
            expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', saved);
        });

        test('Enter right after a select section with a value opens clears it on the focused clear button without saving', async () => {
            const user = userEvent.setup();
            const {saveCustomProfileAttribute} = renderEditor(buildField('select'), 'opt1');

            await user.keyboard('{Enter}');

            expect(getCombobox()).toHaveValue('');
            expect(saveCustomProfileAttribute).not.toHaveBeenCalled();
            expect(documentKeys()).not.toContain('Enter');
        });

        test.each([
            ['select', 'opt1'],
            ['multiselect', ['opt1', 'opt2']],
        ] as const)('Enter on a focused, closed %s input saves', async (type, value) => {
            const user = userEvent.setup();
            const {saveCustomProfileAttribute} = renderEditor(buildField(type), value as string | string[]);
            await focusClosedField(user);

            await user.keyboard('{Enter}');

            expect(saveCustomProfileAttribute).toHaveBeenCalledTimes(1);
            expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', value);
        });

        test('Tab from the expanded empty section into a single input opens the menu, as Compass opens on focus', async () => {
            const user = userEvent.setup();
            renderEditor(buildField('select'));
            expect(getSettingList()).toHaveFocus();
            expectClosed();

            await user.tab();

            expect(getCombobox()).toHaveFocus();
            expectOpen();
        });

        test('Tab from the focused first chip moves to the input and opens the menu', async () => {
            const user = userEvent.setup();
            renderEditor(buildField('multiselect'), ['opt1', 'opt2']);
            const [firstChip] = within(getSelections()!).getAllByRole('button');
            expect(firstChip).toHaveFocus();
            expectClosed();

            await user.tab();

            expect(getCombobox()).toHaveFocus();
            expectOpen();
        });

        test('ArrowDown opens, ArrowDown then Enter picks without saving, and a second Enter saves the picked id', async () => {
            const user = userEvent.setup();
            const {saveCustomProfileAttribute} = renderEditor(buildField('select'));
            await focusClosedField(user);

            await user.keyboard('{ArrowDown}');
            expectOpen();
            await user.keyboard('{ArrowDown}{Enter}');

            expect(getCombobox()).toHaveValue('Option 2');
            expect(getCombobox()).toHaveAttribute('aria-expanded', 'false');
            expect(saveCustomProfileAttribute).not.toHaveBeenCalled();
            expect(documentKeys()).not.toContain('Enter');

            await user.keyboard('{Enter}');

            expect(saveCustomProfileAttribute).toHaveBeenCalledTimes(1);
            expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', 'opt2');
        });

        test('Enter on an explicitly opened empty field picks the first option without saving', async () => {
            const user = userEvent.setup();
            const {saveCustomProfileAttribute} = renderEditor(buildField('select'));
            await focusClosedField(user);

            await user.keyboard('{ArrowDown}{Enter}');

            expect(getCombobox()).toHaveValue('Option 1');
            expect(saveCustomProfileAttribute).not.toHaveBeenCalled();
        });

        test('Escape with the menu open closes it without reaching document, and a second Escape does', async () => {
            const user = userEvent.setup();
            renderEditor(buildField('select'), 'opt1');

            await user.click(getCombobox());
            expect(getCombobox()).toHaveAttribute('aria-expanded', 'true');
            await user.keyboard('{Escape}');

            expect(getCombobox()).toHaveAttribute('aria-expanded', 'false');
            expect(getCombobox()).toHaveValue('Option 1');
            expect(documentKeys()).not.toContain('Escape');

            await user.keyboard('{Escape}');

            expect(documentKeys()).toEqual(['Escape']);
        });

        test('Enter on the initially focused clear button clears without saving, and Save then sends an empty value', async () => {
            const user = userEvent.setup();
            const {saveCustomProfileAttribute} = renderEditor(buildField('select'), 'opt1');
            expect(screen.getByTestId(`${COMBOBOX_ID}-clear`)).toHaveFocus();

            await user.keyboard('{Enter}');

            expect(getCombobox()).toHaveValue('');
            expect(getCombobox()).toHaveAttribute('placeholder', 'Select');
            expect(saveCustomProfileAttribute).not.toHaveBeenCalled();
            expect(documentKeys()).not.toContain('Enter');

            await user.click(screen.getByRole('button', {name: 'Save'}));

            expect(saveCustomProfileAttribute).toHaveBeenCalledTimes(1);
            expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', '');
        });

        test('selecting all text, deleting it and tabbing out commits nothing', async () => {
            const user = userEvent.setup();
            const {saveCustomProfileAttribute} = renderEditor(buildField('select'), 'opt1');

            await user.click(getCombobox());
            await user.keyboard('{Control>}a{/Control}{Delete}');
            expect(getCombobox()).toHaveValue('');
            await user.tab();

            expect(getCombobox()).not.toHaveFocus();
            expect(getCombobox()).toHaveValue('Option 1');
            expect(saveCustomProfileAttribute).not.toHaveBeenCalled();

            await user.click(screen.getByRole('button', {name: 'Save'}));

            expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', 'opt1');
        });

        test('ArrowDown then Enter on an opened multiselect adds a chip without saving', async () => {
            const user = userEvent.setup();
            const {saveCustomProfileAttribute} = renderEditor(buildField('multiselect'));

            await user.click(getCombobox());
            await user.keyboard('{ArrowDown}{Enter}');

            expect(getChipLabels()).toEqual(['Option 2']);
            expect(saveCustomProfileAttribute).not.toHaveBeenCalled();
            expect(documentKeys()).not.toContain('Enter');

            await user.click(screen.getByRole('button', {name: 'Save'}));

            expect(saveCustomProfileAttribute).toHaveBeenCalledTimes(1);
            expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', ['opt2']);
        });

        test('Enter on a chip reached by keyboard removes it without saving', async () => {
            const user = userEvent.setup();
            const {saveCustomProfileAttribute} = renderEditor(buildField('multiselect'), ['opt1', 'opt2']);

            // The section opens on the roving-tabindex chip (the first), and ArrowRight moves along the group.
            const [firstChip, lastChip] = within(getSelections()!).getAllByRole('button');
            expect(firstChip).toHaveFocus();
            await user.keyboard('{ArrowRight}');
            expect(lastChip).toHaveFocus();
            expect(lastChip).toHaveTextContent('Option 2');

            await user.keyboard('{Enter}');

            expect(getChipLabels()).toEqual(['Option 1']);
            expect(saveCustomProfileAttribute).not.toHaveBeenCalled();
            expect(documentKeys()).not.toContain('Enter');

            await user.click(screen.getByRole('button', {name: 'Save'}));

            expect(saveCustomProfileAttribute).toHaveBeenCalledTimes(1);
            expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', ['opt1']);
        });

        test('mousedown on the menu outside an option keeps focus on the input, so Escape closes only the menu', async () => {
            const user = userEvent.setup();
            const {saveCustomProfileAttribute} = renderEditor(buildField('select'), 'opt1');

            await user.click(getCombobox());

            // The listbox's parent is the menu's scroll area, where a padding or scrollbar click lands.
            await user.pointer({keys: '[MouseLeft]', target: screen.getByRole('listbox').parentElement!});

            expect(getCombobox()).toHaveFocus();
            expect(getCombobox()).toHaveAttribute('aria-expanded', 'true');

            await user.keyboard('{Escape}');

            expect(getCombobox()).toHaveAttribute('aria-expanded', 'false');
            expect(documentKeys()).not.toContain('Escape');
            expect(saveCustomProfileAttribute).not.toHaveBeenCalled();
        });
    });
});
