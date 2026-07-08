// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {ClientError} from '@mattermost/client';
import {PlusIcon} from '@mattermost/compass-icons/components';
import type {PropertyField} from '@mattermost/types/properties';

import PropertyTypes from 'mattermost-redux/action_types/properties';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {setNavigationBlocked} from 'actions/admin_actions';

import BooleanSetting from 'components/admin_console/boolean_setting';
import Setting from 'components/admin_console/setting';
import ConfirmModal from 'components/confirm_modal';
import DropdownInput from 'components/dropdown_input';
import type {ValueType} from 'components/dropdown_input';
import LoadingScreen from 'components/loading_screen';
import SectionNotice from 'components/section_notice';
import AdminHeader from 'components/widgets/admin_console/admin_header';

import {
    AddLevelButton,
    AddLevelButtonRow,
    ClassificationLevelsSectionContent,
    InformationNoticeWrapper,
    PresetDropdownWrapper,
} from './classification_markings_styled';
import ClassificationLevelsTable from './components/classification_levels_table';
import GlobalClassificationIndicators from './components/global_classification_indicators';
import type {GlobalBannerConfig} from './utils';
import {
    DEFAULT_GLOBAL_BANNER,
    DISPLAY_BANNER_TOP,
    actionsToGlobalBanner,
    placementToActions,
    fetchChannelClassificationField,
    fetchClassificationField,
    fetchLinkedClassificationField,
    fetchSystemClassificationValue,
    processClassificationField,
    saveCreateChannelLinkedField,
    saveCreateField,
    saveCreateLinkedField,
    saveDeleteChannelLinkedField,
    saveDeleteField,
    saveDeleteLinkedField,
    savePatchField,
    savePatchLinkedField,
    saveUpsertSystemValue,
} from './utils';
import {classificationPresetDropdownStyles} from './utils/preset_dropdown_styles';
import type {ClassificationLevel} from './utils/presets';
import {PENDING_LEVEL_PREFIX, PRESET_CUSTOM, PRESET_EMPTY, presets} from './utils/presets';

import SaveChangesPanel from '../save_changes_panel';
import {AdminSection, AdminWrapper, SectionHeader, SectionHeading} from '../system_properties/controls';

const msg = defineMessages({
    pageTitle: {id: 'admin.sidebar.classificationMarkings', defaultMessage: 'Classification Markings'},
    enableTitle: {id: 'admin.classification_markings.enable.title', defaultMessage: 'Enable classification markings'},
    enableDescription: {id: 'admin.classification_markings.enable.description', defaultMessage: 'Use this to enable classification markings as banners at the system and channel level. You can pre-select text and colors for your banner, as well as set a default option for consistency.'},
    presetTitle: {id: 'admin.classification_markings.preset.title', defaultMessage: 'Classification preset'},
    presetDescription: {id: 'admin.classification_markings.preset.description', defaultMessage: 'Select a classification preset from the dropdown menu based on your country affiliation. This will help tailor the options to your specific needs. You can also create custom classification levels.'},
    levelsTitle: {id: 'admin.classification_markings.levels.title', defaultMessage: 'Classification levels'},
    levelsDescription: {id: 'admin.classification_markings.levels.description', defaultMessage: 'Text and colors for different classification levels that will be used in the system'},
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
    globalBannerLevelDescription: {id: 'admin.classification_markings.global_banner.level.description', defaultMessage: 'Select a classification level to display on the global banner. The banner text and color are determined by the chosen level.'},
    errorGlobalBannerNoLevel: {id: 'admin.classification_markings.error.global_banner_no_level', defaultMessage: 'A global classification level must be selected when the global banner is enabled.'},
    errorGlobalBannerLevelMissing: {id: 'admin.classification_markings.error.global_banner_level_missing', defaultMessage: 'The global classification banner is configured with a level that no longer exists. Select a level that exists in the current classification levels.'},
    errorDeleteHasDependents: {id: 'admin.classification_markings.error.delete_has_dependents', defaultMessage: 'Cannot disable classification markings while channel classifications exist. Remove all channel classification markings first.'},
});

export const searchableStrings = Object.values(msg);

type Props = {
    disabled?: boolean;
};

export default function ClassificationMarkings({disabled}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const currentUserId = useSelector(getCurrentUserId);

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string>();
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string>();
    const [existingField, setExistingField] = useState<PropertyField | null>(null);
    const [existingLinkedField, setExistingLinkedField] = useState<PropertyField | null>(null);

    const [enabled, setEnabled] = useState(false);
    const [presetId, setPresetId] = useState<string>(PRESET_EMPTY);
    const [levels, setLevels] = useState<ClassificationLevel[]>([]);
    const [globalBanner, setGlobalBanner] = useState<GlobalBannerConfig>({...DEFAULT_GLOBAL_BANNER});
    const [cachedCustomLevels, setCachedCustomLevels] = useState<ClassificationLevel[]>([]);

    const [initialEnabled, setInitialEnabled] = useState(false);
    const [initialLevels, setInitialLevels] = useState<ClassificationLevel[]>([]);
    const [initialGlobalBanner, setInitialGlobalBanner] = useState<GlobalBannerConfig>({...DEFAULT_GLOBAL_BANNER});

    const [confirmPresetSwitch, setConfirmPresetSwitch] = useState<string | null>(null);

    const hasChanges = useMemo(() => {
        if (enabled !== initialEnabled) {
            return true;
        }
        if (!enabled) {
            return false;
        }
        if (
            globalBanner.enabled !== initialGlobalBanner.enabled ||
            globalBanner.placement !== initialGlobalBanner.placement ||
            globalBanner.level_id !== initialGlobalBanner.level_id
        ) {
            return true;
        }
        if (levels.length !== initialLevels.length) {
            return true;
        }
        return levels.some((level, i) => {
            const initial = initialLevels[i];
            return level.name !== initial.name || level.color !== initial.color || level.id !== initial.id || level.rank !== initial.rank;
        });
    }, [enabled, initialEnabled, levels, initialLevels, globalBanner, initialGlobalBanner]);

    useEffect(() => {
        dispatch(setNavigationBlocked(hasChanges));
    }, [hasChanges, dispatch]);

    useEffect(() => {
        if (!currentUserId) {
            return undefined;
        }

        let cancelled = false;

        (async () => {
            try {
                const field = await fetchClassificationField();
                if (cancelled) {
                    return;
                }
                if (field) {
                    const result = processClassificationField(field);

                    const linkedField = await fetchLinkedClassificationField();
                    if (cancelled) {
                        return;
                    }
                    let banner: GlobalBannerConfig = {...DEFAULT_GLOBAL_BANNER};
                    if (linkedField) {
                        const actions = (linkedField.attrs?.actions as string[]) ?? [];
                        let levelId = '';
                        if (actions.includes(DISPLAY_BANNER_TOP)) {
                            const optionId = await fetchSystemClassificationValue(linkedField.id);
                            if (cancelled) {
                                return;
                            }
                            if (optionId) {
                                levelId = optionId;
                            }
                        }
                        banner = actionsToGlobalBanner(actions, levelId);
                    }

                    setExistingField(field);
                    setExistingLinkedField(linkedField ?? null);
                    setEnabled(true);
                    setInitialEnabled(true);
                    setLevels(result.levels);
                    setInitialLevels(result.levels);
                    setPresetId(result.presetId);
                    setGlobalBanner(banner);
                    setInitialGlobalBanner(banner);
                }
            } catch (err: unknown) {
                if (cancelled) {
                    return;
                }
                const isNotFound = (err as ClientError).status_code === 404;
                if (!isNotFound) {
                    const message = err instanceof Error ? err.message : 'Failed to load classification markings';
                    setLoadError(message);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [currentUserId]);

    const handleClassificationEnabledChange = useCallback((_id: string, value: boolean) => {
        setEnabled(value);
    }, []);

    const applyPreset = useCallback((newPresetId: string) => {
        if (newPresetId === PRESET_CUSTOM) {
            setPresetId(PRESET_CUSTOM);
            setLevels(cachedCustomLevels.map((l) => ({...l})));
            return;
        }
        const preset = presets.find((p) => p.id === newPresetId);
        if (preset) {
            if (presetId === PRESET_CUSTOM) {
                setCachedCustomLevels(levels);
            }
            setPresetId(newPresetId);
            setLevels(preset.levels.map((l) => ({...l})));
        }
    }, [cachedCustomLevels, presetId, levels]);

    const showCustomOption = presetId === PRESET_CUSTOM || cachedCustomLevels.length > 0;

    const presetDropdownOptions = useMemo((): ValueType[] => {
        const options: ValueType[] = [];
        if (presetId === PRESET_EMPTY) {
            options.push({
                value: PRESET_EMPTY,
                label: formatMessage({
                    id: 'admin.classification_markings.preset.empty',
                    defaultMessage: 'Select a preset…',
                }),
            });
        }
        options.push(...presets.map((p) => ({value: p.id, label: p.label})));
        if (showCustomOption) {
            options.push({
                value: PRESET_CUSTOM,
                label: formatMessage({
                    id: 'admin.classification_markings.preset.custom',
                    defaultMessage: 'Custom classification levels',
                }),
            });
        }
        return options;
    }, [formatMessage, presetId, showCustomOption]);

    const presetDropdownValue = useMemo(() => {
        return presetDropdownOptions.find((o) => o.value === presetId) ?? presetDropdownOptions[0]!;
    }, [presetDropdownOptions, presetId]);

    const handlePresetDropdownChange = useCallback((selected: ValueType | null) => {
        if (!selected) {
            return;
        }
        const newPresetId = selected.value;
        if (newPresetId === PRESET_EMPTY) {
            return;
        }
        if (newPresetId === PRESET_CUSTOM) {
            applyPreset(newPresetId);
            return;
        }
        if (levels.length > 0 && presetId !== PRESET_EMPTY) {
            setConfirmPresetSwitch(newPresetId);
            return;
        }
        applyPreset(newPresetId);
    }, [levels.length, presetId, applyPreset]);

    const handleConfirmPresetSwitch = useCallback(() => {
        if (confirmPresetSwitch) {
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
        switchToCustom();
    }, [switchToCustom]);

    const addLevel = useCallback(() => {
        setLevels((prev) => {
            const maxRank = prev.reduce((max, l) => Math.max(max, l.rank), 0);
            return [...prev, {id: `${PENDING_LEVEL_PREFIX}${Date.now()}`, name: '', color: '#000000', rank: maxRank + 1}];
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

    const handleGlobalBannerChange = useCallback((updates: Partial<GlobalBannerConfig>) => {
        setGlobalBanner((prev) => ({...prev, ...updates}));
    }, []);

    const validate = useCallback((): string | null => {
        if (enabled) {
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
            if (globalBanner.enabled) {
                if (!globalBanner.level_id) {
                    return formatMessage(msg.errorGlobalBannerNoLevel);
                }
                if (!levels.some((l) => l.id === globalBanner.level_id)) {
                    return formatMessage(msg.errorGlobalBannerLevelMissing);
                }
            }
        }
        return null;
    }, [enabled, levels, globalBanner, formatMessage]);

    const persistLevels = useCallback(async (): Promise<void> => {
        const effectiveBanner: GlobalBannerConfig = enabled ? globalBanner : {...DEFAULT_GLOBAL_BANNER};

        // Re-fetch fields at save time to avoid creating duplicates if the
        // initial load missed them (e.g. timing race on mount).
        let templateField = existingField;
        let linkedField = existingLinkedField;
        if (!templateField) {
            templateField = (await fetchClassificationField()) ?? null;
            if (templateField) {
                setExistingField(templateField);
            }
        }
        if (!linkedField) {
            linkedField = (await fetchLinkedClassificationField()) ?? null;
            if (linkedField) {
                setExistingLinkedField(linkedField);
            }
        }

        if (enabled) {
            let savedTemplate: PropertyField;
            if (templateField) {
                savedTemplate = await savePatchField(templateField.id, levels);
            } else {
                savedTemplate = await saveCreateField(levels);
            }
            const result = processClassificationField(savedTemplate);

            // Remap banner level_id: pending_ IDs are stripped on save and the
            // server generates new ones. Match by rank to resolve the real ID.
            const resolvedBanner = {...effectiveBanner};
            if (resolvedBanner.level_id) {
                const oldLevel = levels.find((l) => l.id === resolvedBanner.level_id);
                if (oldLevel) {
                    const newLevel = result.levels.find((l) => l.rank === oldLevel.rank);
                    if (newLevel) {
                        resolvedBanner.level_id = newLevel.id;
                    }
                }
            }

            // Create/patch linked field with empty actions first, upsert the
            // selected value, then activate the banner — ensures the banner
            // never points at a stale option if the value write fails.
            const disabledBanner: GlobalBannerConfig = {...DEFAULT_GLOBAL_BANNER};
            let savedLinked: PropertyField;
            if (linkedField) {
                savedLinked = await savePatchLinkedField(linkedField.id, disabledBanner);
            } else {
                savedLinked = await saveCreateLinkedField(savedTemplate.id, disabledBanner);
            }

            // The value is classification's home for actions: always upsert the
            // system value with the resolved actions (empty when the banner is
            // off) and level. The webapp reads actions from value.attrs.actions;
            // the field is mirrored below so both carry the same actions.
            const resolvedLevelId = resolvedBanner.enabled ? resolvedBanner.level_id : '';
            const savedValues = await saveUpsertSystemValue(savedLinked.id, resolvedLevelId, placementToActions(resolvedBanner));
            dispatch({type: PropertyTypes.RECEIVED_PROPERTY_VALUES, data: {values: savedValues}});

            // Mirror the actions onto the field as well: mobile reads banner
            // actions from field.attrs.actions, so this keeps it in sync. The
            // field write can be removed once every client reads from the value.
            if (resolvedBanner.enabled) {
                savedLinked = await savePatchLinkedField(savedLinked.id, resolvedBanner);
            }

            // Ensure the channel-scoped classification linked field exists as part of the set.
            // Push saved fields into Redux eagerly so the banner updates
            // atomically rather than waiting for out-of-order WS events.
            const existingChannelField = await fetchChannelClassificationField();
            if (existingChannelField) {
                dispatch({type: PropertyTypes.RECEIVED_PROPERTY_FIELDS, data: {fields: [savedTemplate, savedLinked, existingChannelField]}});
            } else {
                const savedChannelField = await saveCreateChannelLinkedField(savedTemplate.id);
                dispatch({type: PropertyTypes.RECEIVED_PROPERTY_FIELDS, data: {fields: [savedTemplate, savedLinked, savedChannelField]}});
            }

            setExistingField(savedTemplate);
            setExistingLinkedField(savedLinked);
            setLevels(result.levels);
            setInitialLevels(result.levels);
            setPresetId(result.presetId);
            setGlobalBanner(resolvedBanner);
            setInitialGlobalBanner(resolvedBanner);
            setInitialEnabled(true);
        } else if (templateField) {
            // Linked fields must be deleted before the template (deletion protection).
            // Order: channel field -> system field -> template.
            const channelField = await fetchChannelClassificationField();
            if (channelField) {
                await saveDeleteChannelLinkedField(channelField.id);
                dispatch({type: PropertyTypes.PROPERTY_FIELD_DELETED, data: {fieldId: channelField.id}});
            }
            if (linkedField) {
                await saveDeleteLinkedField(linkedField.id);
                dispatch({type: PropertyTypes.PROPERTY_FIELD_DELETED, data: {fieldId: linkedField.id}});
            }
            await saveDeleteField(templateField.id);
            dispatch({type: PropertyTypes.PROPERTY_FIELD_DELETED, data: {fieldId: templateField.id}});

            setExistingField(null);
            setExistingLinkedField(null);
            setInitialEnabled(false);
            setInitialLevels([]);
            setLevels([]);
            setPresetId(PRESET_EMPTY);
            setCachedCustomLevels([]);
            setGlobalBanner({...DEFAULT_GLOBAL_BANNER});
            setInitialGlobalBanner({...DEFAULT_GLOBAL_BANNER});
        }
    }, [enabled, existingField, existingLinkedField, levels, globalBanner, dispatch]);

    const handleSave = useCallback(async () => {
        setSaveError(undefined);

        const validationError = validate();
        if (validationError) {
            setSaveError(validationError);
            return;
        }

        setSaving(true);
        try {
            await persistLevels();
            dispatch(setNavigationBlocked(false));
        } catch (err: unknown) {
            const clientErr = err as ClientError;
            if (clientErr.status_code === 409) {
                setSaveError(formatMessage(msg.errorDeleteHasDependents));
            } else {
                const message = err instanceof Error ? err.message : 'An error occurred while saving';
                setSaveError(message);
            }
        } finally {
            setSaving(false);
        }
    }, [validate, persistLevels, dispatch]);

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
                                    isDisabled={disabled}
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
                        disabled={disabled}
                        onChange={handleGlobalBannerChange}
                    />
                )}
            </AdminWrapper>

            <SaveChangesPanel
                saving={saving}
                saveNeeded={hasChanges}
                onClick={handleSave}
                serverError={saveError}
                isDisabled={saving || disabled}
                savingMessage={formatMessage({id: 'admin.classification_markings.saving', defaultMessage: 'Saving...'})}
            />

            <ConfirmModal
                show={confirmPresetSwitch !== null}
                title={formatMessage({id: 'admin.classification_markings.preset_switch.title', defaultMessage: 'Change classification preset?'})}
                message={formatMessage({id: 'admin.classification_markings.preset_switch.message', defaultMessage: 'Changing the classification preset will affect all existing classifications across the system. Any channels, files, or other resources marked with the current classification levels may lose their markings.'})}
                confirmButtonText={formatMessage({id: 'admin.classification_markings.preset_switch.confirm', defaultMessage: 'Change preset'})}
                confirmButtonVariant='destructive'
                onConfirm={handleConfirmPresetSwitch}
                onCancel={handleCancelPresetSwitch}
                onExited={handleCancelPresetSwitch}
            />
        </div>
    );
}
