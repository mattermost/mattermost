// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {act, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ClassificationMarkings from './classification_markings';
import {
    detectPreset,
    optionsToLevels,
    levelsToOptions,
    processClassificationField,
    fetchClassificationField,
    GROUP_NAME,
    OBJECT_TYPE,
    TARGET_TYPE,
    FIELD_NAME,
} from './utils';
import type {ClassificationLevel} from './utils/presets';
import {PRESET_CUSTOM, presets} from './utils/presets';

jest.mock('mattermost-redux/client');

// Helper to build a minimal PropertyField for testing
function makePropertyField(overrides: Partial<PropertyField> = {}): PropertyField {
    return {
        id: 'field1',
        group_id: GROUP_NAME,
        name: FIELD_NAME,
        type: 'select',
        attrs: {options: []},
        target_id: '',
        target_type: TARGET_TYPE,
        object_type: OBJECT_TYPE,
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        created_by: 'user1',
        updated_by: 'user1',
        ...overrides,
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

        // Should be sorted by rank ascending
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

        // Verify cursor params were passed for second call
        const secondCallArgs = (Client4.getPropertyFields as jest.Mock).mock.calls[1];
        expect(secondCallArgs[4]).toEqual({cursorId: 'p2', cursorCreateAt: 200});
    });

    test('should return undefined when no pages contain the field', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        const result = await fetchClassificationField();
        expect(result).toBeUndefined();
    });

    test('should stop after 500 items to avoid infinite loop', async () => {
        // Create pages of 100 items each, none matching
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

        // Should have fetched 5 pages (500 items) then stopped
        expect(Client4.getPropertyFields).toHaveBeenCalledTimes(5);
    });
});

describe('ClassificationMarkings component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should show loading screen initially', () => {
        // Never resolve the fetch to keep loading state
        jest.spyOn(Client4, 'getPropertyFields').mockReturnValue(new Promise(() => {}));

        const {container} = renderWithContext(<ClassificationMarkings/>);

        expect(screen.getByText('Classification Markings')).toBeInTheDocument();
        expect(container.querySelector('.loading-screen')).toBeInTheDocument();
    });

    test('should show error when load fails', async () => {
        const error = new Error('Network error');
        (error as unknown as Record<string, number>).status_code = 500;
        jest.spyOn(Client4, 'getPropertyFields').mockRejectedValueOnce(error);

        renderWithContext(<ClassificationMarkings/>);

        await screen.findByText(/Failed to load classification markings/);
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    test('should show informational notice when loaded', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>);

        await screen.findByText('True');

        expect(screen.getByRole('heading', {name: 'Classification markings are informational only'})).toBeInTheDocument();
        expect(
            screen.getByText('Markings are not tied to access control decisions at this time and are for display purposes only.'),
        ).toBeInTheDocument();
    });

    test('should render disabled state when no existing field', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>);

        // Wait for loading to finish
        await screen.findByText('True');

        // Classification should default to disabled (False radio checked)
        const falseRadio = screen.getByRole('radio', {name: /False/i}) as HTMLInputElement;
        expect(falseRadio.checked).toBe(true);

        // Preset and levels sections should not be visible when disabled
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
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([field]);

        renderWithContext(<ClassificationMarkings/>);

        // Wait for loading to finish and levels to render
        await screen.findByText('Classification preset');

        const trueRadio = screen.getByRole('radio', {name: /True/i}) as HTMLInputElement;
        expect(trueRadio.checked).toBe(true);

        // Should show classification levels
        expect(screen.getByText('Classification levels')).toBeInTheDocument();
    });

    test('should show preset and levels sections when enabled', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>);

        await screen.findByText('True');

        // Enable classification markings
        const user = userEvent.setup();
        const trueRadio = screen.getByRole('radio', {name: /True/i});
        await act(async () => {
            await user.click(trueRadio);
        });

        // Preset and levels sections should appear
        expect(screen.getByText('Classification preset')).toBeInTheDocument();
        expect(screen.getByText('Classification levels')).toBeInTheDocument();
    });

    test('should detect hasChanges when toggling enabled', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>);

        await screen.findByText('True');

        // Initially no save button should be active
        const user = userEvent.setup();

        // Enable classification
        const trueRadio = screen.getByRole('radio', {name: /True/i});
        await act(async () => {
            await user.click(trueRadio);
        });

        // Save button should now appear since there are changes
        expect(screen.getByText('Save')).toBeInTheDocument();
    });

    test('should validate empty levels when saving while enabled', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>);

        await screen.findByText('True');

        const user = userEvent.setup();

        // Enable classification
        await act(async () => {
            await user.click(screen.getByRole('radio', {name: /True/i}));
        });

        // Try to save with no levels
        await act(async () => {
            await user.click(screen.getByText('Save'));
        });

        // Should show validation error
        await screen.findByText(/At least one classification level is required/);
    });

    test('should handle 404 error as no field found', async () => {
        const error = new Error('Not found');
        (error as unknown as Record<string, number>).status_code = 404;
        jest.spyOn(Client4, 'getPropertyFields').mockRejectedValueOnce(error);

        renderWithContext(<ClassificationMarkings/>);

        // Should load successfully (not show error) since 404 means no field
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
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([field]);

        renderWithContext(<ClassificationMarkings/>);
        await screen.findByText('Classification levels');

        const user = userEvent.setup();
        const colorInput = screen.getByTestId('color-inputColorValue');

        await act(async () => {
            await user.clear(colorInput);
            await user.type(colorInput, '#1a2b3c');
        });

        // Input should show exactly what was typed, not auto-expanded from 3-char hex
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
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([field]);
        jest.spyOn(Client4, 'patchPropertyField').mockResolvedValueOnce(makePropertyField({
            attrs: {
                options: [
                    {id: 'lvl1', name: 'SECRET', color: '#1a2b3c', rank: 1},
                ],
            },
        }));

        renderWithContext(<ClassificationMarkings/>);
        await screen.findByText('Classification levels');

        const user = userEvent.setup();
        const colorInput = screen.getByTestId('color-inputColorValue');

        // Type a new color then tab away to blur
        await user.clear(colorInput);
        await user.type(colorInput, '#1a2b3c');
        await user.tab();

        // Save should be available (changes detected after blur)
        const saveButton = await screen.findByText('Save');
        await user.click(saveButton);

        // The patch call should include the typed color
        expect(Client4.patchPropertyField).toHaveBeenCalledWith(
            GROUP_NAME,
            OBJECT_TYPE,
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

    test('should pass disabled prop to disable controls', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings disabled={true}/>);

        await screen.findByText('True');

        // Radio buttons should be disabled
        const trueRadio = screen.getByRole('radio', {name: /True/i}) as HTMLInputElement;
        expect(trueRadio.disabled).toBe(true);
    });
});
