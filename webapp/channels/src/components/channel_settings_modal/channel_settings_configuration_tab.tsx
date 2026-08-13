// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {PropertyTypes} from 'mattermost-redux/action_types';
import {patchChannel} from 'mattermost-redux/actions/channels';
import {resetReloadPostsInChannel} from 'mattermost-redux/actions/posts';
import {fetchChannelRemotes} from 'mattermost-redux/actions/shared_channels';
import {Client4} from 'mattermost-redux/client';
import {Permissions} from 'mattermost-redux/constants';
import {isChannelAutotranslated as isChannelAutotranslatedSelector} from 'mattermost-redux/selectors/entities/channels';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getRemotesForChannel} from 'mattermost-redux/selectors/entities/shared_channels';

import {ColorSwatch, LevelOptionLabel} from 'components/admin_console/classification_markings/classification_markings_styled';
import {
    CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
    CLASSIFICATIONS_GROUP_NAME,
} from 'components/admin_console/classification_markings/utils';
import {classificationPresetDropdownStyles} from 'components/admin_console/classification_markings/utils/preset_dropdown_styles';
import ColorInput from 'components/color_input';
import useChannelClassificationBanner from 'components/common/hooks/useChannelClassificationBanner';
import useClassificationMarkings from 'components/common/hooks/useClassificationMarkings';
import useDidUpdate from 'components/common/hooks/useDidUpdate';
import ConfirmModal from 'components/confirm_modal';
import DropdownInput from 'components/dropdown_input';
import type {ValueType} from 'components/dropdown_input';
import SectionNotice from 'components/section_notice';
import type {TextboxElement} from 'components/textbox';
import Toggle from 'components/toggle';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';
import type {SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';
import SaveChangesPanel from 'components/widgets/modals/components/save_changes_panel';

import type {GlobalState} from 'types/store';

import ShareChannelWithWorkspaces from './share_channel_with_workspaces';
import type {WorkspaceWithStatus} from './share_channel_with_workspaces/types';

import './channel_settings_configuration_tab.scss';

export const CHANNEL_BANNER_MAX_CHARACTER_LIMIT = 1024;
export const CHANNEL_BANNER_MIN_CHARACTER_LIMIT = 0;

const DEFAULT_CHANNEL_BANNER = {
    enabled: false,
    background_color: '#DDDDDD',
    text: '',
};

type Props = {
    channel: Channel;
    setAreThereUnsavedChanges?: (unsaved: boolean) => void;
    showTabSwitchError?: boolean;
    canManageChannelTranslation?: boolean;
    canManageBanner?: boolean;
    canManageSharedChannels?: boolean;
    canManageJoinLeaveMessages?: boolean;
};

function bannerHasChanges(originalBannerInfo: Channel['banner_info'], updatedBannerInfo: Channel['banner_info']): boolean {
    return (originalBannerInfo?.text?.trim() || '') !== (updatedBannerInfo?.text?.trim() || '') ||
        (originalBannerInfo?.background_color?.trim() || '') !== (updatedBannerInfo?.background_color?.trim() || '') ||
        originalBannerInfo?.enabled !== updatedBannerInfo?.enabled;
}

type SharingSnapshot = {
    enabled: boolean;
    remotes: WorkspaceWithStatus[];
};

function remoteIdsKey(remotes: Array<{remote_id?: string; name?: string}>) {
    return remotes.map((r) => r.remote_id || r.name).sort().join(',');
}

function copyRemotes(remotes: WorkspaceWithStatus[]) {
    return remotes.map((r) => ({...r}));
}

function remotesWithoutPendingSave(remotes: WorkspaceWithStatus[]) {
    return remotes.map((remote) => {
        const saved = {...remote};
        delete saved.pendingSave;
        return saved;
    });
}

function ChannelSettingsConfigurationTab({
    channel,
    setAreThereUnsavedChanges,
    showTabSwitchError,
    canManageChannelTranslation,
    canManageBanner,
    canManageSharedChannels = false,
    canManageJoinLeaveMessages = false,
}: Props) {
    const {formatMessage, formatList} = useIntl();
    const dispatch = useDispatch();

    const [formError, setFormError] = useState('');
    const [requireConfirm, setRequireConfirm] = useState(false);
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();
    const showSaveChangesPanel = requireConfirm || saveChangesPanelState === 'saved';

    const resetFormErrors = useCallback(() => {
        setFormError('');
        setSaveChangesPanelState(undefined);
    }, []);

    // Channel banner section
    const bannerHeading = formatMessage({id: 'channel_banner.label.name', defaultMessage: 'Channel Banner'});
    const bannerSubHeading = formatMessage({id: 'channel_banner.label.subtext', defaultMessage: 'When enabled, a customized banner will display at the top of the channel.'});
    const bannerTextSettingTitle = formatMessage({id: 'channel_banner.banner_text.label', defaultMessage: 'Banner text'});
    const bannerColorSettingTitle = formatMessage({id: 'channel_banner.banner_color.label', defaultMessage: 'Banner color'});
    const bannerTextPlaceholder = formatMessage({id: 'channel_banner.banner_text.placeholder', defaultMessage: 'Channel banner text'});

    const initialBannerInfo = channel.banner_info || DEFAULT_CHANNEL_BANNER;
    const [showBannerTextPreview, setShowBannerTextPreview] = useState(false);
    const [updatedChannelBanner, setUpdatedChannelBanner] = useState(initialBannerInfo);
    const [characterLimitExceeded, setCharacterLimitExceeded] = useState(false);
    const hasBannerChanges = bannerHasChanges(initialBannerInfo, updatedChannelBanner);

    const classificationBanner = useChannelClassificationBanner(channel.id);

    const classification = useClassificationMarkings();
    const canManageChannelRoles = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, Permissions.MANAGE_CHANNEL_ROLES),
    );
    const canManageClassification = classification.available && canManageChannelRoles;
    const [classificationEnabled, setClassificationEnabled] = useState(classificationBanner.hasClassification);
    const [selectedClassificationId, setSelectedClassificationId] = useState(classificationBanner.classificationId || '');
    const bannerLockedByClassification = classificationEnabled && Boolean(selectedClassificationId);

    const classificationOptions = useMemo(() => {
        return classification.levels.
            filter((l) => l.name.trim() !== '').
            map((l) => ({value: l.id, label: l.name.trim(), color: l.color}));
    }, [classification.levels]);

    const selectedClassificationOption = useMemo(() => {
        return classificationOptions.find((o) => o.value === selectedClassificationId);
    }, [classificationOptions, selectedClassificationId]);

    const formatClassificationOptionLabel = useCallback((option: ValueType) => {
        const levelOption = option as ValueType & {color: string};
        return (
            <LevelOptionLabel>
                <ColorSwatch style={{backgroundColor: levelOption.color}}/>
                <span>{levelOption.label}</span>
            </LevelOptionLabel>
        );
    }, []);

    const selectedClassificationColor = useMemo((): string => {
        const level = classification.levels.find((l) => l.id === selectedClassificationId);
        return level?.color || '';
    }, [classification.levels, selectedClassificationId]);

    const initialClassificationState = useMemo(() => ({
        enabled: classificationBanner.hasClassification,
        classificationId: classificationBanner.classificationId || '',
    }), [classificationBanner.hasClassification, classificationBanner.classificationId]);

    const hasClassificationChanges = classificationEnabled !== initialClassificationState.enabled ||
        (classificationEnabled && selectedClassificationId !== initialClassificationState.classificationId);

    const handleClassificationToggle = useCallback(() => {
        setClassificationEnabled((prev) => {
            if (!prev) {
                const lowestRank = classification.levels[0];
                if (lowestRank) {
                    setSelectedClassificationId(lowestRank.id);
                    setUpdatedChannelBanner((banner) => ({
                        ...banner,
                        text: `**${lowestRank.name}**`,
                        background_color: lowestRank.color,
                    }));
                }
            }
            return !prev;
        });
    }, [classification.levels]);

    const handleClassificationLevelChange = useCallback((selected: ValueType) => {
        setSelectedClassificationId(selected.value);
        const level = classification.levels.find((l) => l.id === selected.value);
        if (level) {
            setUpdatedChannelBanner((prev) => ({
                ...prev,
                text: `**${level.name}**`,
                background_color: level.color,
            }));
        }
    }, [classification.levels]);

    const handleBannerToggle = useCallback(() => {
        const newValue = !updatedChannelBanner.enabled;
        const toUpdate = {
            ...updatedChannelBanner,
            enabled: newValue,
        };
        if (!newValue) {
            toUpdate.text = initialBannerInfo.text;
            toUpdate.background_color = initialBannerInfo.background_color;
        }

        setUpdatedChannelBanner(toUpdate);
    }, [initialBannerInfo, updatedChannelBanner]);

    const handleBannerTextChange = useCallback((e: React.ChangeEvent<TextboxElement>) => {
        const newValue = e.target.value;
        setUpdatedChannelBanner((prev) => ({
            ...prev,
            text: newValue,
        }));

        if (newValue.trim().length > CHANNEL_BANNER_MAX_CHARACTER_LIMIT) {
            setFormError(formatMessage({
                id: 'channel_settings.save_changes_panel.standard_error',
                defaultMessage: 'There are errors in the form above',
            }));
            setCharacterLimitExceeded(true);
        } else if (newValue.trim().length <= CHANNEL_BANNER_MIN_CHARACTER_LIMIT) {
            setFormError(formatMessage({
                id: 'channel_settings.save_changes_panel.banner_text.required_error',
                defaultMessage: 'Channel banner text cannot be empty when enabled',
            }));
            setCharacterLimitExceeded(true);
        } else {
            resetFormErrors();
            setCharacterLimitExceeded(false);
        }
    }, [formatMessage, resetFormErrors]);

    const handleBannerColorChange = useCallback((color: string) => {
        setUpdatedChannelBanner((prev) => ({
            ...prev,
            background_color: color,
        }));

        if (color.trim()) {
            resetFormErrors();
        }
    }, [resetFormErrors]);

    const toggleBannerTextPreview = useCallback(() => setShowBannerTextPreview((show) => !show), []);

    // Auto-translation section
    const autoTranslationHeading = formatMessage({id: 'channel_translation.label.name', defaultMessage: 'Auto-translation'});
    const autoTranslationSubHeading = formatMessage({id: 'channel_translation.label.subtext', defaultMessage: 'When enabled, messages in this channel will be translated to members\' own languages. Members can opt-out of this from the channel menu to view the original message instead.'});

    const initialIsChannelAutotranslated = useSelector((state: GlobalState) => isChannelAutotranslatedSelector(state, channel.id));
    const [isChannelAutotranslated, setIsChannelAutotranslated] = useState(initialIsChannelAutotranslated);
    const hasAutoTranslationChanges = isChannelAutotranslated !== initialIsChannelAutotranslated;

    const handleAutoTranslationToggle = useCallback(async () => {
        setIsChannelAutotranslated((prev) => !prev);
    }, []);

    // Join/leave messages section
    const joinLeaveMessagesHeading = formatMessage({id: 'channel_settings.join_leave_messages.label.name', defaultMessage: 'Join/Leave System Messages'});
    const joinLeaveMessagesSubHeading = formatMessage({
        id: 'channel_settings.join_leave_messages.label.subtext',
        defaultMessage: 'When enabled, join and leave system messages are shown in this channel for all users. When disabled, they are hidden regardless of account-wide Advanced settings. Stored messages reappear if you turn this back on.',
    });

    const initialDisableJoinLeaveMessages = Boolean(channel.disable_join_leave_messages);
    const [disableJoinLeaveMessages, setDisableJoinLeaveMessages] = useState(initialDisableJoinLeaveMessages);
    const hasJoinLeaveMessagesChanges = disableJoinLeaveMessages !== initialDisableJoinLeaveMessages;

    const handleJoinLeaveMessagesToggle = useCallback(() => {
        setDisableJoinLeaveMessages((prev) => !prev);
    }, []);

    // Shared channels section
    const initialRemotes = useSelector((state: GlobalState) => getRemotesForChannel(state, channel.id));
    const userEditedSharingRef = useRef(false);

    const [savedSharing, setSavedSharing] = useState<SharingSnapshot>(() => ({
        enabled: (initialRemotes || []).length > 0,
        remotes: copyRemotes(initialRemotes || []),
    }));
    const [sharingEnabled, setSharingEnabled] = useState(savedSharing.enabled);
    const [workspaceRemotes, setWorkspaceRemotes] = useState<WorkspaceWithStatus[]>(() => copyRemotes(savedSharing.remotes));
    const [showRemoveSharingConfirmModal, setShowRemoveSharingConfirmModal] = useState(false);

    const hasWorkspaceChanges = sharingEnabled !== savedSharing.enabled ||
        remoteIdsKey(workspaceRemotes) !== remoteIdsKey(savedSharing.remotes);

    const applySharingSnapshot = useCallback((remotes: WorkspaceWithStatus[]) => {
        const copies = remotesWithoutPendingSave(copyRemotes(remotes));
        const enabled = copies.length > 0;
        setSavedSharing({enabled, remotes: copies});
        setSharingEnabled(enabled);
        setWorkspaceRemotes(copies);
    }, []);

    const commitSharingAfterSave = useCallback((remotes: WorkspaceWithStatus[]) => {
        applySharingSnapshot(remotes);
        userEditedSharingRef.current = false;
    }, [applySharingSnapshot]);

    const handleSharingToggle = useCallback((enabled: boolean) => {
        userEditedSharingRef.current = true;
        setSharingEnabled(enabled);
    }, []);

    const handleWorkspaceRemotesChange = useCallback((update: React.SetStateAction<WorkspaceWithStatus[]>) => {
        userEditedSharingRef.current = true;
        setWorkspaceRemotes(update);
    }, []);

    const confirmModalMessages = useMemo(() => {
        const workspaceRemoteIdSet = new Set(workspaceRemotes.map((r) => r.remote_id || r.name));
        const remotesToRemove = savedSharing.remotes.filter((r) => !workspaceRemoteIdSet.has(r.remote_id || r.name));
        const channelDisplayName = channel.display_name || channel.name;
        const removeCount = remotesToRemove.length;
        const workspaceNames = remotesToRemove.map((r) => r.display_name || r.name || r.remote_id || '');
        const workspaceNamesFormatted = formatList(workspaceNames, {type: 'conjunction'});

        const removeSharingModalTitle = formatMessage(
            {
                id: 'channel_settings.remove_sharing_confirm.title',
                defaultMessage: 'Remove sharing from {count, plural, one {this connection} other {these connections}}?',
            },
            {count: removeCount},
        );

        const removeSharingModalMessage = formatMessage(
            {
                id: 'channel_settings.remove_sharing_confirm.message',
                defaultMessage: 'This will unshare the channel <b>{channelName}</b> with the <b>{workspaceNames}</b> connected {count, plural, one {workspace} other {workspaces}}. Are you sure you want to unshare?',
            },
            {
                count: removeCount,
                channelName: channelDisplayName,
                workspaceNames: workspaceNamesFormatted,
                b: (chunks: React.ReactNode) => <b>{chunks}</b>,
            },
        );

        return {
            removeSharingModalTitle,
            removeSharingModalMessage,
        };
    }, [
        channel.display_name,
        channel.name,
        formatList,
        formatMessage,
        savedSharing.remotes,
        workspaceRemotes,
    ]);

    useEffect(() => {
        if (canManageSharedChannels) {
            dispatch(fetchChannelRemotes(channel.id, true));
        }
    }, [canManageSharedChannels, channel.id, dispatch]);

    useDidUpdate(() => {
        if (!canManageSharedChannels || userEditedSharingRef.current) {
            return;
        }

        const fromServer = (initialRemotes || []).map((r) => ({...r}));
        applySharingSnapshot(fromServer);
    }, [applySharingSnapshot, canManageSharedChannels, initialRemotes]);

    const handleCancelRemoveSharing = useCallback(() => {
        setShowRemoveSharingConfirmModal(false);
    }, []);

    // Common
    const hasUnsavedChanges = hasBannerChanges ||
        hasAutoTranslationChanges ||
        hasClassificationChanges ||
        (canManageJoinLeaveMessages && hasJoinLeaveMessagesChanges) ||
        (canManageSharedChannels && hasWorkspaceChanges);

    useEffect(() => {
        if (hasUnsavedChanges) {
            return;
        }

        setClassificationEnabled(classificationBanner.hasClassification);
        setSelectedClassificationId(classificationBanner.classificationId || '');

        if (classificationBanner.hasClassification && classificationBanner.classificationBanner) {
            setUpdatedChannelBanner((prev) => ({
                ...prev,
                text: classificationBanner.classificationBanner?.text ?? prev.text,
                background_color: classificationBanner.classificationBanner?.background_color || prev.background_color || DEFAULT_CHANNEL_BANNER.background_color,
            }));
        }
    }, [
        classificationBanner.hasClassification,
        classificationBanner.classificationId,
        classificationBanner.classificationBanner,
        hasUnsavedChanges,
    ]);

    useEffect(() => {
        setRequireConfirm(hasUnsavedChanges);
        setAreThereUnsavedChanges?.(hasUnsavedChanges);
        if (hasUnsavedChanges) {
            setSaveChangesPanelState((current) => (current === 'saved' ? undefined : current));
        }
    }, [hasUnsavedChanges, setAreThereUnsavedChanges]);

    const handleServerError = useCallback((err: ServerError) => {
        const errorMsg = err.message || formatMessage({id: 'channel_settings.unknown_error', defaultMessage: 'Something went wrong.'});
        setFormError(errorMsg);
    }, [formatMessage]);

    const handleSave = useCallback(async (): Promise<boolean> => {
        if (!channel) {
            return false;
        }

        if (updatedChannelBanner.enabled && !updatedChannelBanner.text?.trim()) {
            setFormError(formatMessage({
                id: 'channel_settings.error_banner_text_required',
                defaultMessage: 'Banner text is required',
            }));
            return false;
        }

        if (updatedChannelBanner.enabled && !updatedChannelBanner.background_color?.trim()) {
            setFormError(formatMessage({
                id: 'channel_settings.error_banner_color_required',
                defaultMessage: 'Banner color is required',
            }));
            return false;
        }

        const updated: Partial<Channel> = {};

        if (bannerHasChanges(initialBannerInfo, updatedChannelBanner)) {
            updated.banner_info = {
                text: updatedChannelBanner.text?.trim() || '',
                background_color: updatedChannelBanner.background_color?.trim() || '',
                enabled: updatedChannelBanner.enabled,
            };
        }

        if (isChannelAutotranslated !== initialIsChannelAutotranslated) {
            updated.autotranslation = isChannelAutotranslated;
        }

        if (hasClassificationChanges && classificationEnabled && selectedClassificationId) {
            updated.banner_info = {
                text: updatedChannelBanner.text?.trim() || '',
                background_color: updatedChannelBanner.background_color?.trim() || '',
                enabled: updatedChannelBanner.enabled,
            };
        }

        if (canManageJoinLeaveMessages && hasJoinLeaveMessagesChanges) {
            updated.disable_join_leave_messages = disableJoinLeaveMessages;
        }

        if (hasAutoTranslationChanges || hasBannerChanges || (hasClassificationChanges && classificationEnabled && selectedClassificationId) || (canManageJoinLeaveMessages && hasJoinLeaveMessagesChanges)) {
            const {error} = await dispatch(patchChannel(channel.id, updated));
            if (error) {
                handleServerError(error as ServerError);
                return false;
            }

            if (canManageJoinLeaveMessages && hasJoinLeaveMessagesChanges) {
                await dispatch(resetReloadPostsInChannel(channel.id));
            }
        }

        if (hasClassificationChanges && classification.channelField) {
            if (classificationEnabled && selectedClassificationId) {
                try {
                    const values = await Client4.patchPropertyValues(
                        CLASSIFICATIONS_GROUP_NAME,
                        CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
                        channel.id,
                        [{field_id: classification.channelField.id, value: selectedClassificationId}],
                    );
                    dispatch({type: PropertyTypes.RECEIVED_PROPERTY_VALUES, data: {values}});
                } catch (err) {
                    handleServerError(err as ServerError);
                    return false;
                }
            } else if (!classificationEnabled && initialClassificationState.enabled) {
                try {
                    await Client4.patchPropertyValues(
                        CLASSIFICATIONS_GROUP_NAME,
                        CLASSIFICATIONS_CHANNEL_OBJECT_TYPE,
                        channel.id,
                        [{field_id: classification.channelField.id, value: null}],
                    );
                    dispatch({type: PropertyTypes.PROPERTY_VALUE_DELETED, data: {targetId: channel.id, fieldId: classification.channelField.id}});
                } catch (err) {
                    handleServerError(err as ServerError);
                    return false;
                }
            }
        }

        if (canManageSharedChannels && hasWorkspaceChanges) {
            const savedIds = new Set(savedSharing.remotes.map((r) => r.remote_id || r.name));
            const currentIds = new Set(workspaceRemotes.map((r) => r.remote_id || r.name));

            const toAdd = workspaceRemotes.filter((w) => w.pendingSave).map((w) => w.remote_id || w.name);
            const toRemove = Array.from(savedIds).filter((id) => !currentIds.has(id));

            let errorCount = 0;
            let lastError: ServerError | undefined;

            for (const remoteId of toAdd) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    await Client4.sharedChannelRemoteInvite(remoteId, channel.id);
                } catch (err) {
                    lastError = err;
                    errorCount++;
                }
            }
            for (const remoteId of toRemove) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    await Client4.sharedChannelRemoteUninvite(remoteId, channel.id);
                } catch (err) {
                    lastError = err;
                    errorCount++;
                }
            }
            const fetchResult = await dispatch(fetchChannelRemotes(channel.id, true));

            if (errorCount === 1) {
                handleServerError(lastError as ServerError);
            }
            if (errorCount > 1) {
                setFormError(formatMessage({
                    id: 'channel_settings.sharing_errors',
                    defaultMessage: 'There has been errors while sharing the channel with some workspaces. Please try again.',
                }));
            }

            if (errorCount === 0) {
                const refreshedRemotes = (fetchResult as {data?: WorkspaceWithStatus[]})?.data ?? workspaceRemotes;
                commitSharingAfterSave(refreshedRemotes);
            }

            return errorCount === 0;
        }

        return true;
    }, [
        canManageSharedChannels,
        canManageJoinLeaveMessages,
        channel,
        classification.channelField,
        classificationEnabled,
        dispatch,
        formatMessage,
        handleServerError,
        hasAutoTranslationChanges,
        hasBannerChanges,
        hasClassificationChanges,
        hasJoinLeaveMessagesChanges,
        hasWorkspaceChanges,
        initialBannerInfo,
        initialClassificationState.enabled,
        initialIsChannelAutotranslated,
        isChannelAutotranslated,
        disableJoinLeaveMessages,
        selectedClassificationId,
        savedSharing,
        updatedChannelBanner,
        workspaceRemotes,
        commitSharingAfterSave,
    ]);

    const performSave = useCallback(async () => {
        const success = await handleSave();
        if (!success) {
            setSaveChangesPanelState('error');
            return;
        }

        // Update local state with trimmed values after successful save
        setUpdatedChannelBanner((prev) => ({
            ...prev,
            text: prev.text?.trim() || '',
            background_color: prev.background_color?.trim() || '',
        }));

        resetFormErrors();
        setSaveChangesPanelState('saved');
    }, [handleSave, resetFormErrors]);

    const handleSaveChanges = useCallback(async () => {
        if (canManageSharedChannels && hasWorkspaceChanges) {
            const currentIds = new Set(workspaceRemotes.map((r) => r.remote_id || r.name));
            const remotesToRemove = savedSharing.remotes.filter(
                (r) => !currentIds.has(r.remote_id || r.name),
            );

            if (remotesToRemove.length > 0) {
                setShowRemoveSharingConfirmModal(true);
                return;
            }
        }

        await performSave();
    }, [canManageSharedChannels, hasWorkspaceChanges, performSave, savedSharing.remotes, workspaceRemotes]);

    const handleConfirmRemoveSharing = useCallback(async () => {
        setShowRemoveSharingConfirmModal(false);
        await performSave();
    }, [performSave]);

    const handleCancel = useCallback(() => {
        setRequireConfirm(false);
        setSaveChangesPanelState(undefined);
        setShowBannerTextPreview(false);

        setUpdatedChannelBanner(initialBannerInfo);
        setIsChannelAutotranslated(initialIsChannelAutotranslated);
        setDisableJoinLeaveMessages(initialDisableJoinLeaveMessages);
        setFormError('');
        setSaveChangesPanelState(undefined);
        setCharacterLimitExceeded(false);

        setClassificationEnabled(initialClassificationState.enabled);
        setSelectedClassificationId(initialClassificationState.classificationId);

        if (canManageSharedChannels) {
            setSharingEnabled(savedSharing.enabled);
            setWorkspaceRemotes(copyRemotes(savedSharing.remotes));
            userEditedSharingRef.current = false;
        }
    }, [canManageSharedChannels, initialBannerInfo, initialClassificationState, initialDisableJoinLeaveMessages, initialIsChannelAutotranslated, savedSharing]);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState(undefined);
        setRequireConfirm(false);
    }, []);

    const classificationFormInvalid = classificationEnabled && !selectedClassificationId;
    const hasErrors = Boolean(formError) ||
        characterLimitExceeded ||
        classificationFormInvalid ||
        showTabSwitchError;

    return (
        <div
            className={`ChannelSettingsModal__configurationTab${showSaveChangesPanel ? ' ChannelSettingsModal__configurationTab--with-save-panel' : ''}`}
            data-testid='channel-settings-configuration-tab'
        >
            {canManageSharedChannels && (
                <>
                    <ConfirmModal
                        id='removeSharingConfirmModal'
                        show={showRemoveSharingConfirmModal}
                        title={confirmModalMessages.removeSharingModalTitle}
                        message={confirmModalMessages.removeSharingModalMessage}
                        confirmButtonText={formatMessage({
                            id: 'channel_settings.remove_sharing_confirm.confirm',
                            defaultMessage: 'Yes, unshare',
                        })}
                        cancelButtonText={formatMessage({
                            id: 'channel_settings.remove_sharing_confirm.cancel',
                            defaultMessage: 'Cancel',
                        })}
                        onConfirm={handleConfirmRemoveSharing}
                        onCancel={handleCancelRemoveSharing}
                        isStacked={true}
                    />
                    <ShareChannelWithWorkspaces
                        remotes={workspaceRemotes}
                        initialRemotes={savedSharing.remotes}
                        onRemotesChange={handleWorkspaceRemotesChange}
                        enabled={sharingEnabled}
                        onToggle={handleSharingToggle}
                    />
                </>
            )}

            {canManageSharedChannels && (canManageClassification || canManageBanner) && (
                <div className='ChannelSettingsModal__configurationTab__configurationDivider'/>
            )}

            {canManageClassification && (
                <>
                    <div className='channel_banner_header'>
                        <div className='channel_banner_header__text'>
                            <label
                                className='Input_legend'
                                htmlFor='channelClassificationToggle'
                            >
                                <FormattedMessage
                                    id='channel_settings.classification.title'
                                    defaultMessage='Classification'
                                />
                            </label>
                            <label
                                className='Input_subheading'
                                htmlFor='channelClassificationToggle'
                            >
                                <FormattedMessage
                                    id='channel_settings.classification.description'
                                    defaultMessage='When enabled, a classification level can be set for the channel with configurable indicators.'
                                />
                            </label>
                        </div>

                        <div className='channel_banner_header__toggle'>
                            <Toggle
                                id='channelClassificationToggle'
                                ariaLabel={formatMessage({id: 'channel_settings.classification.title', defaultMessage: 'Classification'})}
                                size='btn-md'
                                disabled={false}
                                onToggle={handleClassificationToggle}
                                toggled={classificationEnabled}
                                tabIndex={0}
                                toggleClassName='btn-toggle-primary'
                            />
                        </div>
                    </div>

                    {classificationEnabled && (
                        <div className='channel_banner_section_body'>
                            <SectionNotice
                                type='warning'
                                iconOverride='icon-information-outline'
                                title={
                                    <FormattedMessage
                                        id='admin.classification_markings.notice.title'
                                        defaultMessage='Classification markings are informational only'
                                    />
                                }
                                text={formatMessage({id: 'admin.classification_markings.notice.body', defaultMessage: 'Markings are not tied to access control decisions at this time and are for display purposes only.'})}
                            />

                            <div className='setting_section'>
                                <span className='setting_title'>
                                    <FormattedMessage
                                        id='channel_settings.classification.level_label'
                                        defaultMessage='Classification level'
                                    />
                                </span>
                                <div className='setting_body'>
                                    <DropdownInput
                                        name='channelClassificationLevel'
                                        testId='channelClassificationLevel'
                                        options={classificationOptions}
                                        value={selectedClassificationOption}
                                        onChange={handleClassificationLevelChange}
                                        isClearable={false}
                                        required={true}
                                        styles={classificationPresetDropdownStyles}
                                        formatOptionLabel={formatClassificationOptionLabel}
                                        menuPortalTarget={document.body}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {canManageClassification && canManageBanner && (
                <div className='ChannelSettingsModal__configurationTab__configurationDivider'/>
            )}

            {canManageBanner && (
                <>
                    <div className='channel_banner_header'>
                        <div className='channel_banner_header__text'>
                            <label
                                className='Input_legend'
                                aria-label={bannerHeading}
                            >
                                {bannerHeading}
                            </label>
                            <label
                                className='Input_subheading'
                                aria-label={bannerHeading}
                            >
                                {bannerSubHeading}
                            </label>
                        </div>

                        <div className='channel_banner_header__toggle'>
                            <Toggle
                                id='channelBannerToggle'
                                ariaLabel={bannerHeading}
                                size='btn-md'
                                disabled={bannerLockedByClassification}
                                onToggle={handleBannerToggle}
                                toggled={bannerLockedByClassification || updatedChannelBanner.enabled}
                                tabIndex={0}
                                toggleClassName='btn-toggle-primary'
                            />
                        </div>
                    </div>

                    {
                        (bannerLockedByClassification || updatedChannelBanner.enabled) &&
                        <div className='channel_banner_section_body'>
                            {/*Banner text section*/}
                            <div className='setting_section'>
                                <span
                                    className='setting_title'
                                    aria-label={bannerTextSettingTitle}
                                >
                                    {bannerTextSettingTitle}
                                </span>

                                <div className='setting_body'>
                                    <AdvancedTextbox
                                        id='channel_banner_banner_text_textbox'
                                        value={updatedChannelBanner.text!}
                                        channelId={channel.id}
                                        onKeyPress={() => {}}
                                        showCharacterCount={true}
                                        useChannelMentions={false}
                                        onChange={handleBannerTextChange}
                                        preview={showBannerTextPreview}
                                        togglePreview={toggleBannerTextPreview}
                                        hasError={characterLimitExceeded}
                                        createMessage={bannerTextPlaceholder}
                                        maxLength={CHANNEL_BANNER_MAX_CHARACTER_LIMIT}
                                        minLength={CHANNEL_BANNER_MIN_CHARACTER_LIMIT}
                                    />
                                </div>
                            </div>

                            {/*Banner background color section*/}
                            <div className='setting_section'>
                                <span
                                    className='setting_title'
                                    aria-label={bannerColorSettingTitle}
                                >
                                    {bannerColorSettingTitle}
                                </span>

                                <div className='setting_body'>
                                    <ColorInput
                                        id='channel_banner_banner_background_color_picker'
                                        onChange={handleBannerColorChange}
                                        value={bannerLockedByClassification ? selectedClassificationColor : (updatedChannelBanner.background_color || '')}
                                        isDisabled={bannerLockedByClassification}
                                    />
                                </div>
                            </div>
                        </div>
                    }
                </>
            )}

            {(canManageSharedChannels || canManageClassification || canManageBanner) && canManageJoinLeaveMessages && (
                <div className='ChannelSettingsModal__configurationTab__configurationDivider'/>
            )}

            {canManageJoinLeaveMessages && (
                <div className='channel_join_leave_messages_header'>
                    <div className='channel_join_leave_messages_header__text'>
                        <label
                            className='Input_legend'
                            aria-label={joinLeaveMessagesHeading}
                        >
                            {joinLeaveMessagesHeading}
                        </label>
                        <label
                            className='Input_subheading'
                            aria-label={joinLeaveMessagesSubHeading}
                        >
                            {joinLeaveMessagesSubHeading}
                        </label>
                    </div>

                    <div className='channel_join_leave_messages_header__toggle'>
                        <Toggle
                            id='channelJoinLeaveMessagesToggle'
                            ariaLabel={joinLeaveMessagesHeading}
                            size='btn-md'
                            disabled={false}
                            onToggle={handleJoinLeaveMessagesToggle}
                            toggled={!disableJoinLeaveMessages}
                            tabIndex={0}
                            toggleClassName='btn-toggle-primary'
                        />
                    </div>
                </div>
            )}

            {(canManageSharedChannels || canManageClassification || canManageBanner || canManageJoinLeaveMessages) && canManageChannelTranslation && (
                <div className='ChannelSettingsModal__configurationTab__configurationDivider'/>
            )}

            {canManageChannelTranslation && (
                <div className='channel_translation_header'>
                    <div className='channel_translation_header__text'>
                        <label
                            className='Input_legend'
                            aria-label={autoTranslationHeading}
                        >
                            {autoTranslationHeading}
                        </label>
                        <label
                            className='Input_subheading'
                            aria-label={autoTranslationSubHeading}
                        >
                            {autoTranslationSubHeading}
                        </label>
                    </div>

                    <div className='channel_translation_header__toggle'>
                        <Toggle
                            id='channelTranslationToggle'
                            ariaLabel={autoTranslationHeading}
                            size='btn-md'
                            disabled={false}
                            onToggle={handleAutoTranslationToggle}
                            toggled={isChannelAutotranslated}
                            tabIndex={0}
                            toggleClassName='btn-toggle-primary'
                        />
                    </div>
                </div>
            )}

            {showSaveChangesPanel && (
                <SaveChangesPanel
                    handleSubmit={handleSaveChanges}
                    handleCancel={handleCancel}
                    handleClose={handleClose}
                    tabChangeError={hasErrors}
                    state={hasErrors ? 'error' : saveChangesPanelState}
                    customErrorMessage={formError}
                    cancelButtonText={formatMessage({
                        id: 'channel_settings.save_changes_panel.reset',
                        defaultMessage: 'Reset',
                    })}
                />
            )}
        </div>
    );
}

export default ChannelSettingsConfigurationTab;
