// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {patchChannel} from 'mattermost-redux/actions/channels';
import {fetchChannelRemotes} from 'mattermost-redux/actions/shared_channels';
import {Client4} from 'mattermost-redux/client';
import {isChannelAutotranslated as isChannelAutotranslatedSelector} from 'mattermost-redux/selectors/entities/channels';
import {getRemotesForChannel} from 'mattermost-redux/selectors/entities/shared_channels';

import ColorInput from 'components/color_input';
import useDidUpdate from 'components/common/hooks/useDidUpdate';
import ConfirmModal from 'components/confirm_modal';
import type {TextboxElement} from 'components/textbox';
import Toggle from 'components/toggle';
import AdvancedTextbox from 'components/widgets/advanced_textbox/advanced_textbox';
import type {SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';
import SaveChangesPanel from 'components/widgets/modals/components/save_changes_panel';

import type {GlobalState} from 'types/store';

import ShareChannelWithWorkspaces from './share_channel_with_workspaces';
import type {WorkspaceWithStatus} from './share_channel_with_workspaces/types';

import './channel_settings_configuration_tab.scss';

const CHANNEL_BANNER_MAX_CHARACTER_LIMIT = 1024;
const CHANNEL_BANNER_MIN_CHARACTER_LIMIT = 0;

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
}

function bannerHasChanges(originalBannerInfo: Channel['banner_info'], updatedBannerInfo: Channel['banner_info']): boolean {
    return (originalBannerInfo?.text?.trim() || '') !== (updatedBannerInfo?.text?.trim() || '') ||
        (originalBannerInfo?.background_color?.trim() || '') !== (updatedBannerInfo?.background_color?.trim() || '') ||
        originalBannerInfo?.enabled !== updatedBannerInfo?.enabled;
}

function ChannelSettingsConfigurationTab({
    channel,
    setAreThereUnsavedChanges,
    showTabSwitchError,
    canManageChannelTranslation,
    canManageBanner,
    canManageSharedChannels = false,
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
    const initialRemotes = useSelector((state: GlobalState) => getRemotesForChannel(state, channel.id));
    const [isChannelAutotranslated, setIsChannelAutotranslated] = useState(initialIsChannelAutotranslated);
    const hasAutoTranslationChanges = isChannelAutotranslated !== initialIsChannelAutotranslated;

    const handleAutoTranslationToggle = useCallback(async () => {
        setIsChannelAutotranslated((prev) => !prev);
    }, []);

    // Shared channels section
    const [workspaceRemotes, setWorkspaceRemotes] = useState<WorkspaceWithStatus[]>(() =>
        (initialRemotes || []).map((r) => ({...r})),
    );
    const [showRemoveSharingConfirmModal, setShowRemoveSharingConfirmModal] = useState(false);

    // Key to force re-render the ShareChannelWithWorkspaces component
    // on reset and on save
    const [shareChannelKey, setShareChannelKey] = useState(Date.now());

    // Track the toggle state to detect when sharing is explicitly disabled on a channel
    // that has channel.shared=true but no remotes loaded (e.g. after page reload).
    // Both are frozen at mount time so they don't drift apart due to async channel hydration.
    const initialSharingEnabled = useRef(channel.shared || (initialRemotes || []).length > 0);
    const [sharingEnabled, setSharingEnabled] = useState(channel.shared || (initialRemotes || []).length > 0);

    // Freeze initialRemoteIds in state and update it atomically with workspaceRemotes (in
    // useDidUpdate below) so that the two never diverge in the same render. If we computed
    // initialRemoteIds live from the Redux selector, a fetchChannelRemotes response could
    // update initialRemotes one render before useDidUpdate syncs workspaceRemotes, causing a
    // spurious hasWorkspaceChanges=true that triggers the "discard changes" dialog on close.
    const [frozenInitialRemoteIds, setFrozenInitialRemoteIds] = useState(
        () => (initialRemotes || []).map((r) => r.remote_id || r.name).sort().join(','),
    );
    const currentRemoteIds = workspaceRemotes.map((r) => r.remote_id || r.name).sort().join(',');
    const hasWorkspaceChanges = frozenInitialRemoteIds !== currentRemoteIds ||
        sharingEnabled !== initialSharingEnabled.current;

    const confirmModalMessages = useMemo(() => {
        const workspaceRemoteIdSet = new Set(workspaceRemotes.map((r) => r.remote_id || r.name));
        const remotesToRemove = (initialRemotes || []).filter((r) => !workspaceRemoteIdSet.has(r.remote_id || r.name));
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
        initialRemotes,
        workspaceRemotes,
    ]);

    useEffect(() => {
        if (canManageSharedChannels) {
            dispatch(fetchChannelRemotes(channel.id, true));
        }
    }, [canManageSharedChannels, channel.id, dispatch]);

    useDidUpdate(() => {
        if (initialRemotes && canManageSharedChannels) {
            // Update both frozen baseline and working copy atomically so they never diverge.
            setFrozenInitialRemoteIds(
                initialRemotes.map((r) => r.remote_id || r.name).sort().join(','),
            );
            setWorkspaceRemotes(initialRemotes.map((r) => ({...r})));
            initialSharingEnabled.current = initialRemotes.length > 0;
            if (initialRemotes.length > 0) {
                setSharingEnabled(true);
            }
        }
    }, [canManageSharedChannels, initialRemotes]);

    const handleCancelRemoveSharing = useCallback(() => {
        setShowRemoveSharingConfirmModal(false);
    }, []);

    // Common
    const hasUnsavedChanges = hasBannerChanges ||
        hasAutoTranslationChanges ||
        (canManageSharedChannels && hasWorkspaceChanges);

    useEffect(() => {
        setRequireConfirm(hasUnsavedChanges);
        setAreThereUnsavedChanges?.(hasUnsavedChanges);
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

        if (hasAutoTranslationChanges || hasBannerChanges) {
            const {error} = await dispatch(patchChannel(channel.id, updated));
            if (error) {
                handleServerError(error as ServerError);
                return false;
            }
        }

        if (canManageSharedChannels && hasWorkspaceChanges) {
            const initialIds = new Set((initialRemotes || []).map((r) => r.remote_id || r.name));
            const currentIds = new Set(workspaceRemotes.map((r) => r.remote_id || r.name));

            const toAdd = workspaceRemotes.filter((w) => w.pendingSave).map((w) => w.remote_id || w.name);
            const toRemove = Array.from(initialIds).filter((id) => !currentIds.has(id));

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
            await dispatch(fetchChannelRemotes(channel.id, true));
            setShareChannelKey(Date.now());

            if (errorCount === 1) {
                handleServerError(lastError as ServerError);
            }
            if (errorCount > 1) {
                setFormError(formatMessage({
                    id: 'channel_settings.sharing_errors',
                    defaultMessage: 'There has been errors while sharing the channel with some workspaces. Please try again.',
                }));
            }
            return errorCount === 0;
        }

        return true;
    }, [
        canManageSharedChannels,
        channel,
        dispatch,
        formatMessage,
        handleServerError,
        hasAutoTranslationChanges,
        hasBannerChanges,
        hasWorkspaceChanges,
        initialBannerInfo,
        initialIsChannelAutotranslated,
        initialRemotes,
        isChannelAutotranslated,
        updatedChannelBanner,
        workspaceRemotes,
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
            const remotesToRemove = (initialRemotes || []).filter(
                (r) => !currentIds.has(r.remote_id || r.name),
            );

            if (remotesToRemove.length > 0) {
                setShowRemoveSharingConfirmModal(true);
                return;
            }
        }

        await performSave();
    }, [canManageSharedChannels, hasWorkspaceChanges, initialRemotes, performSave, workspaceRemotes]);

    const handleConfirmRemoveSharing = useCallback(async () => {
        setShowRemoveSharingConfirmModal(false);
        await performSave();
    }, [performSave]);

    const handleCancel = useCallback(() => {
        setRequireConfirm(false);
        setSaveChangesPanelState(undefined);
        setShowBannerTextPreview(false);

        setUpdatedChannelBanner(initialBannerInfo);
        setFormError('');
        setSaveChangesPanelState(undefined);
        setCharacterLimitExceeded(false);
        if (canManageSharedChannels) {
            setSharingEnabled(initialSharingEnabled.current);
            if (initialRemotes) {
                setWorkspaceRemotes(initialRemotes.map((r) => ({...r})));
                setShareChannelKey(Date.now());
            }
        }
    }, [canManageSharedChannels, initialBannerInfo, initialRemotes]);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState(undefined);
        setRequireConfirm(false);
    }, []);

    const hasErrors = Boolean(formError) ||
        characterLimitExceeded ||
        showTabSwitchError;

    return (
        <div className='ChannelSettingsModal__configurationTab'>
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
                        key={shareChannelKey}
                        remotes={workspaceRemotes}
                        initialRemotes={initialRemotes}
                        onRemotesChange={setWorkspaceRemotes}
                        enabled={sharingEnabled}
                        onToggle={setSharingEnabled}
                    />
                </>
            )}

            {canManageSharedChannels && canManageBanner && (
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
                                disabled={false}
                                onToggle={handleBannerToggle}
                                toggled={updatedChannelBanner.enabled}
                                tabIndex={0}
                                toggleClassName='btn-toggle-primary'
                            />
                        </div>
                    </div>

                    {
                        updatedChannelBanner.enabled &&
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
                                        value={updatedChannelBanner.background_color || ''}
                                    />
                                </div>
                            </div>
                        </div>
                    }
                </>
            )}

            {(canManageSharedChannels || canManageBanner) && canManageChannelTranslation && (
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
