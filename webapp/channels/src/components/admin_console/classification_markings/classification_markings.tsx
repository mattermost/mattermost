// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createColumnHelper, getCoreRowModel, useReactTable} from '@tanstack/react-table';
import type {ColumnDef} from '@tanstack/react-table';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {ClientError} from '@mattermost/client';
import {PlusIcon, TrashCanOutlineIcon} from '@mattermost/compass-icons/components';
import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {setNavigationBlocked} from 'actions/admin_actions';

import BooleanSetting from 'components/admin_console/boolean_setting';
import Setting from 'components/admin_console/setting';
import ConfirmModal from 'components/confirm_modal';
import DropdownInput from 'components/dropdown_input';
import type {ValueType} from 'components/dropdown_input';
import LoadingScreen from 'components/loading_screen';
import SectionNotice from 'components/section_notice';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import ClassificationColorInput from './classification_color_input';
import {
    ActionsCell,
    AddLevelButton,
    AddLevelButtonRow,
    ClassificationLevelsSectionContent,
    InformationNoticeWrapper,
    ColHeaderLeft,
    ColorCellWrapper,
    ColorSwatch,
    DeleteButton,
    LevelOptionLabel,
    PresetDropdownWrapper,
    RankCell,
    ReadOnlyColor,
    TableWrapper,
    GlobalBannerSectionContent,
    GlobalBannerSectionSetting,
} from './classification_markings_styled';
import {classificationPresetDropdownStyles} from './classification_preset_dropdown_styles';
import type {ClassificationLevel} from './presets';
import {PRESET_CUSTOM, presets} from './presets';

import {AdminConsoleListTable} from '../list_table';
import SaveChangesPanel from '../save_changes_panel';
import {AdminSection, AdminWrapper, SectionHeader, SectionHeading, BorderlessInput} from '../system_properties/controls';

const GROUP_NAME = 'custom_profile_attributes';
const OBJECT_TYPE = 'user';
const TARGET_TYPE = 'system';
const TARGET_ID = '';
const FIELD_NAME = 'classification';

type LevelRow = ClassificationLevel;

export type GlobalBanner = {
    enabled: boolean;
    placement: 'top' | 'top_and_bottom';
    level_id: string;
};

const DEFAULT_GLOBAL_BANNER: GlobalBanner = {
    enabled: false,
    placement: 'top',
    level_id: '',
};

const msg = defineMessages({
    pageTitle: {id: 'admin.sidebar.classificationMarkings', defaultMessage: 'Classification Markings'},
    enableTitle: {id: 'admin.classification_markings.enable.title', defaultMessage: 'Enable classification markings'},
    enableDescription: {id: 'admin.classification_markings.enable.description', defaultMessage: 'Use this to enable classification markings as banners at the system and channel level. You can pre-select text and colors for your banner, as well as set a default option for consistency.'},
    presetTitle: {id: 'admin.classification_markings.preset.title', defaultMessage: 'Classification preset'},
    presetDescription: {id: 'admin.classification_markings.preset.description', defaultMessage: 'Select a classification preset from the dropdown menu based on your country affiliation. This will help tailor the options to your specific needs. You can also create custom classification levels.'},
    levelsTitle: {id: 'admin.classification_markings.levels.title', defaultMessage: 'Classification levels'},
    levelsDescription: {id: 'admin.classification_markings.levels.description', defaultMessage: 'Text and colors for different classification levels that will be used in the system'},
    colorOpenPicker: {id: 'admin.classification_markings.color.open_picker', defaultMessage: 'Open color picker'},
    informationalNoticeTitle: {id: 'admin.classification_markings.notice.title', defaultMessage: 'Classification markings are informational only'},
    informationalNoticeBody: {id: 'admin.classification_markings.notice.body', defaultMessage: 'Markings are not tied to access control decisions at this time and are for display purposes only.'},
    globalBannerSectionTitle: {id: 'admin.classification_markings.global_banner.section_title', defaultMessage: 'Global Classification Indicators'},
    globalBannerSectionDescription: {id: 'admin.classification_markings.global_banner.section_description', defaultMessage: 'Configure the global classification banner'},
    globalBannerEnableTitle: {id: 'admin.classification_markings.global_banner.enable.title', defaultMessage: 'Global Classification Banner'},
    globalBannerEnableDescription: {id: 'admin.classification_markings.global_banner.enable.description', defaultMessage: 'Displays a global banner for the system-wide classification.'},
    globalBannerPlacementTitle: {id: 'admin.classification_markings.global_banner.placement.title', defaultMessage: 'Banner visibility'},
    globalBannerPlacementTop: {id: 'admin.classification_markings.global_banner.placement.top', defaultMessage: 'Top only'},
    globalBannerPlacementTopAndBottom: {id: 'admin.classification_markings.global_banner.placement.top_and_bottom', defaultMessage: 'Top and bottom'},
    globalBannerLevelTitle: {id: 'admin.classification_markings.global_banner.level.title', defaultMessage: 'Global classification level'},
    globalBannerLevelDescription: {id: 'admin.classification_markings.global_banner.level.description', defaultMessage: 'Choose from a variety of pre-defined banner options. To manually set the banner text and color, select "Custom banner".'},
    globalBannerLockedNotice: {id: 'admin.classification_markings.global_banner.locked_notice', defaultMessage: 'Global classification placement and level are locked once configured. To change them, disable classification markings, save, and re-enable.'},
    errorGlobalBannerNoLevel: {id: 'admin.classification_markings.error.global_banner_no_level', defaultMessage: 'A global classification level must be selected when the global banner is enabled.'},
    deleteLevelLockedTooltip: {id: 'admin.classification_markings.levels.delete_locked', defaultMessage: 'Cannot delete the level used by the global classification banner while it is locked.'},
});

type Props = {
    disabled?: boolean;
};

export function detectPreset(levels: ClassificationLevel[]): string {
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

export function optionsToLevels(options: PropertyFieldOption[]): ClassificationLevel[] {
    return options.map((opt, i) => ({
        id: opt.id,
        name: opt.name,
        color: opt.color || '#000000',
        rank: opt.rank ?? (i + 1),
    })).sort((a, b) => a.rank - b.rank);
}

export function levelsToOptions(levels: ClassificationLevel[]): Array<{id: string; name: string; color: string; rank: number}> {
    return levels.map((level) => ({
        id: level.id.startsWith('pending_') ? '' : level.id,
        name: level.name,
        color: level.color,
        rank: level.rank,
    }));
}

export function parseGlobalBanner(attrs?: PropertyField['attrs']): GlobalBanner {
    const raw = attrs?.global_banner;
    if (!raw || typeof raw !== 'object') {
        return {...DEFAULT_GLOBAL_BANNER};
    }
    const gb = raw as Record<string, unknown>;
    return {
        enabled: Boolean(gb.enabled),
        placement: gb.placement === 'top_and_bottom' ? 'top_and_bottom' : 'top',
        level_id: typeof gb.level_id === 'string' ? gb.level_id : '',
    };
}

export async function fetchClassificationField(): Promise<PropertyField | undefined> {
    const maxItems = 500;
    let fetched = 0;
    let cursorId: string | undefined;
    let cursorCreateAt: number | undefined;

    while (fetched < maxItems) {
        const fields = await Client4.getPropertyFields(GROUP_NAME, OBJECT_TYPE, TARGET_TYPE, TARGET_ID, {cursorId, cursorCreateAt}); // eslint-disable-line no-await-in-loop
        const found = fields.find((f: PropertyField) => f.name === FIELD_NAME && f.delete_at === 0);
        if (found || fields.length === 0) {
            return found;
        }

        fetched += fields.length;
        const last = fields[fields.length - 1];
        cursorId = last.id;
        cursorCreateAt = last.create_at;
    }

    return undefined;
}

export function processClassificationField(field: PropertyField): {levels: ClassificationLevel[]; presetId: string; globalBanner: GlobalBanner} {
    const options = (field.attrs?.options as PropertyFieldOption[]) || [];
    const levels = optionsToLevels(options);
    const presetId = detectPreset(levels);
    const globalBanner = parseGlobalBanner(field.attrs);
    return {levels, presetId, globalBanner};
}

async function saveCreateField(levels: ClassificationLevel[], globalBanner: GlobalBanner): Promise<PropertyField> {
    const options = levelsToOptions(levels);
    const globalBannerAttrs = globalBanner.level_id ? {global_banner: globalBanner} : {};
    return Client4.createPropertyField(GROUP_NAME, OBJECT_TYPE, {
        name: FIELD_NAME,
        type: 'select' as PropertyField['type'],
        target_type: TARGET_TYPE,
        target_id: TARGET_ID,
        attrs: {options, managed: 'admin', ...globalBannerAttrs},
        permission_field: 'sysadmin',
        permission_values: 'sysadmin',
        permission_options: 'sysadmin',
    });
}

async function saveDeleteField(fieldId: string): Promise<void> {
    await Client4.deletePropertyField(GROUP_NAME, OBJECT_TYPE, fieldId);
}

async function savePatchField(fieldId: string, levels: ClassificationLevel[], globalBanner: GlobalBanner): Promise<PropertyField> {
    const options = levelsToOptions(levels);
    const globalBannerAttrs = globalBanner.level_id ? {global_banner: globalBanner} : {};
    return Client4.patchPropertyField(GROUP_NAME, OBJECT_TYPE, fieldId, {
        attrs: {options, ...globalBannerAttrs},
    } as Partial<PropertyField>);
}

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
    const [globalBanner, setGlobalBanner] = useState<GlobalBanner>({...DEFAULT_GLOBAL_BANNER});

    // Track the last-persisted state (used for change detection and lock derivation)
    const [initialEnabled, setInitialEnabled] = useState(false);
    const [initialLevels, setInitialLevels] = useState<ClassificationLevel[]>([]);
    const [initialPresetId, setInitialPresetId] = useState<string>(PRESET_CUSTOM);
    const [initialGlobalBanner, setInitialGlobalBanner] = useState<GlobalBanner>({...DEFAULT_GLOBAL_BANNER});

    // Confirm modal for preset switch
    const [confirmPresetSwitch, setConfirmPresetSwitch] = useState<string | null>(null);
    const [hasAcknowledgedPresetWarning, setHasAcknowledgedPresetWarning] = useState(false);

    // The banner is locked (placement + level become read-only) once a level_id has been persisted
    const locked = Boolean(initialGlobalBanner.level_id);

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
        const levelsChanged = levels.some((level, i) => {
            const initial = initialLevels[i];
            return level.name !== initial.name || level.color !== initial.color || level.id !== initial.id || level.rank !== initial.rank;
        });
        if (levelsChanged) {
            return true;
        }
        return (
            globalBanner.enabled !== initialGlobalBanner.enabled ||
            globalBanner.placement !== initialGlobalBanner.placement ||
            globalBanner.level_id !== initialGlobalBanner.level_id
        );
    }, [enabled, initialEnabled, levels, initialLevels, globalBanner, initialGlobalBanner]);

    useEffect(() => {
        dispatch(setNavigationBlocked(hasChanges));
    }, [hasChanges, dispatch]);

    // Load existing field on mount
    useEffect(() => {
        (async () => {
            try {
                const field = await fetchClassificationField();
                if (field) {
                    const result = processClassificationField(field);
                    setExistingField(field);
                    setEnabled(true);
                    setInitialEnabled(true);
                    setLevels(result.levels);
                    setInitialLevels(result.levels);
                    setPresetId(result.presetId);
                    setInitialPresetId(result.presetId);
                    setGlobalBanner(result.globalBanner);
                    setInitialGlobalBanner(result.globalBanner);
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
        })();
    }, []);

    const handleClassificationEnabledChange = useCallback((_id: string, value: boolean) => {
        setEnabled(value);
    }, []);

    const applyPreset = useCallback((newPresetId: string) => {
        const preset = presets.find((p) => p.id === newPresetId);
        if (preset) {
            setPresetId(newPresetId);
            setLevels(preset.levels.map((l) => ({...l})));
            // Preset replaces all options so the stored level_id is almost certainly orphaned.
            // Clear it so the admin must re-select (only applies when not yet locked).
            setGlobalBanner((prev) => ({...prev, level_id: ''}));
        }
    }, []);

    const presetDropdownOptions = useMemo((): ValueType[] => {
        return [
            ...presets.map((p) => ({value: p.id, label: p.label})),
            {
                value: PRESET_CUSTOM,
                label: formatMessage({
                    id: 'admin.classification_markings.preset.custom',
                    defaultMessage: 'Custom classification levels',
                }),
            },
        ];
    }, [formatMessage]);

    const presetDropdownValue = useMemo(() => {
        return presetDropdownOptions.find((o) => o.value === presetId) ?? presetDropdownOptions[presetDropdownOptions.length - 1]!;
    }, [presetDropdownOptions, presetId]);

    const handlePresetDropdownChange = useCallback((selected: ValueType | null) => {
        if (!selected) {
            return;
        }
        const newPresetId = selected.value;
        if (newPresetId === PRESET_CUSTOM) {
            setPresetId(PRESET_CUSTOM);
            return;
        }
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

    const updateLevel = useCallback((id: string, updates: Partial<ClassificationLevel>) => {
        setLevels((prev) => prev.map((level) => (level.id === id ? {...level, ...updates} : level)));
        switchToCustom();
    }, [switchToCustom]);

    const deleteLevel = useCallback((id: string) => {
        setLevels((prev) => prev.filter((level) => level.id !== id).map((level, i) => ({...level, rank: i + 1})));
        // If the deleted level was selected in the global banner (and not locked), clear the reference
        setGlobalBanner((prev) => prev.level_id === id ? {...prev, level_id: ''} : prev);
        switchToCustom();
    }, [switchToCustom]);

    const addLevel = useCallback(() => {
        setLevels((prev) => {
            const maxRank = prev.reduce((max, l) => Math.max(max, l.rank), 0);
            return [...prev, {id: `pending_${Date.now()}`, name: '', color: '#000000', rank: maxRank + 1}];
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

    const handleGlobalBannerChange = useCallback((updates: Partial<GlobalBanner>) => {
        setGlobalBanner((prev) => ({...prev, ...updates}));
    }, []);

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
        if (globalBanner.enabled && !globalBanner.level_id) {
            return formatMessage(msg.errorGlobalBannerNoLevel);
        }
        return null;
    }, [enabled, levels, globalBanner, formatMessage]);

    const handleSaveCreate = useCallback(async () => {
        const created = await saveCreateField(levels, globalBanner);
        const result = processClassificationField(created);
        setExistingField(created);
        setLevels(result.levels);
        setInitialLevels(result.levels);
        setInitialEnabled(true);
        setInitialPresetId(presetId);
        setGlobalBanner(result.globalBanner);
        setInitialGlobalBanner(result.globalBanner);
    }, [levels, globalBanner, presetId]);

    const handleSaveDelete = useCallback(async () => {
        await saveDeleteField(existingField!.id);
        setExistingField(null);
        setInitialEnabled(false);
        setInitialLevels([]);
        setLevels([]);
        setPresetId(PRESET_CUSTOM);
        setInitialPresetId(PRESET_CUSTOM);
        setGlobalBanner({...DEFAULT_GLOBAL_BANNER});
        setInitialGlobalBanner({...DEFAULT_GLOBAL_BANNER});
    }, [existingField]);

    const handleSavePatch = useCallback(async () => {
        const patched = await savePatchField(existingField!.id, levels, globalBanner);
        const result = processClassificationField(patched);
        setExistingField(patched);
        setLevels(result.levels);
        setInitialLevels(result.levels);
        setInitialPresetId(presetId);
        setGlobalBanner(result.globalBanner);
        setInitialGlobalBanner(result.globalBanner);
    }, [existingField, levels, globalBanner, presetId]);

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
                await handleSaveCreate();
            } else if (!enabled && initialEnabled && existingField) {
                await handleSaveDelete();
            } else if (enabled && initialEnabled && existingField) {
                await handleSavePatch();
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'An error occurred while saving';
            setSaveError(message);
        } finally {
            setSaving(false);
        }
    }, [enabled, initialEnabled, existingField, validate, handleSaveCreate, handleSaveDelete, handleSavePatch]);

    const handleCancel = useCallback(() => {
        setEnabled(initialEnabled);
        setLevels(initialLevels);
        setPresetId(initialPresetId);
        setGlobalBanner(initialGlobalBanner);
    }, [initialEnabled, initialLevels, initialPresetId, initialGlobalBanner]);

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
                <InformationNoticeWrapper>
                    <SectionNotice
                        type='warning'
                        iconOverride='icon-information-outline'
                        title={<FormattedMessage {...msg.informationalNoticeTitle}/>}
                        text={formatMessage(msg.informationalNoticeBody)}
                    />
                </InformationNoticeWrapper>
                <form
                    className='form-horizontal'
                    onSubmit={(e) => e.preventDefault()}
                >
                    <BooleanSetting
                        id='classificationEnabled'
                        label={<FormattedMessage {...msg.enableTitle}/>}
                        value={enabled}
                        onChange={handleClassificationEnabledChange}
                        disabled={disabled}
                        setByEnv={false}
                        helpText={<FormattedMessage {...msg.enableDescription}/>}
                        trueText={(
                            <FormattedMessage
                                id='admin.classification_markings.enable.true'
                                defaultMessage='True'
                            />
                        )}
                        falseText={(
                            <FormattedMessage
                                id='admin.classification_markings.enable.false'
                                defaultMessage='False'
                            />
                        )}
                    />
                    {enabled && (
                        <Setting
                            inputId='DropdownInput_classificationPreset'
                            label={<FormattedMessage {...msg.presetTitle}/>}
                            helpText={<FormattedMessage {...msg.presetDescription}/>}
                            setByEnv={false}
                        >
                            <PresetDropdownWrapper>
                                <DropdownInput
                                    className='classificationPresetDropdownFieldset'
                                    name='classificationPreset'
                                    testId='classificationPreset'
                                    options={presetDropdownOptions}
                                    value={presetDropdownValue}
                                    onChange={handlePresetDropdownChange}
                                    isDisabled={disabled || locked}
                                    isClearable={false}
                                    menuPortalTarget={document.body}
                                    styles={classificationPresetDropdownStyles}
                                />
                            </PresetDropdownWrapper>
                        </Setting>
                    )}
                </form>

                {enabled && (
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
                        <ClassificationLevelsSectionContent>
                            <ClassificationLevelsTable
                                levels={levels}
                                updateLevel={updateLevel}
                                deleteLevel={deleteLevel}
                                onReorder={handleReorder}
                                disabled={disabled}
                                reorderDisabled={presetId !== PRESET_CUSTOM}
                                lockedLevelId={locked ? initialGlobalBanner.level_id : ''}
                                lockedLevelTooltip={formatMessage(msg.deleteLevelLockedTooltip)}
                            />
                            {!disabled && (
                                <AddLevelButtonRow>
                                    <AddLevelButton onClick={addLevel}>
                                        <PlusIcon size={14}/>
                                        <FormattedMessage
                                            id='admin.classification_markings.levels.add'
                                            defaultMessage='Add level'
                                        />
                                    </AddLevelButton>
                                </AddLevelButtonRow>
                            )}
                        </ClassificationLevelsSectionContent>
                    </AdminSection>
                )}

                {enabled && (
                    <GlobalClassificationIndicators
                        levels={levels}
                        globalBanner={globalBanner}
                        locked={locked}
                        disabled={disabled}
                        onChange={handleGlobalBannerChange}
                    />
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

// Global Classification Indicators section

type LevelDropdownOption = ValueType & {color: string};

type GlobalBannerProps = {
    levels: ClassificationLevel[];
    globalBanner: GlobalBanner;
    locked: boolean;
    disabled?: boolean;
    onChange: (updates: Partial<GlobalBanner>) => void;
};

function GlobalClassificationIndicators({levels, globalBanner, locked, disabled, onChange}: GlobalBannerProps) {
    const {formatMessage} = useIntl();

    const levelOptions = useMemo((): LevelDropdownOption[] => {
        return levels.map((l) => ({value: l.id, label: l.name, color: l.color}));
    }, [levels]);

    const selectedLevelOption = useMemo(() => {
        return levelOptions.find((o) => o.value === globalBanner.level_id);
    }, [levelOptions, globalBanner.level_id]);

    const formatLevelOptionLabel = useCallback((option: ValueType) => {
        const levelOption = option as LevelDropdownOption;
        return (
            <LevelOptionLabel>
                <ColorSwatch style={{backgroundColor: levelOption.color}}/>
                <span>{levelOption.label}</span>
            </LevelOptionLabel>
        );
    }, []);

    const handleLevelChange = useCallback((selected: ValueType | null) => {
        onChange({level_id: selected?.value ?? ''});
    }, [onChange]);

    const handleEnableChange = useCallback((_id: string, value: boolean) => {
        onChange({enabled: value});
    }, [onChange]);

    const handlePlacementChange = useCallback((_id: string, value: boolean) => {
        onChange({placement: value ? 'top' : 'top_and_bottom'});
    }, [onChange]);

    const controlsDisabled = disabled || locked;

    return (
        <AdminSection>
            <SectionHeader>
                <hgroup>
                    <FormattedMessage
                        tagName={SectionHeading}
                        {...msg.globalBannerSectionTitle}
                    />
                    <FormattedMessage {...msg.globalBannerSectionDescription}/>
                </hgroup>
            </SectionHeader>
            <GlobalBannerSectionContent>
                <SectionNotice
                    type='warning'
                    title={<FormattedMessage {...msg.globalBannerLockedNotice}/>}
                />
                <form
                    className='form-horizontal'
                    onSubmit={(e) => e.preventDefault()}
                >
                    <GlobalBannerSectionSetting>
                        <BooleanSetting
                            id='globalBannerEnabled'
                            label={<FormattedMessage {...msg.globalBannerEnableTitle}/>}
                            value={globalBanner.enabled}
                            onChange={handleEnableChange}
                            disabled={disabled}
                            setByEnv={false}
                            helpText={<FormattedMessage {...msg.globalBannerEnableDescription}/>}
                            trueText={(
                                <FormattedMessage
                                    id='admin.classification_markings.global_banner.enable.true'
                                    defaultMessage='True'
                                />
                            )}
                            falseText={(
                                <FormattedMessage
                                    id='admin.classification_markings.global_banner.enable.false'
                                    defaultMessage='False'
                                />
                            )}
                        />
                    </GlobalBannerSectionSetting>
                    {globalBanner.enabled && (
                        <>
                            <GlobalBannerSectionSetting>
                                <BooleanSetting
                                    id='globalBannerPlacement'
                                    label={<FormattedMessage {...msg.globalBannerPlacementTitle}/>}
                                    value={globalBanner.placement === 'top'}
                                    onChange={handlePlacementChange}
                                    disabled={controlsDisabled}
                                    setByEnv={false}
                                    helpText={''}
                                    trueText={<FormattedMessage {...msg.globalBannerPlacementTop}/>}
                                    falseText={<FormattedMessage {...msg.globalBannerPlacementTopAndBottom}/>}
                                />
                            </GlobalBannerSectionSetting>
                            <GlobalBannerSectionSetting>
                                <Setting
                                    inputId='DropdownInput_globalBannerLevel'
                                    label={<FormattedMessage {...msg.globalBannerLevelTitle}/>}
                                    helpText={<FormattedMessage {...msg.globalBannerLevelDescription}/>}
                                    setByEnv={false}
                                >
                                    <PresetDropdownWrapper>
                                        <DropdownInput
                                            className='classificationPresetDropdownFieldset'
                                            name='globalBannerLevel'
                                            testId='globalBannerLevel'
                                            options={levelOptions}
                                            value={selectedLevelOption}
                                            onChange={handleLevelChange}
                                            isDisabled={controlsDisabled}
                                            isClearable={false}
                                            menuPortalTarget={document.body}
                                            styles={classificationPresetDropdownStyles}
                                            formatOptionLabel={formatLevelOptionLabel}
                                        />
                                    </PresetDropdownWrapper>
                                </Setting>
                            </GlobalBannerSectionSetting>
                        </>
                    )}
                </form>
            </GlobalBannerSectionContent>
        </AdminSection>
    );
}

// Classification Levels Table

type TableProps = {
    levels: ClassificationLevel[];
    updateLevel: (id: string, updates: Partial<ClassificationLevel>) => void;
    deleteLevel: (id: string) => void;
    onReorder: (prev: number, next: number) => void;
    disabled?: boolean;
    reorderDisabled?: boolean;
    lockedLevelId?: string;
    lockedLevelTooltip?: string;
};

function ClassificationLevelsTable({levels, updateLevel, deleteLevel, onReorder, disabled, reorderDisabled, lockedLevelId, lockedLevelTooltip}: TableProps) {
    const {formatMessage} = useIntl();

    const rows: LevelRow[] = useMemo(() => {
        return [...levels].sort((a, b) => a.rank - b.rank);
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
                        id={row.original.id}
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
                            defaultMessage='Color'
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
                            <LevelColorCell
                                id={row.original.id}
                                value={row.original.color}
                                updateLevel={updateLevel}
                                swatchAriaLabel={formatMessage(msg.colorOpenPicker)}
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
                cell: ({row}) => {
                    const isLockedLevel = lockedLevelId && row.original.id === lockedLevelId;
                    return (
                        <ActionsCell>
                            <DeleteButton
                                aria-label={formatMessage({id: 'admin.classification_markings.levels.table.delete', defaultMessage: 'Delete level'})}
                                onClick={() => !isLockedLevel && deleteLevel(row.original.id)}
                                disabled={Boolean(isLockedLevel)}
                                title={isLockedLevel ? lockedLevelTooltip : undefined}
                            >
                                <TrashCanOutlineIcon
                                    size={18}
                                    color={isLockedLevel ? 'rgba(var(--center-channel-color-rgb), 0.32)' : '#D24B4E'}
                                />
                            </DeleteButton>
                        </ActionsCell>
                    );
                },
                enableSorting: false,
            })]),
        ];
    }, [col, updateLevel, deleteLevel, disabled, formatMessage, lockedLevelId, lockedLevelTooltip]);

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
            ...(!disabled && !reorderDisabled && {onReorder}),
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
    id: string;
    updateLevel: (id: string, updates: Partial<ClassificationLevel>) => void;
    label: string;
    disabled?: boolean;
};

function LevelNameCell({value, id, updateLevel, label, disabled}: LevelNameCellProps) {
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
                    updateLevel(id, {name: localValue.trim()});
                }
            }}
        />
    );
}

type LevelColorCellProps = {
    value: string;
    id: string;
    updateLevel: (id: string, updates: Partial<ClassificationLevel>) => void;
    swatchAriaLabel: string;
};

function LevelColorCell({value, id, updateLevel, swatchAriaLabel}: LevelColorCellProps) {
    const [localColor, setLocalColor] = useState(value);

    useEffect(() => {
        setLocalColor(value);
    }, [value]);

    return (
        <div
            onBlur={() => {
                if (localColor !== value) {
                    updateLevel(id, {color: localColor});
                }
            }}
        >
            <ClassificationColorInput
                id={`classification-color-${id}`}
                value={localColor}
                onChange={setLocalColor}
                swatchAriaLabel={swatchAriaLabel}
            />
        </div>
    );
}

export const searchableStrings = Object.values(msg);
