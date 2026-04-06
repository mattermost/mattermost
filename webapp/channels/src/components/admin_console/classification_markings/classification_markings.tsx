// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, useReactTable} from '@tanstack/react-table';
import type {ColumnDef} from '@tanstack/react-table';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import styled from 'styled-components';

import type {ClientError} from '@mattermost/client';
import {PlusIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {setNavigationBlocked} from 'actions/admin_actions';

import ColorInput from 'components/color_input';
import ConfirmModal from 'components/confirm_modal';
import LoadingScreen from 'components/loading_screen';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import type {ClassificationLevel} from './presets';
import {PRESET_CUSTOM, presets} from './presets';

import {AdminConsoleListTable} from '../list_table';
import SaveChangesPanel from '../save_changes_panel';
import {AdminSection, AdminWrapper, SectionContent, SectionHeader, SectionHeading, BorderlessInput, LinkButton} from '../system_properties/controls';

const GROUP_NAME = 'custom_profile_attributes';
const OBJECT_TYPE = 'user';
const TARGET_TYPE = 'system';
const TARGET_ID = '';
const FIELD_NAME = 'classification';

type LevelRow = ClassificationLevel;

const msg = defineMessages({
    pageTitle: {id: 'admin.sidebar.classificationMarkings', defaultMessage: 'Classification Markings'},
    enableTitle: {id: 'admin.classification_markings.enable.title', defaultMessage: 'Enable classification markings'},
    enableDescription: {id: 'admin.classification_markings.enable.description', defaultMessage: 'Use this to enable classification markings as banners at the system and channel level. You can pre-select text and colors for your banner, as well as set a default option for consistency.'},
    presetTitle: {id: 'admin.classification_markings.preset.title', defaultMessage: 'Classification preset'},
    presetDescription: {id: 'admin.classification_markings.preset.description', defaultMessage: 'Select a classification preset from the dropdown menu based on your country affiliation. This will help tailor the options to your specific needs. You can also create set custom classification levels.'},
    levelsTitle: {id: 'admin.classification_markings.levels.title', defaultMessage: 'Classification levels'},
    levelsDescription: {id: 'admin.classification_markings.levels.description', defaultMessage: 'Select colors and text for different classification levels that will be used in classification banners'},
});

type Props = {
    disabled?: boolean;
};

export default function ClassificationMarkings({disabled}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    // Remote state
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string>();
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string>();
    const [existingField, setExistingField] = useState<PropertyField | null>(null);

    // Local editable state
    const [enabled, setEnabled] = useState(false);
    const [presetId, setPresetId] = useState<string>(PRESET_CUSTOM);
    const [levels, setLevels] = useState<ClassificationLevel[]>([]);

    // Track if there are unsaved changes
    const [initialEnabled, setInitialEnabled] = useState(false);
    const [initialLevels, setInitialLevels] = useState<ClassificationLevel[]>([]);
    const [initialPresetId, setInitialPresetId] = useState<string>(PRESET_CUSTOM);

    // Confirm modal for preset switch
    const [confirmPresetSwitch, setConfirmPresetSwitch] = useState<string | null>(null);
    const [hasAcknowledgedPresetWarning, setHasAcknowledgedPresetWarning] = useState(false);

    const hasChanges = useMemo(() => {
        if (enabled !== initialEnabled) {
            return true;
        }
        if (!enabled) {
            return false;
        }
        if (levels.length !== initialLevels.length) {
            return true;
        }
        return levels.some((level, i) => {
            const initial = initialLevels[i];
            return level.name !== initial.name || level.color !== initial.color || level.id !== initial.id || level.rank !== initial.rank;
        });
    }, [enabled, initialEnabled, levels, initialLevels]);

    useEffect(() => {
        dispatch(setNavigationBlocked(hasChanges));
    }, [hasChanges, dispatch]);

    // Load existing field on mount, paginating through all results
    useEffect(() => {
        const loadField = async () => {
            try {
                const maxItems = 500;
                let fetched = 0;
                let classificationField: PropertyField | undefined;
                let cursorId: string | undefined;
                let cursorCreateAt: number | undefined;

                // Paginate through property fields until we find the classification field or exhaust all pages
                while (fetched < maxItems) {
                    const fields = await Client4.getPropertyFields(GROUP_NAME, OBJECT_TYPE, TARGET_TYPE, TARGET_ID, {cursorId, cursorCreateAt}); // eslint-disable-line no-await-in-loop
                    classificationField = fields.find((f: PropertyField) => f.name === FIELD_NAME && f.delete_at === 0);
                    if (classificationField || fields.length === 0) {
                        break;
                    }

                    fetched += fields.length;

                    // Set cursor from the last item for the next page
                    const last = fields[fields.length - 1];
                    cursorId = last.id;
                    cursorCreateAt = last.create_at;
                }

                if (classificationField) {
                    setExistingField(classificationField);
                    setEnabled(true);
                    setInitialEnabled(true);

                    const options = (classificationField.attrs?.options as PropertyFieldOption[]) || [];
                    const loadedLevels = options.map((opt, i) => ({
                        id: opt.id,
                        name: opt.name,
                        color: opt.color || '#000000',
                        rank: opt.rank ?? (i + 1),
                    }));
                    setLevels(loadedLevels);
                    setInitialLevels(loadedLevels);

                    // Detect which preset matches
                    const matchingPreset = detectPreset(loadedLevels);
                    setPresetId(matchingPreset);
                    setInitialPresetId(matchingPreset);
                }
            } catch (err: unknown) {
                const isNotFound = (err as ClientError).status_code === 404;
                if (!isNotFound) {
                    const message = err instanceof Error ? err.message : 'Failed to load classification markings';
                    setLoadError(message);
                }
            } finally {
                setLoading(false);
            }
        };

        loadField();
    }, []);

    const handleToggleEnabled = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setEnabled(e.target.value === 'true');
    }, []);

    const applyPreset = useCallback((newPresetId: string) => {
        const preset = presets.find((p) => p.id === newPresetId);
        if (preset) {
            setPresetId(newPresetId);
            setLevels(preset.levels.map((l) => ({...l})));
        }
    }, []);

    const handlePresetChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        const newPresetId = e.target.value;

        if (newPresetId === PRESET_CUSTOM) {
            setPresetId(PRESET_CUSTOM);
            return;
        }

        // Warn once when switching presets on an existing field
        if (existingField && !hasAcknowledgedPresetWarning) {
            setConfirmPresetSwitch(newPresetId);
            return;
        }

        applyPreset(newPresetId);
    }, [existingField, hasAcknowledgedPresetWarning, applyPreset]);

    const handleConfirmPresetSwitch = useCallback(() => {
        if (confirmPresetSwitch) {
            setHasAcknowledgedPresetWarning(true);
            applyPreset(confirmPresetSwitch);
        }
        setConfirmPresetSwitch(null);
    }, [confirmPresetSwitch, applyPreset]);

    const handleCancelPresetSwitch = useCallback(() => {
        setConfirmPresetSwitch(null);
    }, []);

    const switchToCustom = useCallback(() => {
        if (presetId !== PRESET_CUSTOM) {
            setPresetId(PRESET_CUSTOM);
        }
    }, [presetId]);

    const updateLevel = useCallback((index: number, updates: Partial<ClassificationLevel>) => {
        setLevels((prev) => prev.map((level, i) => (i === index ? {...level, ...updates} : level)));
        switchToCustom();
    }, [switchToCustom]);

    const deleteLevel = useCallback((index: number) => {
        setLevels((prev) => prev.filter((_, i) => i !== index).map((level, i) => ({...level, rank: i + 1})));
        switchToCustom();
    }, [switchToCustom]);

    const addLevel = useCallback(() => {
        setLevels((prev) => {
            const maxRank = prev.reduce((max, l) => Math.max(max, l.rank), 0);
            return [...prev, {id: '', name: '', color: '#000000', rank: maxRank + 1}];
        });
        switchToCustom();
    }, [switchToCustom]);

    const handleReorder = useCallback((prevIndex: number, nextIndex: number) => {
        setLevels((prev) => {
            const next = [...prev];
            const [moved] = next.splice(prevIndex, 1);
            next.splice(nextIndex, 0, moved);
            return next.map((level, i) => ({...level, rank: i + 1}));
        });
        switchToCustom();
    }, [switchToCustom]);

    const validate = useCallback((): string | null => {
        if (!enabled) {
            return null;
        }
        if (levels.length === 0) {
            return formatMessage({id: 'admin.classification_markings.error.no_levels', defaultMessage: 'At least one classification level is required when classification markings are enabled.'});
        }
        const emptyName = levels.find((l) => l.name.trim() === '');
        if (emptyName) {
            return formatMessage({id: 'admin.classification_markings.error.empty_name', defaultMessage: 'All classification levels must have a name.'});
        }
        const names = levels.map((l) => l.name.trim().toLowerCase());
        const duplicateName = names.find((name, i) => names.indexOf(name) !== i);
        if (duplicateName) {
            return formatMessage({id: 'admin.classification_markings.error.duplicate_name', defaultMessage: 'Classification level names must be unique. Duplicate: {name}'}, {name: duplicateName.toUpperCase()});
        }
        return null;
    }, [enabled, levels, formatMessage]);

    const handleSave = useCallback(async () => {
        setSaveError(undefined);

        const validationError = validate();
        if (validationError) {
            setSaveError(validationError);
            return;
        }

        setSaving(true);

        try {
            if (enabled && !initialEnabled) {
                // Create new field
                const options = levels.map((level) => ({
                    id: level.id || '',
                    name: level.name,
                    color: level.color,
                    rank: level.rank,
                }));
                const created = await Client4.createPropertyField(GROUP_NAME, OBJECT_TYPE, {
                    name: FIELD_NAME,
                    type: 'select' as PropertyField['type'],
                    target_type: TARGET_TYPE,
                    target_id: TARGET_ID,
                    attrs: {options, managed: 'admin'},
                    permission_field: 'sysadmin',
                    permission_values: 'sysadmin',
                    permission_options: 'sysadmin',
                });
                setExistingField(created);
                const createdOptions = (created.attrs?.options as PropertyFieldOption[]) || [];
                const newLevels = createdOptions.map((opt, i) => ({
                    id: opt.id,
                    name: opt.name,
                    color: opt.color || '#000000',
                    rank: opt.rank ?? (i + 1),
                }));
                setLevels(newLevels);
                setInitialLevels(newLevels);
                setInitialEnabled(true);
                setInitialPresetId(presetId);
            } else if (!enabled && initialEnabled && existingField) {
                // Delete field
                await Client4.deletePropertyField(GROUP_NAME, OBJECT_TYPE, existingField.id);
                setExistingField(null);
                setInitialEnabled(false);
                setInitialLevels([]);
                setLevels([]);
                setPresetId(PRESET_CUSTOM);
                setInitialPresetId(PRESET_CUSTOM);
            } else if (enabled && initialEnabled && existingField) {
                // Patch existing field options
                const options = levels.map((level) => ({
                    id: level.id || '',
                    name: level.name,
                    color: level.color,
                    rank: level.rank,
                }));
                const patched = await Client4.patchPropertyField(GROUP_NAME, OBJECT_TYPE, existingField.id, {
                    attrs: {options},
                } as Partial<PropertyField>);
                setExistingField(patched);
                const patchedOptions = (patched.attrs?.options as PropertyFieldOption[]) || [];
                const newLevels = patchedOptions.map((opt, i) => ({
                    id: opt.id,
                    name: opt.name,
                    color: opt.color || '#000000',
                    rank: opt.rank ?? (i + 1),
                }));
                setLevels(newLevels);
                setInitialLevels(newLevels);
                setInitialPresetId(presetId);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'An error occurred while saving';
            setSaveError(message);
        } finally {
            setSaving(false);
        }
    }, [enabled, initialEnabled, existingField, levels, presetId, validate]);

    const handleCancel = useCallback(() => {
        setEnabled(initialEnabled);
        setLevels(initialLevels);
        setPresetId(initialPresetId);
    }, [initialEnabled, initialLevels, initialPresetId]);

    if (loading) {
        return (
            <div className='wrapper--fixed'>
                <AdminHeader>
                    <FormattedMessage {...msg.pageTitle}/>
                </AdminHeader>
                <AdminWrapper>
                    <LoadingScreen/>
                </AdminWrapper>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className='wrapper--fixed'>
                <AdminHeader>
                    <FormattedMessage {...msg.pageTitle}/>
                </AdminHeader>
                <AdminWrapper>
                    <div className='alert alert-danger'>
                        <FormattedMessage
                            id='admin.classification_markings.load_error'
                            defaultMessage='Failed to load classification markings: {error}'
                            values={{error: loadError}}
                        />
                    </div>
                </AdminWrapper>
            </div>
        );
    }

    return (
        <div className='wrapper--fixed'>
            <AdminHeader>
                <FormattedMessage {...msg.pageTitle}/>
            </AdminHeader>
            <AdminWrapper>
                <AdminSection>
                    <SectionHeader>
                        <hgroup>
                            <FormattedMessage
                                tagName={SectionHeading}
                                {...msg.enableTitle}
                            />
                            <FormattedMessage {...msg.enableDescription}/>
                        </hgroup>
                    </SectionHeader>
                    <SectionContent $compact={true}>
                        <RadioGroup>
                            <label>
                                <input
                                    type='radio'
                                    name='classificationEnabled'
                                    value='true'
                                    checked={enabled}
                                    disabled={disabled}
                                    onChange={handleToggleEnabled}
                                />
                                <FormattedMessage
                                    id='admin.classification_markings.enable.true'
                                    defaultMessage='True'
                                />
                            </label>
                            <label>
                                <input
                                    type='radio'
                                    name='classificationEnabled'
                                    value='false'
                                    checked={!enabled}
                                    disabled={disabled}
                                    onChange={handleToggleEnabled}
                                />
                                <FormattedMessage
                                    id='admin.classification_markings.enable.false'
                                    defaultMessage='False'
                                />
                            </label>
                        </RadioGroup>
                    </SectionContent>
                </AdminSection>

                {enabled && (
                    <>
                        <AdminSection>
                            <SectionHeader>
                                <hgroup>
                                    <FormattedMessage
                                        tagName={SectionHeading}
                                        {...msg.presetTitle}
                                    />
                                    <FormattedMessage {...msg.presetDescription}/>
                                </hgroup>
                            </SectionHeader>
                            <SectionContent $compact={true}>
                                <PresetSelect
                                    value={presetId}
                                    disabled={disabled}
                                    onChange={handlePresetChange}
                                >
                                    {presets.map((preset) => (
                                        <option
                                            key={preset.id}
                                            value={preset.id}
                                        >
                                            {preset.label}
                                        </option>
                                    ))}
                                    <option value={PRESET_CUSTOM}>
                                        {formatMessage({id: 'admin.classification_markings.preset.custom', defaultMessage: 'Custom classification levels'})}
                                    </option>
                                </PresetSelect>
                            </SectionContent>
                        </AdminSection>

                        <AdminSection>
                            <SectionHeader>
                                <hgroup>
                                    <FormattedMessage
                                        tagName={SectionHeading}
                                        {...msg.levelsTitle}
                                    />
                                    <FormattedMessage {...msg.levelsDescription}/>
                                </hgroup>
                            </SectionHeader>
                            <SectionContent $compact={true}>
                                <ClassificationLevelsTable
                                    levels={levels}
                                    updateLevel={updateLevel}
                                    deleteLevel={deleteLevel}
                                    onReorder={handleReorder}
                                    disabled={disabled}
                                />
                                {!disabled && (
                                    <LinkButton onClick={addLevel}>
                                        <PlusIcon size={16}/>
                                        <FormattedMessage
                                            id='admin.classification_markings.levels.add'
                                            defaultMessage='Add level'
                                        />
                                    </LinkButton>
                                )}
                            </SectionContent>
                        </AdminSection>
                    </>
                )}
            </AdminWrapper>

            <SaveChangesPanel
                saving={saving}
                saveNeeded={hasChanges}
                onClick={handleSave}
                onCancel={handleCancel}
                serverError={saveError}
                isDisabled={saving || disabled}
                savingMessage={formatMessage({id: 'admin.classification_markings.saving', defaultMessage: 'Saving...'})}
            />

            <ConfirmModal
                show={confirmPresetSwitch !== null}
                title={formatMessage({id: 'admin.classification_markings.preset_switch.title', defaultMessage: 'Change classification preset?'})}
                message={formatMessage({id: 'admin.classification_markings.preset_switch.message', defaultMessage: 'Changing the classification preset will affect all existing classifications across the system. Any channels, files, or other resources marked with the current classification levels may lose their markings.'})}
                confirmButtonText={formatMessage({id: 'admin.classification_markings.preset_switch.confirm', defaultMessage: 'Change preset'})}
                confirmButtonClass='btn btn-danger'
                onConfirm={handleConfirmPresetSwitch}
                onCancel={handleCancelPresetSwitch}
                onExited={handleCancelPresetSwitch}
            />
        </div>
    );
}

function detectPreset(levels: ClassificationLevel[]): string {
    for (const preset of presets) {
        if (preset.levels.length !== levels.length) {
            continue;
        }
        const matches = preset.levels.every((presetLevel, i) => {
            const level = levels[i];
            return presetLevel.name === level.name && presetLevel.color.toUpperCase() === level.color.toUpperCase() && presetLevel.rank === level.rank;
        });
        if (matches) {
            return preset.id;
        }
    }
    return PRESET_CUSTOM;
}

// Classification Levels Table

type TableProps = {
    levels: ClassificationLevel[];
    updateLevel: (index: number, updates: Partial<ClassificationLevel>) => void;
    deleteLevel: (index: number) => void;
    onReorder: (prev: number, next: number) => void;
    disabled?: boolean;
};

function ClassificationLevelsTable({levels, updateLevel, deleteLevel, onReorder, disabled}: TableProps) {
    const {formatMessage} = useIntl();

    const rows: LevelRow[] = useMemo(() => {
        return [...levels].
            sort((a, b) => a.rank - b.rank).
            map((level, i) => ({
                ...level,
                id: level.id || `pending_${i}`,
            }));
    }, [levels]);

    const col = createColumnHelper<LevelRow>();

    const columns = useMemo<Array<ColumnDef<LevelRow, any>>>(() => {
        return [
            col.accessor('name', {
                size: 400,
                header: () => (
                    <ColHeaderLeft>
                        <FormattedMessage
                            id='admin.classification_markings.levels.table.text'
                            defaultMessage='Text'
                        />
                    </ColHeaderLeft>
                ),
                cell: ({row}) => (
                    <LevelNameCell
                        value={row.original.name}
                        index={row.index}
                        updateLevel={updateLevel}
                        disabled={disabled}
                        label={formatMessage({id: 'admin.classification_markings.levels.table.text.input', defaultMessage: 'Classification level name'})}
                    />
                ),
                enableSorting: false,
            }),
            col.accessor('color', {
                size: 180,
                header: () => (
                    <ColHeaderLeft>
                        <FormattedMessage
                            id='admin.classification_markings.levels.table.color'
                            defaultMessage='Colour'
                        />
                    </ColHeaderLeft>
                ),
                cell: ({row}) => (
                    <ColorCellWrapper>
                        {disabled ? (
                            <ReadOnlyColor>
                                <ColorSwatch style={{backgroundColor: row.original.color}}/>
                                <span>{row.original.color}</span>
                            </ReadOnlyColor>
                        ) : (
                            <ColorInput
                                id={`classification-color-${row.index}`}
                                value={row.original.color}
                                onChange={(color: string) => updateLevel(row.index, {color})}
                            />
                        )}
                    </ColorCellWrapper>
                ),
                enableSorting: false,
            }),
            col.accessor('rank', {
                size: 60,
                header: () => (
                    <ColHeaderLeft>
                        <FormattedMessage
                            id='admin.classification_markings.levels.table.rank'
                            defaultMessage='Rank'
                        />
                    </ColHeaderLeft>
                ),
                cell: ({row}) => (
                    <RankCell>{row.original.rank}</RankCell>
                ),
                enableSorting: false,
            }),
            ...(disabled ? [] : [col.display({
                id: 'actions',
                size: 40,
                header: () => null,
                cell: ({row}) => (
                    <ActionsCell>
                        <DeleteButton
                            aria-label={formatMessage({id: 'admin.classification_markings.levels.table.delete', defaultMessage: 'Delete level'})}
                            onClick={() => deleteLevel(row.index)}
                        >
                            <TrashCanOutlineIcon
                                size={18}
                                color='#D24B4E'
                            />
                        </DeleteButton>
                    </ActionsCell>
                ),
                enableSorting: false,
            })]),
        ];
    }, [col, updateLevel, deleteLevel, disabled, formatMessage]);

    const table = useReactTable<LevelRow>({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel<LevelRow>(),
        enableSortingRemoval: false,
        enableMultiSort: false,
        renderFallbackValue: '',
        meta: {
            tableId: 'classificationLevels',
            disablePaginationControls: true,
            ...(!disabled && {onReorder}),
        },
        manualPagination: true,
    });

    return (
        <TableWrapper>
            <AdminConsoleListTable<LevelRow> table={table}/>
        </TableWrapper>
    );
}

type LevelNameCellProps = {
    value: string;
    index: number;
    updateLevel: (index: number, updates: Partial<ClassificationLevel>) => void;
    label: string;
    disabled?: boolean;
};

function LevelNameCell({value, index, updateLevel, label, disabled}: LevelNameCellProps) {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    return (
        <BorderlessInput
            type='text'
            aria-label={label}
            $strong={true}
            value={localValue}
            readOnly={disabled}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocalValue(e.target.value)}
            onBlur={() => {
                if (localValue !== value) {
                    updateLevel(index, {name: localValue.trim()});
                }
            }}
        />
    );
}

// Styled components

const RadioGroup = styled.div`
    display: flex;
    gap: 24px;

    label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: normal;
        cursor: pointer;
    }
`;

const PresetSelect = styled.select.attrs({className: 'form-control'})`
    max-width: 500px;
`;

const TableWrapper = styled.div`
    table.adminConsoleListTable {
        td, th {
            &:after, &:before {
                display: none;
            }
        }

        thead {
            border-top: none;
            border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
            tr {
                th.pinned {
                    background: rgba(var(--center-channel-color-rgb), 0.04);
                    padding-block-end: 8px;
                    padding-block-start: 8px;
                }
            }
        }

        tbody {
            tr {
                border-top: none;
                border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
                border-bottom-color: rgba(var(--center-channel-color-rgb), 0.08) !important;
                td {
                    padding-block-end: 0;
                    padding-block-start: 0;
                    vertical-align: middle;

                    &:last-child {
                        padding-inline-end: 12px;
                    }
                    &.pinned {
                        background: none;
                    }
                }
            }
        }

        tfoot {
            border-top: none;
        }
    }
    .adminConsoleListTableContainer {
        padding: 2px 0px;
    }
`;

const ColHeaderLeft = styled.div`
    display: inline-block;
`;

const ColorCellWrapper = styled.div`
    .color-input {
        max-width: 160px;
    }
`;

const ReadOnlyColor = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    color: rgba(var(--center-channel-color-rgb), 0.72);
`;

const ColorSwatch = styled.span`
    display: inline-block;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    flex-shrink: 0;
`;

const RankCell = styled.div`
    padding: 8px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
`;

const ActionsCell = styled.div`
    text-align: right;
`;

const DeleteButton = styled.button.attrs({className: 'btn btn-sm btn-transparent'})`
    &:hover {
        background: rgba(var(--error-text-color-rgb, 210, 75, 78), 0.08);
    }
`;

export const searchableStrings = Object.values(msg);
