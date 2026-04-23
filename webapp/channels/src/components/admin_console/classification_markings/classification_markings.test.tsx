// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AdminConfig} from '@mattermost/types/config';
import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';
import type {DeepPartial} from '@mattermost/types/utilities';

import * as adminActions from 'mattermost-redux/actions/admin';
import {Client4} from 'mattermost-redux/client';

import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

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

function makeInitialStateWithBanner(banner?: {Enabled?: boolean; Placement?: string; LevelName?: string; Color?: string}): DeepPartial<GlobalState> {
    return {
        entities: {
            admin: {
                config: {
                    ClassificationMarkingsSettings: {
                        GlobalBanner: {
                            Enabled: banner?.Enabled ?? false,
                            Placement: banner?.Placement ?? 'top',
                            LevelName: banner?.LevelName ?? '',
                            Color: banner?.Color ?? '',
                        },
                    },
                } as DeepPartial<AdminConfig>,
            },
        },
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

describe('ClassificationMarkings component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should show loading screen initially', () => {
        jest.spyOn(Client4, 'getPropertyFields').mockReturnValue(new Promise(() => {}));

        const {container} = renderWithContext(<ClassificationMarkings/>, makeInitialStateWithBanner());

        expect(screen.getByText('Classification Markings')).toBeInTheDocument();
        expect(container.querySelector('.loading-screen')).toBeInTheDocument();
    });

    test('should show error when load fails', async () => {
        const error = new Error('Network error');
        (error as unknown as Record<string, number>).status_code = 500;
        jest.spyOn(Client4, 'getPropertyFields').mockRejectedValueOnce(error);

        renderWithContext(<ClassificationMarkings/>, makeInitialStateWithBanner());

        await screen.findByText(/Failed to load classification markings/);
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });

    test('should show informational notice when loaded', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>, makeInitialStateWithBanner());

        await screen.findByText('True');

        expect(screen.getByRole('heading', {name: 'Classification markings are informational only'})).toBeInTheDocument();
        expect(
            screen.getByText('Markings are not tied to access control decisions at this time and are for display purposes only.'),
        ).toBeInTheDocument();
    });

    test('should render disabled state when no existing field', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>, makeInitialStateWithBanner());

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
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([field]);

        renderWithContext(<ClassificationMarkings/>, makeInitialStateWithBanner());

        await screen.findByText('Classification preset');

        const classificationTrueRadio = screen.getByTestId('classificationEnabledtrue') as HTMLInputElement;
        expect(classificationTrueRadio.checked).toBe(true);

        expect(screen.getByText('Classification levels')).toBeInTheDocument();
    });

    test('should show preset and levels sections when enabled', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>, makeInitialStateWithBanner());

        await screen.findByText('True');

        const user = userEvent.setup();
        const trueRadio = screen.getByRole('radio', {name: /True/i});
        await act(async () => {
            await user.click(trueRadio);
        });

        expect(screen.getByText('Classification preset')).toBeInTheDocument();
        expect(screen.getByText('Classification levels')).toBeInTheDocument();
    });

    test('should detect hasChanges when toggling enabled', async () => {
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([]);

        renderWithContext(<ClassificationMarkings/>, makeInitialStateWithBanner());

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

        renderWithContext(<ClassificationMarkings/>, makeInitialStateWithBanner());

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

        renderWithContext(<ClassificationMarkings/>, makeInitialStateWithBanner());

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

        renderWithContext(<ClassificationMarkings/>, makeInitialStateWithBanner());
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
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([field]);
        jest.spyOn(Client4, 'patchPropertyField').mockResolvedValueOnce(makePropertyField({
            attrs: {
                options: [
                    {id: 'lvl1', name: 'SECRET', color: '#1a2b3c', rank: 1},
                ],
            },
        }));

        renderWithContext(<ClassificationMarkings/>, makeInitialStateWithBanner());
        await screen.findByText('Classification levels');

        const user = userEvent.setup();
        const colorInput = screen.getByTestId('color-inputColorValue');

        await user.clear(colorInput);
        await user.type(colorInput, '#1a2b3c');
        await user.tab();

        const saveButton = await screen.findByText('Save');
        await user.click(saveButton);

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

        renderWithContext(<ClassificationMarkings disabled={true}/>, makeInitialStateWithBanner());

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

        renderWithContext(<ClassificationMarkings/>, makeInitialStateWithBanner());
        await screen.findByText('True');

        expect(screen.queryByText('Global Classification Indicators')).not.toBeInTheDocument();
    });

    test('should show Global Classification Indicators when classification is enabled', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([field]);

        renderWithContext(<ClassificationMarkings/>, makeInitialStateWithBanner());
        await screen.findByText('Global Classification Indicators');

        expect(screen.getByText('Configure the global classification banner')).toBeInTheDocument();
        expect(screen.getByText('Global Classification Banner')).toBeInTheDocument();
    });

    test('should read initial banner state from Redux admin config', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([field]);

        renderWithContext(
            <ClassificationMarkings/>,
            makeInitialStateWithBanner({Enabled: true, Placement: 'top_and_bottom', LevelName: 'UNCLASSIFIED'}),
        );
        await screen.findByText('Banner visibility');

        // The "top_and_bottom" radio (False side of the placement boolean) should be selected
        expect(screen.getByTestId('globalBannerPlacementtrue')).not.toBeChecked();
        expect(screen.getByTestId('globalBannerPlacementfalse')).toBeChecked();

        expect(screen.getByText('UNCLASSIFIED')).toBeInTheDocument();
    });

    test('should show placement and level controls when global banner is enabled', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([field]);

        renderWithContext(
            <ClassificationMarkings/>,
            makeInitialStateWithBanner({Enabled: true, Placement: 'top', LevelName: 'UNCLASSIFIED'}),
        );
        await screen.findByText('Banner visibility');

        expect(screen.getByText('Top only')).toBeInTheDocument();
        expect(screen.getByText('Top and bottom')).toBeInTheDocument();
        expect(screen.getByText('Global classification level')).toBeInTheDocument();
    });

    test('should validate that a level is selected when global banner is enabled', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([field]);

        renderWithContext(<ClassificationMarkings/>, makeInitialStateWithBanner());
        await screen.findByText('Global Classification Indicators');

        const user = userEvent.setup();

        // Enable the global banner (use the testId to target the banner toggle specifically)
        await act(async () => {
            await user.click(screen.getByTestId('globalBannerEnabledtrue'));
        });

        await act(async () => {
            await user.click(screen.getByText('Save'));
        });

        await screen.findByText(/A global classification level must be selected/);
    });

    test('should validate that the referenced level still exists when enabled via Redux config', async () => {
        // Level "GONE" doesn't exist in the field's options.
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([field]);

        renderWithContext(
            <ClassificationMarkings/>,
            makeInitialStateWithBanner({Enabled: true, Placement: 'top', LevelName: 'GONE'}),
        );
        await screen.findByText('Global Classification Indicators');

        const user = userEvent.setup();

        // Flip placement to create a real change so Save becomes active.
        await act(async () => {
            await user.click(screen.getByTestId('globalBannerPlacementfalse'));
        });

        await act(async () => {
            await user.click(screen.getByText('Save'));
        });

        await screen.findByText(/The global classification banner is configured with a level that no longer exists/);
    });

    test('should surface validation when renaming the level used by the banner', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([field]);

        renderWithContext(
            <ClassificationMarkings/>,
            makeInitialStateWithBanner({Enabled: true, Placement: 'top', LevelName: 'UNCLASSIFIED'}),
        );
        await screen.findByText('Classification levels');

        const user = userEvent.setup();

        // Rename the only level: the banner's level_name no longer matches anything.
        const nameInput = screen.getByRole('textbox', {name: /Classification level name/i});
        await user.clear(nameInput);
        await user.type(nameInput, 'DECLASSIFIED');
        await user.tab();

        // Inline error should appear in the banner section immediately.
        expect(
            await screen.findByText(/The previously selected level no longer exists/),
        ).toBeInTheDocument();

        // And save should also be blocked with the same validation error.
        await act(async () => {
            await user.click(screen.getByText('Save'));
        });
        await screen.findByText(/The global classification banner is configured with a level that no longer exists/);
    });

    test('should surface validation when deleting the level used by the banner', async () => {
        const field = makePropertyField({
            attrs: {
                options: [
                    {id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
                    {id: 'lvl2', name: 'CONFIDENTIAL', color: '#FFD700', rank: 2},
                ],
            },
        });
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([field]);

        renderWithContext(
            <ClassificationMarkings/>,
            makeInitialStateWithBanner({Enabled: true, Placement: 'top', LevelName: 'UNCLASSIFIED'}),
        );
        await screen.findByText('Classification levels');

        const user = userEvent.setup();

        // Delete lvl1 (first row's delete button).
        const deleteButtons = screen.getAllByRole('button', {name: /Delete level/i});
        await act(async () => {
            await user.click(deleteButtons[0]);
        });

        await act(async () => {
            await user.click(screen.getByText('Save'));
        });

        await screen.findByText(/The global classification banner is configured with a level that no longer exists/);
    });

    test('should save levels and patchConfig when the banner changes', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([field]);
        const mockPatch = jest.spyOn(Client4, 'patchPropertyField').mockResolvedValueOnce(
            makePropertyField({
                attrs: {
                    options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#112233', rank: 1}],
                },
            }),
        );
        const mockPatchConfigAction = jest.spyOn(adminActions, 'patchConfig').
            mockImplementation((patch) => ({
                type: 'MOCK_PATCH_CONFIG',
                payload: patch,
            } as unknown as ReturnType<typeof adminActions.patchConfig>));

        renderWithContext(
            <ClassificationMarkings/>,
            makeInitialStateWithBanner({Enabled: true, Placement: 'top', LevelName: 'UNCLASSIFIED'}),
        );
        await screen.findByText('Classification levels');

        const user = userEvent.setup();

        // Change the color to produce a PSA-side change without renaming (which would invalidate the banner).
        const colorInput = screen.getByTestId('color-inputColorValue');
        await user.clear(colorInput);
        await user.type(colorInput, '#112233');
        await user.tab();

        await user.click(screen.getByTestId('globalBannerPlacementfalse'));

        const saveButton = await screen.findByText('Save');
        await user.click(saveButton);

        await waitFor(() => {
            expect(mockPatchConfigAction).toHaveBeenCalled();
        });

        // PSA patch must NOT include any global_banner entry in attrs.
        expect(mockPatch).toHaveBeenCalledWith(
            'custom_profile_attributes',
            OBJECT_TYPE,
            'field1',
            expect.objectContaining({
                attrs: expect.objectContaining({options: expect.any(Array)}),
            }),
        );
        const patchCall = mockPatch.mock.calls[0][3] as {attrs?: Record<string, unknown>};
        expect(patchCall.attrs).not.toHaveProperty('global_banner');

        expect(mockPatchConfigAction).toHaveBeenCalledWith(expect.objectContaining({
            ClassificationMarkingsSettings: expect.objectContaining({
                GlobalBanner: expect.objectContaining({
                    Enabled: true,
                    Placement: 'top_and_bottom',
                    LevelName: 'UNCLASSIFIED',
                    Color: '#112233',
                }),
            }),
        }));
    });

    test('should not dispatch patchConfig when the banner state is unchanged', async () => {
        const field = makePropertyField({
            attrs: {options: [{id: 'lvl1', name: 'UNCLASSIFIED', color: '#007A33', rank: 1}]},
        });
        jest.spyOn(Client4, 'getPropertyFields').mockResolvedValueOnce([field]);
        jest.spyOn(Client4, 'patchPropertyField').mockResolvedValueOnce(
            makePropertyField({
                attrs: {options: [{id: 'lvl1', name: 'MODIFIED', color: '#007A33', rank: 1}]},
            }),
        );
        const mockPatchConfigAction = jest.spyOn(adminActions, 'patchConfig');

        renderWithContext(<ClassificationMarkings/>, makeInitialStateWithBanner());
        await screen.findByText('Classification levels');

        const user = userEvent.setup();
        const nameInput = screen.getByRole('textbox', {name: /Classification level name/i});
        await user.clear(nameInput);
        await user.type(nameInput, 'MODIFIED');
        await user.tab();

        const saveButton = await screen.findByText('Save');
        await user.click(saveButton);

        await waitFor(() => {
            expect(Client4.patchPropertyField).toHaveBeenCalled();
        });

        expect(mockPatchConfigAction).not.toHaveBeenCalled();
    });
});
