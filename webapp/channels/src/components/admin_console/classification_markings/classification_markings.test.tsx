// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField, PropertyFieldOption, PropertyValue} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import ClassificationMarkings from './classification_markings';
import * as Utils from './utils';
import {
    detectPreset,
    optionsToLevels,
    levelsToOptions,
    processClassificationField,
    fetchClassificationField,
    fetchChannelClassificationField,
    CLASSIFICATIONS_CHANNEL_FIELD_NAME,
    CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
    CLASSIFICATIONS_FIELD_TARGET_ID,
    CLASSIFICATIONS_FIELD_TARGET_TYPE,
    CLASSIFICATIONS_GROUP_NAME,
    CLASSIFICATIONS_SYSTEM_FIELD_NAME,
    CLASSIFICATIONS_SYSTEM_OBJECT_TYPE,
    CLASSIFICATIONS_SYSTEM_VALUE_TARGET_ID,
    CLASSIFICATIONS_TEMPLATE_FIELD_NAME,
    CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE,
    DISPLAY_BANNER_BOTTOM,
    DISPLAY_BANNER_TOP,
} from './utils';
import type {ClassificationLevel} from './utils/presets';
import {PRESET_CUSTOM, presets} from './utils/presets';

const MOCK_USER_ID = 'current_user_id_12345678';
const BASE_STATE = {entities: {users: {currentUserId: MOCK_USER_ID}}};

jest.mock('mattermost-redux/client');

function makePropertyField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field1',
        group_id: CLASSIFICATIONS_GROUP_NAME,
        name: CLASSIFICATIONS_TEMPLATE_FIELD_NAME,
        type: 'rank',
        attrs: {options: []},
        target_id: '',
        target_type: CLASSIFICATIONS_FIELD_TARGET_TYPE,
        object_type: CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE,
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        created_by: 'user1',
        updated_by: 'user1',
        ...overrides,
    };
}

function makeLinkedField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'linked_field1',
        group_id: CLASSIFICATIONS_GROUP_NAME,
        name: CLASSIFICATIONS_SYSTEM_FIELD_NAME,
        type: 'rank',
        attrs: {actions: []},
        target_id: CLASSIFICATIONS_FIELD_TARGET_ID,
        target_type: CLASSIFICATIONS_FIELD_TARGET_TYPE,
        object_type: CLASSIFICATIONS_SYSTEM_OBJECT_TYPE,
        linked_field_id: 'field1',
        create_at: 2000,
        update_at: 2000,
        delete_at: 0,
        created_by: 'user1',
        updated_by: 'user1',
        ...overrides,
    };
}

function makeChannelLinkedField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'channel_field1',
        group_id: CLASSIFICATIONS_GROUP_NAME,
        name: CLASSIFICATIONS_CHANNEL_FIELD_NAME,
        type: 'rank',
        attrs: {},
        target_id: '',
        target_type: CLASSIFICATIONS_FIELD_TARGET_TYPE,
        object_type: CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
        linked_field_id: 'field1',
        create_at: 4000,
        update_at: 4000,
        delete_at: 0,
        created_by: 'user1',
        updated_by: 'user1',
        ...overrides,
    };
}

function makeSystemValue(fieldId: string, optionId: string): PropertyValue<string> {
    return {
        id: 'value1',
        target_id: CLASSIFICATIONS_SYSTEM_VALUE_TARGET_ID,
        target_type: CLASSIFICATIONS_SYSTEM_OBJECT_TYPE,
        group_id: CLASSIFICATIONS_GROUP_NAME,
        field_id: fieldId,
        value: optionId,
        create_at: 3000,
        update_at: 3000,
        delete_at: 0,
        created_by: 'user1',
        updated_by: 'user1',
    };
}

describe('detectPreset', () => {
    test('should match each built-in preset', () => {
        for (const preset of presets) {
            expect(detectPreset(preset.levels)).toBe(preset.id);
        }
    });

    test('should return custom when levels length differs', () => {
        const usPreset = presets.find((p) => p.id === 'us')!;
        const truncated = usPreset.levels.slice(0, 2);
        expect(detectPreset(truncated)).toBe(PRESET_CUSTOM);
    });

    test('should return custom when a name differs', () => {
        const usPreset = presets.find((p) => p.id === 'us')!;
        const modified = usPreset.levels.map((l) => ({...l}));
        modified[0].name = 'MODIFIED';
        expect(detectPreset(modified)).toBe(PRESET_CUSTOM);
    });

    test('should return custom when a rank differs', () => {
        const usPreset = presets.find((p) => p.id === 'us')!;
        const modified = usPreset.levels.map((l) => ({...l}));
        modified[0].rank = 999;
        expect(detectPreset(modified)).toBe(PRESET_CUSTOM);
    });

    test('should match colors case-insensitively', () => {
        const usPreset = presets.find((p) => p.id === 'us')!;
        const lowered = usPreset.levels.map((l) => ({...l, color: l.color.toLowerCase()}));
        expect(detectPreset(lowered)).toBe('us');
    });

    test('should return custom for empty levels', () => {
        expect(detectPreset([])).toBe(PRESET_CUSTOM);
    });
});

describe('optionsToLevels', () => {
    test('should convert options to levels with explicit rank and color', () => {
        const options: PropertyFieldOption[] = [
            {id: 'a', name: 'Alpha', color: '#FF0000', rank: 2},
            {id: 'b', name: 'Beta', color: '#00FF00', rank: 1},
        ];

        const levels = optionsToLevels(options);

        expect(levels).toHaveLength(2);
        expect(levels[0]).toEqual({id: 'b', name: 'Beta', color: '#00FF00', rank: 1});
        expect(levels[1]).toEqual({id: 'a', name: 'Alpha', color: '#FF0000', rank: 2});
    });

    test('should default color to #000000 when missing', () => {
        const options: PropertyFieldOption[] = [
            {id: 'a', name: 'NoColor'},
        ];

        const levels = optionsToLevels(options);
        expect(levels[0].color).toBe('#000000');
    });

    test('should default rank to index+1 when missing', () => {
        const options: PropertyFieldOption[] = [
            {id: 'a', name: 'First'},
            {id: 'b', name: 'Second'},
            {id: 'c', name: 'Third'},
        ];

        const levels = optionsToLevels(options);
        expect(levels[0].rank).toBe(1);
        expect(levels[1].rank).toBe(2);
        expect(levels[2].rank).toBe(3);
    });

    test('should handle empty options', () => {
        expect(optionsToLevels([])).toEqual([]);
    });
});

describe('levelsToOptions', () => {
    test('should convert levels to options preserving name, color, rank', () => {
        const levels: ClassificationLevel[] = [
            {id: 'real_id', name: 'SECRET', color: '#C8102E', rank: 1},
        ];

        const options = levelsToOptions(levels);
        expect(options).toEqual([{id: 'real_id', name: 'SECRET', color: '#C8102E', rank: 1}]);
    });

    test('should strip pending_ IDs to empty string', () => {
        const levels: ClassificationLevel[] = [
            {id: 'pending_12345', name: 'NEW', color: '#000000', rank: 1},
            {id: 'existing_id', name: 'OLD', color: '#111111', rank: 2},
        ];

        const options = levelsToOptions(levels);
        expect(options[0].id).toBe('');
        expect(options[1].id).toBe('existing_id');
    });

    test('should handle empty levels', () => {
        expect(levelsToOptions([])).toEqual([]);
    });
});

describe('processClassificationField', () => {
    test('should extract levels and detect preset from a field', () => {
        const usPreset = presets.find((p) => p.id === 'us')!;
        const field = makePropertyField({
            attrs: {
                options: usPreset.levels.map((l) => ({
                    id: l.id,
                    name: l.name,
                    color: l.color,
                    rank: l.rank,
                })),
            },
        });

        const result = processClassificationField(field);
        expect(result.presetId).toBe('us');
        expect(result.levels).toHaveLength(usPreset.levels.length);
        expect(result.levels[0].name).toBe('UNCLASSIFIED');
    });

    test('should return custom preset for non-matching options', () => {
        const field = makePropertyField({
            attrs: {
                options: [
                    {id: 'x', name: 'CUSTOM_LEVEL', color: '#123456', rank: 1},
                ],
            },
        });

        const result = processClassificationField(field);
        expect(result.presetId).toBe(PRESET_CUSTOM);
        expect(result.levels).toHaveLength(1);
    });

    test('should handle field with no attrs', () => {
        const field = makePropertyField({attrs: undefined});
        const result = processClassificationField(field);
        expect(result.presetId).toBe(PRESET_CUSTOM);
        expect(result.levels).toEqual([]);
    });
});

describe('fetchClassificationField', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should return the matching field from first page', async () => {
        const expected = makePropertyField({delete_at: 0});
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([
            makePropertyField({id: 'other', name: 'other_field', delete_at: 0}),
            expected,
        ]);

        const result = await fetchClassificationField();
        expect(result).toEqual(expected);
        expect(Client4.getPropertyFields).toHaveBeenCalledTimes(1);
    });

    test('should skip soft-deleted fields', async () => {
        const active = makePropertyField({id: 'active', delete_at: 0});
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([
            makePropertyField({id: 'deleted', delete_at: 1234}),
            active,
        ]);

        const result = await fetchClassificationField();
        expect(result).toEqual(active);
    });

    test('should paginate when field not found on first page', async () => {
        const page1 = [
            makePropertyField({id: 'p1', name: 'other1', delete_at: 0, create_at: 100}),
            makePropertyField({id: 'p2', name: 'other2', delete_at: 0, create_at: 200}),
        ];
        const expected = makePropertyField({id: 'found', delete_at: 0});
        const page2 = [expected];

        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce(page1).
            mockResolvedValueOnce(page2);

        const result = await fetchClassificationField();
        expect(result).toEqual(expected);
        expect(Client4.getPropertyFields).toHaveBeenCalledTimes(2);

        const secondCallArgs = (Client4.getPropertyFields as jest.Mock).mock.calls[1];
        expect(secondCallArgs[4]).toEqual({cursorId: 'p2', cursorCreateAt: 200});
    });

    test('should return undefined when no pages contain the field', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        const result = await fetchClassificationField();
        expect(result).toBeUndefined();
    });

    test('should stop after 500 items to avoid infinite loop', async () => {
        const makePage = (startId: number) =>
            Array.from({length: 100}, (_, i) =>
                makePropertyField({id: `id_${startId + i}`, name: `other_${startId + i}`, delete_at: 0, create_at: startId + i}),
            );

        const spy = jest.spyOn(Client4, 'getPropertyFields');
        for (let i = 0; i < 6; i++) {
            spy.mockResolvedValueOnce(makePage(i * 100));
        }

        const result = await fetchClassificationField();
        expect(result).toBeUndefined();

        expect(Client4.getPropertyFields).toHaveBeenCalledTimes(5);
    });
});

describe('fetchChannelClassificationField', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Reset mockResolvedValueOnce queues that may carry over from the
        // fetchClassificationField "stop after 500 items" test.
        (Client4.getPropertyFields as jest.Mock).mockReset?.();
    });

    test('should return the matching channel-linked field from first page', async () => {
        const expected = makeChannelLinkedField();
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([
            makeChannelLinkedField({id: 'other', name: 'other_field'}),
            expected,
        ]);

        const result = await fetchChannelClassificationField();
        expect(result).toEqual(expected);
        expect(Client4.getPropertyFields).toHaveBeenCalledTimes(1);
        expect(Client4.getPropertyFields).toHaveBeenCalledWith(
            CLASSIFICATIONS_GROUP_NAME,
            CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
            CLASSIFICATIONS_FIELD_TARGET_TYPE,
            '',
            expect.any(Object),
        );
    });

    test('should skip channel fields without linked_field_id', async () => {
        const orphan = makeChannelLinkedField({id: 'orphan', linked_field_id: ''});
        const linked = makeChannelLinkedField({id: 'linked'});
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([orphan, linked]);

        const result = await fetchChannelClassificationField();
        expect(result).toEqual(linked);
    });

    test('should skip soft-deleted channel-linked fields', async () => {
        const deleted = makeChannelLinkedField({id: 'deleted', delete_at: 999});
        const active = makeChannelLinkedField({id: 'active'});
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([deleted, active]);

        const result = await fetchChannelClassificationField();
        expect(result).toEqual(active);
    });

    test('should paginate using cursor when field not found on first page', async () => {
        const page1 = [
            makeChannelLinkedField({id: 'p1', name: 'other1', create_at: 100}),
            makeChannelLinkedField({id: 'p2', name: 'other2', create_at: 200}),
        ];
        const expected = makeChannelLinkedField({id: 'found'});
        const page2 = [expected];

        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce(page1).
            mockResolvedValueOnce(page2);

        const result = await fetchChannelClassificationField();
        expect(result).toEqual(expected);
        expect(Client4.getPropertyFields).toHaveBeenCalledTimes(2);

        const secondCallArgs = (Client4.getPropertyFields as jest.Mock).mock.calls[1];
        expect(secondCallArgs[4]).toEqual({cursorId: 'p2', cursorCreateAt: 200});
    });

    test('should return undefined when field list is empty', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        const result = await fetchChannelClassificationField();
        expect(result).toBeUndefined();
    });

    test('should return undefined when no pages contain a valid channel-linked field', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([
            makeChannelLinkedField({id: 'irrelevant', name: 'other'}),
        ]).mockResolvedValueOnce([]);

        const result = await fetchChannelClassificationField();
        expect(result).toBeUndefined();
    });

    test('should stop after 500 items to avoid infinite loop', async () => {
        const makePage = (startId: number) =>
            Array.from({length: 100}, (_, i) =>
                makeChannelLinkedField({id: `id_${startId + i}`, name: `other_${startId + i}`, create_at: startId + i}),
            );

        const spy = jest.spyOn(Client4, 'getPropertyFields');
        for (let i = 0; i < 6; i++) {
            spy.mockResolvedValueOnce(makePage(i * 100));
        }

        const result = await fetchChannelClassificationField();
        expect(result).toBeUndefined();
        expect(Client4.getPropertyFields).toHaveBeenCalledTimes(5);
    });
});

describe('ClassificationMarkings component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should show loading screen initially', () => {
        jest.spyOn(Client4, 'getPropertyFields').mockReturnValue(new Promise(() => {}));

        const {container} = renderWithContext(<ClassificationMarkings/>, BASE_STATE);

        expect(screen.getByText('Classification Markings')).toBeInTheDocument();
        expect(container.querySelector('.loading-screen')).toBeInTheDocument();
    });

    test('should show error when load fails', async () => {
        const error = new Error('Network error');
        (error as unknown as Record<string, number>).status_code = 500;
        jest.spyOn(Client4, 'getPropertyFields').mockRejectedValueOnce(error);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);

        await screen.findByText(/Failed to load classification markings/);
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    test('should show informational notice when loaded', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);

        await screen.findByText('True');

        expect(screen.getByRole('heading', {name: 'Classification markings are informational only'})).toBeInTheDocument();
        expect(
            screen.getByText('Markings are not tied to access control decisions at this time and are for display purposes only.'),
        ).toBeInTheDocument();
    });

    test('should render disabled state when no existing field', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);

        await screen.findByText('True');

        const falseRadio = screen.getByRole('radio', {name: /False/i}) as HTMLInputElement;
        expect(falseRadio.checked).toBe(true);

        expect(screen.queryByText('Classification preset')).not.toBeInTheDocument();
    });

    test('should render enabled state with levels when field exists', async () => {
        const usPreset = presets.find((p) => p.id === 'us')!;
        const field = makePropertyField({
            attrs: {
                options: usPreset.levels.map((l) => ({
                    id: l.id,
                    name: l.name,
                    color: l.color,
                    rank: l.rank,
                })),
            },
        });
        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]). // template field call
            mockResolvedValueOnce([]); // linked field call (none found)

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);

        await screen.findByText('Classification preset');

        const classificationTrueRadio = screen.getByTestId('classificationEnabledtrue') as HTMLInputElement;
        expect(classificationTrueRadio.checked).toBe(true);

        expect(screen.getByText('Classification levels')).toBeInTheDocument();
    });

    test('should show preset and levels sections when enabled', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);

        await screen.findByText('True');

        const user = userEvent.setup();
        const trueRadio = screen.getByRole('radio', {name: /True/i});
        await act(async () => {
            await user.click(trueRadio);
        });

        expect(screen.getByText('Classification preset')).toBeInTheDocument();
        expect(screen.getByText('Classification levels')).toBeInTheDocument();
    });

    test('should not show Custom option when a named preset is active and no custom edits exist', async () => {
        const usPreset = presets.find((p) => p.id === 'us')!;
        const field = makePropertyField({
            attrs: {
                options: usPreset.levels.map((l) => ({
                    id: l.id,
                    name: l.name,
                    color: l.color,
                    rank: l.rank,
                })),
            },
        });
        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]).
            mockResolvedValueOnce([]); // linked field

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);

        await screen.findByText('Classification levels');

        // The selected value should be US, and Custom should not appear anywhere
        expect(screen.getByText('United States')).toBeInTheDocument();
        expect(screen.queryByText('Custom classification levels')).not.toBeInTheDocument();
    });

    test('should show Custom indicator after editing a level', async () => {
        const usPreset = presets.find((p) => p.id === 'us')!;
        const field = makePropertyField({
            attrs: {
                options: usPreset.levels.map((l) => ({
                    id: l.id,
                    name: l.name,
                    color: l.color,
                    rank: l.rank,
                })),
            },
        });
        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]).
            mockResolvedValueOnce([]); // linked field

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);

        await screen.findByText('Classification levels');

        const user = userEvent.setup();

        // Initially shows US preset, not Custom
        expect(screen.queryByText('Custom classification levels')).not.toBeInTheDocument();

        // Edit the first level name to trigger switchToCustom
        const nameInputs = screen.getAllByRole('textbox', {name: /Classification level name/i});
        await user.clear(nameInputs[0]);
        await user.type(nameInputs[0], 'MODIFIED');
        await user.tab();

        // Custom should now appear as the selected dropdown value
        expect(screen.getByText('Custom classification levels')).toBeInTheDocument();
    });

    test('should detect hasChanges when toggling enabled', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);

        await screen.findByText('True');

        const user = userEvent.setup();

        const trueRadio = screen.getByRole('radio', {name: /True/i});
        await act(async () => {
            await user.click(trueRadio);
        });

        expect(screen.getByText('Save')).toBeInTheDocument();
    });

    test('should validate empty levels when saving while enabled', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);

        await screen.findByText('True');

        const user = userEvent.setup();

        await act(async () => {
            await user.click(screen.getByRole('radio', {name: /True/i}));
        });

        await act(async () => {
            await user.click(screen.getByText('Save'));
        });

        await screen.findByText(/At least one classification level is required/);
    });

    test('should handle 404 error as no field found', async () => {
        const error = new Error('Not found');
        (error as unknown as Record<string, number>).status_code = 404;
        jest.spyOn(Client4, 'getPropertyFields').mockRejectedValueOnce(error);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);

        await screen.findByText('True');
        expect(screen.queryByText(/Failed to load/)).not.toBeInTheDocument();
    });

    test('should allow typing a full 6-char hex color without auto-fill at 3 chars', async () => {
        const field = makePropertyField({
            attrs: {
                options: [
                    {id: 'lvl1', name: 'SECRET', color: '#C8102E', rank: 1},
                ],
            },
        });
        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]).
            mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);
        await screen.findByText('Classification levels');

        const user = userEvent.setup();
        const colorInput = screen.getByTestId('color-inputColorValue');

        await act(async () => {
            await user.clear(colorInput);
            await user.type(colorInput, '#1a2b3c');
        });

        expect(colorInput).toHaveValue('#1a2b3c');
    });

    test('should sync color to level on blur', async () => {
        const field = makePropertyField({
            attrs: {
                options: [
                    {id: 'lvl1', name: 'SECRET', color: '#C8102E', rank: 1},
                ],
            },
        });
        const patchedTemplate = makePropertyField({
            attrs: {
                options: [
                    {id: 'lvl1', name: 'SECRET', color: '#1a2b3c', rank: 1},
                ],
            },
        });

        // Use an existing linked field so persistLevels uses patchPropertyField
        // (not createPropertyField) for the linked field, keeping all mocks fully consumed.
        const linkedField = makeLinkedField({attrs: {actions: []}});

        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]). // template field
            mockResolvedValueOnce([linkedField]). // linked field (existing, no banner actions)
            mockResolvedValueOnce([makeChannelLinkedField()]); // channel-linked field exists during save
        jest.spyOn(Client4, 'patchPropertyField').
            mockResolvedValueOnce(patchedTemplate). // patch template
            mockResolvedValueOnce(linkedField); // patch linked

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);
        await screen.findByText('Classification levels');

        const user = userEvent.setup();
        const colorInput = screen.getByTestId('color-inputColorValue');

        await user.clear(colorInput);
        await user.type(colorInput, '#1a2b3c');
        await user.tab();

        const saveButton = await screen.findByText('Save');
        await user.click(saveButton);

        await waitFor(() => {
            expect(Client4.patchPropertyField).toHaveBeenCalledWith(
                CLASSIFICATIONS_GROUP_NAME,
                CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE,
                'field1',
                expect.objectContaining({
                    attrs: expect.objectContaining({
                        options: expect.arrayContaining([
                            expect.objectContaining({color: '#1a2b3c'}),
                        ]),
                    }),
                }),
            );
        });
        await act(async () => {}); // flush remaining async state updates
    });

    test('should pass disabled prop to disable controls', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings disabled={true}/>, BASE_STATE);

        await screen.findByText('True');

        const trueRadio = screen.getByRole('radio', {name: /True/i}) as HTMLInputElement;
        expect(trueRadio.disabled).toBe(true);
    });
});

describe('GlobalClassificationIndicators section', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should not show Global Classification Indicators when classification is disabled', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);
        await screen.findByText('True');

        expect(screen.queryByText('Global Classification Indicators')).not.toBeInTheDocument();
    });

    test('should show Global Classification Indicators when classification is enabled', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]).
            mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);
        await screen.findByText('Global Classification Indicators');

        expect(screen.getByText('Configure the global classification banner')).toBeInTheDocument();
        expect(screen.getByText('Global Classification Banner')).toBeInTheDocument();
    });

    test('should read initial banner state from linked field actions and system property value', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        const linked = makeLinkedField({
            attrs: {actions: [DISPLAY_BANNER_TOP, DISPLAY_BANNER_BOTTOM]},
        });
        const sysValue = makeSystemValue('linked_field1', 'lvl1');

        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]). // template field
            mockResolvedValueOnce([linked]); // linked field

        jest.spyOn(Client4, 'getSystemPropertyValues').
            mockResolvedValueOnce([sysValue]); // system value

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);
        await screen.findByText('Banner visibility');

        // top_and_bottom placement: the "false" radio (top_and_bottom side) should be selected
        expect(screen.getByTestId('globalBannerPlacementfalse')).toBeChecked();

        expect(screen.getByText('UNCLASSIFIED')).toBeInTheDocument();
    });

    test('should show placement and level controls when global banner is enabled', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        const linked = makeLinkedField({
            attrs: {actions: [DISPLAY_BANNER_TOP]},
        });
        const sysValue = makeSystemValue('linked_field1', 'lvl1');

        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]).
            mockResolvedValueOnce([linked]);

        jest.spyOn(Client4, 'getSystemPropertyValues').
            mockResolvedValueOnce([sysValue]);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);
        await screen.findByText('Banner visibility');

        expect(screen.getByText('Top only')).toBeInTheDocument();
        expect(screen.getByText('Top and bottom')).toBeInTheDocument();
        expect(screen.getByText('Global classification level')).toBeInTheDocument();
    });

    test('should validate that a level is selected when global banner is enabled', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]).
            mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);
        await screen.findByText('Global Classification Indicators');

        const user = userEvent.setup();

        // Enable the global banner without selecting a level
        await act(async () => {
            await user.click(screen.getByTestId('globalBannerEnabledtrue'));
        });

        await act(async () => {
            await user.click(screen.getByText('Save'));
        });

        await screen.findByText(/A global classification level must be selected/);
    });

    test('should not invalidate banner when the referenced level is renamed (ID still matches)', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        const linked = makeLinkedField({
            attrs: {actions: [DISPLAY_BANNER_TOP]},
        });
        const sysValue = makeSystemValue('linked_field1', 'lvl1');

        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]).
            mockResolvedValueOnce([linked]);

        jest.spyOn(Client4, 'getSystemPropertyValues').
            mockResolvedValueOnce([sysValue]);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);
        await screen.findByText('Classification levels');

        const user = userEvent.setup();

        const nameInput = screen.getByRole('textbox', {name: /Classification level name/i});
        await user.clear(nameInput);
        await user.type(nameInput, 'DECLASSIFIED');
        await user.tab();

        // The banner still references the same level by ID, so no error should appear.
        expect(
            screen.queryByText(/The previously selected level no longer exists/),
        ).not.toBeInTheDocument();
    });

    test('should validate that the referenced level still exists when it was deleted', async () => {
        const field = makePropertyField({
            attrs: {
                options: [
                    {id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
                    {id: 'lvl2', name: 'CONFIDENTIAL', color: '#FFD700', rank: 2},
                ],
            },
        });
        const linked = makeLinkedField({
            attrs: {actions: [DISPLAY_BANNER_TOP]},
        });
        const sysValue = makeSystemValue('linked_field1', 'lvl1');

        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]).
            mockResolvedValueOnce([linked]);

        jest.spyOn(Client4, 'getSystemPropertyValues').
            mockResolvedValueOnce([sysValue]);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);
        await screen.findByText('Classification levels');

        const user = userEvent.setup();

        // Delete the first level (UNCLASSIFIED) which is referenced by the banner.
        const deleteButtons = screen.getAllByRole('button', {name: /Delete level/i});
        await act(async () => {
            await user.click(deleteButtons[0]);
        });

        await act(async () => {
            await user.click(screen.getByText('Save'));
        });

        await screen.findByText(/The global classification banner is configured with a level that no longer exists/);
    });

    test('should patch linked field with actions and upsert system value when banner changes', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        const linked = makeLinkedField({
            attrs: {actions: [DISPLAY_BANNER_TOP]},
        });
        const sysValue = makeSystemValue('linked_field1', 'lvl1');

        const patchedTemplate = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#112233', rank: 1}]},
        });
        const patchedLinked = makeLinkedField({
            attrs: {actions: [DISPLAY_BANNER_TOP, DISPLAY_BANNER_BOTTOM]},
        });

        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]).
            mockResolvedValueOnce([linked]).
            mockResolvedValueOnce([makeChannelLinkedField()]); // channel-linked field already exists during save

        jest.spyOn(Client4, 'getSystemPropertyValues').
            mockResolvedValueOnce([sysValue]);

        jest.spyOn(Client4, 'patchPropertyField').
            mockResolvedValueOnce(patchedTemplate). // patch template field
            mockResolvedValueOnce(patchedLinked); // patch linked field

        // Spy at utility level to avoid auto-mock limitations for patchSystemPropertyValues.
        const saveUpsertSpy = jest.spyOn(Utils, 'saveUpsertSystemValue').mockResolvedValue([]);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);
        await screen.findByText('Classification levels');

        const user = userEvent.setup();

        // Change the level color.
        const colorInput = screen.getByTestId('color-inputColorValue');
        await user.clear(colorInput);
        await user.type(colorInput, '#112233');
        await user.tab();

        // Change banner placement to top_and_bottom.
        await user.click(screen.getByTestId('globalBannerPlacementfalse'));

        const saveButton = await screen.findByText('Save');
        await user.click(saveButton);

        await waitFor(() => {
            // Template field patched without global_banner in attrs.
            expect(Client4.patchPropertyField).toHaveBeenCalledWith(
                CLASSIFICATIONS_GROUP_NAME,
                CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE,
                'field1',
                expect.objectContaining({
                    attrs: expect.objectContaining({options: expect.any(Array)}),
                }),
            );
            expect(Client4.patchPropertyField).not.toHaveBeenCalledWith(
                expect.anything(),
                CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE,
                expect.anything(),
                expect.objectContaining({
                    attrs: expect.objectContaining({global_banner: expect.anything()}),
                }),
            );

            // Linked field patched with updated actions (top_and_bottom).
            expect(Client4.patchPropertyField).toHaveBeenCalledWith(
                CLASSIFICATIONS_GROUP_NAME,
                CLASSIFICATIONS_SYSTEM_OBJECT_TYPE,
                'linked_field1',
                expect.objectContaining({
                    attrs: expect.objectContaining({
                        actions: [DISPLAY_BANNER_TOP, DISPLAY_BANNER_BOTTOM],
                    }),
                }),
            );

            // System value upserted with the resolved option ID and actions.
            expect(saveUpsertSpy).toHaveBeenCalledWith('linked_field1', 'lvl1', [DISPLAY_BANNER_TOP, DISPLAY_BANNER_BOTTOM]);
        });
        await act(async () => {}); // flush pending React state updates
    });

    test('should patch template and linked field when only levels change', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        const linked = makeLinkedField({attrs: {actions: []}});

        const patchedTemplate = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'MODIFIED', color: '#007A33', rank: 1}]},
        });
        const patchedLinked = makeLinkedField({attrs: {actions: []}});

        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]).
            mockResolvedValueOnce([linked]).
            mockResolvedValueOnce([makeChannelLinkedField()]); // channel-linked field already exists during save

        jest.spyOn(Client4, 'patchPropertyField').
            mockResolvedValueOnce(patchedTemplate).
            mockResolvedValueOnce(patchedLinked);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);
        await screen.findByText('Classification levels');

        const user = userEvent.setup();
        const nameInput = screen.getByRole('textbox', {name: /Classification level name/i});
        await user.clear(nameInput);
        await user.type(nameInput, 'MODIFIED');
        await user.tab();

        const saveButton = await screen.findByText('Save');
        await user.click(saveButton);

        await waitFor(() => {
            // Template field saved without global_banner.
            expect(Client4.patchPropertyField).toHaveBeenCalledWith(
                CLASSIFICATIONS_GROUP_NAME,
                CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE,
                'field1',
                expect.not.objectContaining({
                    attrs: expect.objectContaining({global_banner: expect.anything()}),
                }),
            );

            // Linked field patched with empty actions (banner disabled).
            expect(Client4.patchPropertyField).toHaveBeenCalledWith(
                CLASSIFICATIONS_GROUP_NAME,
                CLASSIFICATIONS_SYSTEM_OBJECT_TYPE,
                'linked_field1',
                expect.objectContaining({
                    attrs: expect.objectContaining({actions: []}),
                }),
            );
        });
        await act(async () => {});
    });

    test('should delete linked field before template when classification is disabled', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        const linked = makeLinkedField({attrs: {actions: []}});

        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]).
            mockResolvedValueOnce([linked]).
            mockResolvedValueOnce([]);

        const deleteOrder: string[] = [];
        const deleteFieldSpy = jest.spyOn(Client4, 'deletePropertyField');
        deleteFieldSpy.mockImplementation(async (_group, objectType, _id) => {
            deleteOrder.push(objectType === CLASSIFICATIONS_SYSTEM_OBJECT_TYPE ? `linked:${_id}` : `template:${_id}`);
            return {status: 'OK'};
        });

        // Suppress "not configured to support act" warnings triggered by the
        // large number of batched setState calls when classification is fully
        // disabled and the form resets.
        const origError = console.error;
        console.error = (...args: Parameters<typeof console.error>) => {
            if (typeof args[0] === 'string' && args[0].includes('not configured to support act')) {
                return;
            }
            origError(...args);
        };

        try {
            renderWithContext(<ClassificationMarkings/>, BASE_STATE);
            await screen.findByText('Global Classification Indicators');

            const user = userEvent.setup();

            await act(async () => {
                await user.click(screen.getByTestId('classificationEnabledfalse'));
            });

            await act(async () => {
                await user.click(screen.getByText('Save'));
            });

            await waitFor(() => {
                expect(deleteOrder).toHaveLength(2);
            });
            await act(async () => {});

            expect(deleteOrder[0]).toBe('linked:linked_field1');
            expect(deleteOrder[1]).toBe('template:field1');
        } finally {
            console.error = origError;
        }
    });
});

describe('Channel classification linked field branches', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should create channel-linked field when none exists during save', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        const linked = makeLinkedField({attrs: {actions: []}});
        const patchedTemplate = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'MODIFIED', color: '#007A33', rank: 1}]},
        });
        const patchedLinked = makeLinkedField({attrs: {actions: []}});
        const createdChannelField = makeChannelLinkedField();

        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]). // template field load
            mockResolvedValueOnce([linked]). // linked field load
            mockResolvedValueOnce([]); // channel-linked field lookup during save -> none

        jest.spyOn(Client4, 'patchPropertyField').
            mockResolvedValueOnce(patchedTemplate).
            mockResolvedValueOnce(patchedLinked);

        const createSpy = jest.spyOn(Client4, 'createPropertyField').
            mockResolvedValueOnce(createdChannelField);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);
        await screen.findByText('Classification levels');

        const user = userEvent.setup();
        const nameInput = screen.getByRole('textbox', {name: /Classification level name/i});
        await user.clear(nameInput);
        await user.type(nameInput, 'MODIFIED');
        await user.tab();

        await user.click(await screen.findByText('Save'));

        await waitFor(() => {
            expect(createSpy).toHaveBeenCalledWith(
                CLASSIFICATIONS_GROUP_NAME,
                CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
                expect.objectContaining({
                    name: CLASSIFICATIONS_CHANNEL_FIELD_NAME,
                    linked_field_id: 'field1',
                }),
            );
        });
        await act(async () => {});
    });

    test('should not create channel-linked field when one already exists during save', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        const linked = makeLinkedField({attrs: {actions: []}});
        const patchedTemplate = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'MODIFIED', color: '#007A33', rank: 1}]},
        });
        const patchedLinked = makeLinkedField({attrs: {actions: []}});
        const existingChannelField = makeChannelLinkedField();

        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]).
            mockResolvedValueOnce([linked]).
            mockResolvedValueOnce([existingChannelField]); // channel field exists

        jest.spyOn(Client4, 'patchPropertyField').
            mockResolvedValueOnce(patchedTemplate).
            mockResolvedValueOnce(patchedLinked);

        const createSpy = jest.spyOn(Client4, 'createPropertyField');

        const {store} = renderWithContext(<ClassificationMarkings/>, BASE_STATE);
        await screen.findByText('Classification levels');

        const user = userEvent.setup();
        const nameInput = screen.getByRole('textbox', {name: /Classification level name/i});
        await user.clear(nameInput);
        await user.type(nameInput, 'MODIFIED');
        await user.tab();

        await user.click(await screen.findByText('Save'));

        await waitFor(() => {
            expect(Client4.patchPropertyField).toHaveBeenCalled();
        });
        await act(async () => {});

        // Channel field must not be created since one already exists.
        expect(createSpy).not.toHaveBeenCalledWith(
            expect.anything(),
            CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
            expect.anything(),
        );

        // Existing channel field must be pushed into the store alongside the saved template
        // and linked field so consumers that read from Redux get it immediately.
        const fieldsById = store.getState().entities.properties.fields.byId;
        expect(fieldsById[existingChannelField.id]).toEqual(existingChannelField);
    });

    test('should delete channel-linked field before linked and template when disabling', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        const linked = makeLinkedField({attrs: {actions: []}});
        const channel = makeChannelLinkedField();

        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]). // template field load
            mockResolvedValueOnce([linked]). // linked field load
            mockResolvedValueOnce([channel]); // channel field lookup during disable

        const deleteOrder: string[] = [];
        jest.spyOn(Client4, 'deletePropertyField').mockImplementation(async (_group, objectType, id) => {
            if (objectType === CLASSIFICATIONS_CHANNEL_OBJECT_TYPE) {
                deleteOrder.push(`channel:${id}`);
            } else if (objectType === CLASSIFICATIONS_SYSTEM_OBJECT_TYPE) {
                deleteOrder.push(`linked:${id}`);
            } else {
                deleteOrder.push(`template:${id}`);
            }
            return {status: 'OK'};
        });

        // Suppress noisy "not configured to support act" warnings from the bulk state reset.
        const origError = console.error;
        console.error = (...args: Parameters<typeof console.error>) => {
            if (typeof args[0] === 'string' && args[0].includes('not configured to support act')) {
                return;
            }
            origError(...args);
        };

        try {
            renderWithContext(<ClassificationMarkings/>, BASE_STATE);
            await screen.findByText('Global Classification Indicators');

            const user = userEvent.setup();

            await act(async () => {
                await user.click(screen.getByTestId('classificationEnabledfalse'));
            });

            await act(async () => {
                await user.click(screen.getByText('Save'));
            });

            await waitFor(() => {
                expect(deleteOrder).toHaveLength(3);
            });
            await act(async () => {});

            expect(deleteOrder[0]).toBe(`channel:${channel.id}`);
            expect(deleteOrder[1]).toBe('linked:linked_field1');
            expect(deleteOrder[2]).toBe('template:field1');
        } finally {
            console.error = origError;
        }
    });

    test('should not attempt to delete channel-linked field when none exists', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        const linked = makeLinkedField({attrs: {actions: []}});

        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]).
            mockResolvedValueOnce([linked]).
            mockResolvedValueOnce([]); // no channel field exists

        const deletedTypes: string[] = [];
        jest.spyOn(Client4, 'deletePropertyField').mockImplementation(async (_group, objectType) => {
            deletedTypes.push(objectType);
            return {status: 'OK'};
        });

        const origError = console.error;
        console.error = (...args: Parameters<typeof console.error>) => {
            if (typeof args[0] === 'string' && args[0].includes('not configured to support act')) {
                return;
            }
            origError(...args);
        };

        try {
            renderWithContext(<ClassificationMarkings/>, BASE_STATE);
            await screen.findByText('Global Classification Indicators');

            const user = userEvent.setup();

            await act(async () => {
                await user.click(screen.getByTestId('classificationEnabledfalse'));
            });
            await act(async () => {
                await user.click(screen.getByText('Save'));
            });

            await waitFor(() => {
                expect(deletedTypes).toEqual([CLASSIFICATIONS_SYSTEM_OBJECT_TYPE, CLASSIFICATIONS_TEMPLATE_OBJECT_TYPE]);
            });
        } finally {
            console.error = origError;
        }
    });
});

describe('Custom preset caching and dropdown visibility', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should restore cached custom levels when switching back to Custom', async () => {
        const field = makePropertyField({
            attrs: {
                options: [
                    {id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
                    {id: 'lvl2', name: 'SECRET', color: '#C8102E', rank: 2},
                ],
            },
        });
        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]).
            mockResolvedValueOnce([]); // linked field

        const origError = console.error;
        console.error = (...args: Parameters<typeof console.error>) => {
            if (typeof args[0] === 'string' && args[0].includes('not configured to support act')) {
                return;
            }
            origError(...args);
        };

        try {
            renderWithContext(<ClassificationMarkings/>, BASE_STATE);
            await screen.findByText('Classification levels');

            const user = userEvent.setup();

            // Edit the first level to make it custom
            const nameInputs = screen.getAllByRole('textbox', {name: /Classification level name/i});
            await user.clear(nameInputs[0]);
            await user.type(nameInputs[0], 'MY_CUSTOM_LEVEL');
            await user.tab();

            // Now the preset is Custom (shown as selected value)
            expect(screen.getByText('Custom classification levels')).toBeInTheDocument();

            // Open dropdown and switch to UK preset
            await act(async () => {
                await user.click(screen.getByText('Custom classification levels'));
            });
            await act(async () => {
                await user.click(screen.getByText('UK (GSCP)'));
            });

            // Confirm the preset switch in the modal
            await act(async () => {
                await user.click(screen.getByText('Change preset'));
            });

            // Wait for the modal to close
            await waitFor(() => {
                expect(screen.queryByText('Change classification preset?')).not.toBeInTheDocument();
            });

            // Now on UK preset — verify UK levels are shown
            expect(screen.getByDisplayValue('OFFICIAL')).toBeInTheDocument();

            // Switch back to Custom from dropdown
            await act(async () => {
                await user.click(screen.getByText('UK (GSCP)'));
            });
            await act(async () => {
                await user.click(screen.getByText('Custom classification levels'));
            });

            // The cached custom levels should be restored
            expect(screen.getByDisplayValue('MY_CUSTOM_LEVEL')).toBeInTheDocument();
            expect(screen.getByDisplayValue('SECRET')).toBeInTheDocument();
        } finally {
            console.error = origError;
        }
    });

    test('should show Custom option in dropdown after caching custom edits', async () => {
        const field = makePropertyField({
            attrs: {
                options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}],
            },
        });
        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]).
            mockResolvedValueOnce([]); // linked field

        const origError = console.error;
        console.error = (...args: Parameters<typeof console.error>) => {
            if (typeof args[0] === 'string' && args[0].includes('not configured to support act')) {
                return;
            }
            origError(...args);
        };

        try {
            renderWithContext(<ClassificationMarkings/>, BASE_STATE);
            await screen.findByText('Classification levels');

            const user = userEvent.setup();

            // Edit a level to enter custom mode
            const nameInputs = screen.getAllByRole('textbox', {name: /Classification level name/i});
            await user.clear(nameInputs[0]);
            await user.type(nameInputs[0], 'EDITED');
            await user.tab();

            // Open dropdown and switch to US (caches custom levels)
            await act(async () => {
                await user.click(screen.getByText('Custom classification levels'));
            });
            await act(async () => {
                await user.click(screen.getByText('United States'));
            });

            // Confirm the preset switch
            await act(async () => {
                await user.click(screen.getByText('Change preset'));
            });

            // Wait for modal to close
            await waitFor(() => {
                expect(screen.queryByText('Change classification preset?')).not.toBeInTheDocument();
            });

            // Now on US — "Custom classification levels" should remain visible as
            // an option (rendered by react-select as the last non-selected option
            // or still in the DOM). Since it's not the selected value, check after
            // opening the dropdown menu.
            expect(screen.getByText('United States')).toBeInTheDocument();

            // The Custom option should still be available (rendered in the dropdown
            // options list since cachedCustomLevels.length > 0)
            await act(async () => {
                await user.click(screen.getByText('United States'));
            });
            expect(screen.getByText('Custom classification levels')).toBeInTheDocument();
        } finally {
            console.error = origError;
        }
    });

    test('should treat PRESET_EMPTY selection as a no-op', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>, BASE_STATE);
        await screen.findByText('True');

        const user = userEvent.setup();

        // Enable classification
        await act(async () => {
            await user.click(screen.getByRole('radio', {name: /True/i}));
        });

        // The placeholder "Select a preset…" should be the selected value
        expect(screen.getByText('Select a preset…')).toBeInTheDocument();

        // No levels should be rendered
        expect(screen.queryAllByRole('textbox', {name: /Classification level name/i})).toHaveLength(0);

        // No confirmation dialog should be shown
        expect(screen.queryByText('Change classification preset?')).not.toBeInTheDocument();
    });

    test('should remap banner level_id from pending ID to server-assigned ID by rank after save', async () => {
        // Start with an existing field and banner enabled so the global
        // classification indicators section is visible with a level selected.
        const field = makePropertyField({
            attrs: {
                options: [{id: 'lvl1', name: 'EXISTING', color: '#007A33', rank: 1}],
            },
        });
        const linked = makeLinkedField({
            attrs: {actions: [DISPLAY_BANNER_TOP]},
        });
        const sysValue = makeSystemValue('linked_field1', 'lvl1');

        jest.spyOn(Client4, 'getPropertyFields').
            mockResolvedValueOnce([field]).
            mockResolvedValueOnce([linked]);
        jest.spyOn(Client4, 'getSystemPropertyValues').
            mockResolvedValueOnce([sysValue]);

        const origError = console.error;
        console.error = (...args: Parameters<typeof console.error>) => {
            if (typeof args[0] === 'string' && args[0].includes('not configured to support act')) {
                return;
            }
            origError(...args);
        };

        try {
            renderWithContext(<ClassificationMarkings/>, BASE_STATE);
            await screen.findByText('Classification levels');

            const user = userEvent.setup();

            // Delete the existing level and add a new one (gets a pending_ ID)
            const deleteButtons = screen.getAllByRole('button', {name: /Delete level/i});
            await act(async () => {
                await user.click(deleteButtons[0]);
            });

            await act(async () => {
                await user.click(screen.getByText('Add level'));
            });

            const nameInput = screen.getByRole('textbox', {name: /Classification level name/i});
            await user.type(nameInput, 'NEW_LEVEL');
            await user.tab();

            // Select the new level for the global banner using the level dropdown.
            const levelDropdownWrapper = screen.getByTestId('globalBannerLevel');
            const levelControl = levelDropdownWrapper.querySelector('.DropDown__control')!;
            await act(async () => {
                await user.click(levelControl);
            });
            await act(async () => {
                await user.click(screen.getByText('NEW_LEVEL'));
            });

            // Set up mocks for the save — server returns the template with a new ID
            const serverGeneratedId = 'server_generated_new_id';
            const patchedTemplate = makePropertyField({
                attrs: {
                    options: [{id: serverGeneratedId, name: 'NEW_LEVEL', color: '#000000', rank: 1}],
                },
            });
            const patchedLinked = makeLinkedField({attrs: {actions: []}});

            jest.spyOn(Client4, 'patchPropertyField').
                mockResolvedValueOnce(patchedTemplate). // patch template
                mockResolvedValueOnce(patchedLinked); // patch linked (disable banner first)

            jest.spyOn(Client4, 'getPropertyFields').
                mockResolvedValueOnce([makeChannelLinkedField()]); // channel field exists

            const saveUpsertSpy = jest.spyOn(Utils, 'saveUpsertSystemValue').mockResolvedValue([]);

            // The final patch linked (enable banner) needs a mock too
            jest.spyOn(Client4, 'patchPropertyField').
                mockResolvedValueOnce(patchedLinked);

            // Save
            await act(async () => {
                await user.click(screen.getByText('Save'));
            });

            await waitFor(() => {
                // The upsert should use the server-generated ID, NOT the pending_ ID
                expect(saveUpsertSpy).toHaveBeenCalledWith(
                    'linked_field1',
                    serverGeneratedId,
                    expect.any(Array),
                );
            });
            await act(async () => {});
        } finally {
            console.error = origError;
        }
    });
});
