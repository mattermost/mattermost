// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {
    useState,
    useRef,
    useEffect,
    useCallback,
} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel, ChannelType} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {patchChannel} from 'mattermost-redux/actions/channels';
import Permissions from 'mattermost-redux/constants/permissions';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';

import ConfirmModal from 'components/confirm_modal';
import PublicPrivateSelector from 'components/widgets/public-private-selector/public-private-selector';

import {focusElement} from 'utils/a11y_utils';
import Constants from 'utils/constants';
import {isKeyPressed, cmdOrCtrlPressed} from 'utils/keyboard';
import {stopTryNotificationRing} from 'utils/notification_sounds';

// Example: Redux selectors/actions for channel info

// Example: This might be your custom sidebar or a small subcomponent for tab links
import type {GlobalState} from 'types/store';

import ChannelSettingsSidebar from './channel_settings_sidebar';

// Types (if you’re using TypeScript)

// SCSS import
import './channel_settings_modal.scss';

type ChannelSettingsModalProps = {
    channelId: string;
    onExited: () => void;
    focusOriginElement?: string;
    isOpen: boolean;
};

enum ChannelSettingsTabs {
    INFO = 'info',
    CONFIGURATION = 'configuration',
    ARCHIVE = 'archive',
}

function ChannelSettingsModal(props: ChannelSettingsModalProps) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    // --- Redux / Data ---
    const channel = useSelector((state: GlobalState) => getChannel(state, props.channelId));
    const canConvertToPrivate = useSelector((state: GlobalState) =>
        haveITeamPermission(state, channel?.team_id ?? '', Permissions.CREATE_PRIVATE_CHANNEL),
    );
    const canConvertToPublic = useSelector((state: GlobalState) =>
        haveITeamPermission(state, channel?.team_id ?? '', Permissions.CREATE_PUBLIC_CHANNEL),
    );

    // --- UI State ---
    const [show, setShow] = useState(props.isOpen);
    const [enforceFocus, setEnforceFocus] = useState(true);

    // Active tab
    const [activeTab, setActiveTab] = useState<ChannelSettingsTabs>(ChannelSettingsTabs.INFO);

    // We track unsaved changes to prompt a confirm modal, like in UserSettingsModal
    const [requireConfirm, setRequireConfirm] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [customConfirmAction, setCustomConfirmAction] = useState<null |((doConfirm: () => void) => void)>(null);

    // The fields we allow editing
    const [displayName, setDisplayName] = useState(channel?.display_name ?? '');
    const [url, setURL] = useState(channel?.name ?? ''); // channel `name` is the URL slug
    const [purpose, setPurpose] = useState(channel?.purpose ?? '');
    const [header] = useState(channel?.header ?? '');
    const [channelType, setChannelType] = useState<ChannelType>(channel?.type as ChannelType ?? Constants.OPEN_CHANNEL as ChannelType);

    // For toggling URL editing
    const [isEditingURL, setIsEditingURL] = useState(false);

    // UI Feedback: errors, states
    const [urlError, setURLError] = useState('');
    const [serverError, setServerError] = useState('');
    const [purposeError, setPurposeError] = useState('');

    // Refs
    const modalBodyRef = useRef<HTMLDivElement>(null);

    // For checking unsaved changes, we can store the initial “loaded” values or do a direct comparison
    const hasUnsavedChanges = useCallback(() => {
        // Compare fields to their original values
        if (!channel) {
            return false;
        }
        return (
            displayName !== channel.display_name ||
            url !== channel.name ||
            purpose !== channel.purpose ||
            header !== channel.header ||
            channelType !== channel.type
        );
    }, [channel, displayName, url, purpose, header, channelType]);

    // Possibly set requireConfirm whenever an edit has occurred
    useEffect(() => {
        setRequireConfirm(hasUnsavedChanges());
    }, [displayName, url, purpose, header, channelType, hasUnsavedChanges]);

    // For KeyDown handling (e.g. Ctrl+Shift+A => close)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (cmdOrCtrlPressed(e) && e.shiftKey && isKeyPressed(e, Constants.KeyCodes.A)) {
                e.preventDefault();
                handleHide();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Called to set the active tab, prompting confirm if there are unsaved changes
    const updateTab = (newTab: string) => {
        if (requireConfirm) {
            showConfirm(() => updateTabConfirm(newTab));
        } else {
            updateTabConfirm(newTab);
        }
    };

    const updateTabConfirm = (newTab: string) => {
        const tab = newTab as ChannelSettingsTabs;
        setActiveTab(tab);
        setActiveTab(newTab as ChannelSettingsTabs);

        // Scroll to top if user changes tabs
        if (modalBodyRef.current) {
            modalBodyRef.current.scrollTop = 0;
        }
    };

    // Confirm modal logic
    const showConfirm = (afterConfirm?: () => void) => {
        if (customConfirmAction) {
            // A child can override the default confirm approach
            customConfirmAction(() => handleConfirm(afterConfirm));
            return;
        }
        setShowConfirmModal(true);
        setEnforceFocus(false);
    };

    const handleConfirm = (afterConfirm?: () => void) => {
        setShowConfirmModal(false);
        setEnforceFocus(true);
        setRequireConfirm(false);
        setCustomConfirmAction(null);

        // If a callback was specified, run it after discarding changes
        if (afterConfirm) {
            afterConfirm();
        }
    };

    const handleCancelConfirmation = () => {
        setShowConfirmModal(false);
        setEnforceFocus(true);
    };

    // Close button in top-right of the modal
    const handleHide = () => {
        if (requireConfirm) {
            showConfirm(() => handleHideConfirm());
        } else {
            handleHideConfirm();
        }
    };

    const handleHideConfirm = () => {
        // Cancel any ongoing ring
        stopTryNotificationRing();
        setShow(false);
    };

    // Called after the fade-out completes
    const handleHidden = () => {
        // Clear anything if needed
        setActiveTab(ChannelSettingsTabs.INFO);
        if (props.focusOriginElement) {
            focusElement(props.focusOriginElement, true);
        }
        props.onExited();
    };

    // Validate & Save
    const handleSave = async () => {
        if (!channel) {
            return;
        }

        // Example of a simple client-side check
        if (!displayName.trim()) {
            setServerError(formatMessage({
                id: 'channel_settings.error_display_name_required',
                defaultMessage: 'Channel name is required',
            }));
            return;
        }

        // Build updated channel object
        const updated: Channel = {
            ...channel,
            display_name: displayName.trim(),
            name: url.trim(),
            purpose: purpose.trim(),
            header: header.trim(),
            type: channelType as ChannelType,
        };

        // Example dispatch to Redux
        const {error} = await dispatch(patchChannel(channel.id, updated));
        if (error) {
            handleServerError(error as ServerError);
            return;
        }

        // On success, close the modal
        handleHideConfirm();
    };

    const handleServerError = (err: ServerError) => {
        setServerError(err.message || formatMessage({id: 'channel_settings.unknown_error', defaultMessage: 'Something went wrong.'}));
    };

    // Example of toggling from open <-> private
    const handleChannelTypeChange = (type: ChannelType) => {
        // If canCreatePublic is false, do not allow. Similarly if canCreatePrivate is false, do not allow
        if (type === Constants.OPEN_CHANNEL && !canConvertToPublic) {
            return;
        }
        if (type === Constants.PRIVATE_CHANNEL && !canConvertToPrivate) {
            return;
        }
        setChannelType(type);
        setServerError('');
    };

    // (Optional) “Archive channel” flow
    const handleArchiveChannel = () => {
        if (requireConfirm) {
            showConfirm(() => doArchiveChannel());
        } else {
            doArchiveChannel();
        }
    };

    const doArchiveChannel = () => {
        // Example: dispatch(archiveChannel(channel.id)) ...
        // Or open a separate confirmation
        // Then close the modal
        handleHideConfirm();
    };

    // Renders content based on active tab
    const renderTabContent = () => {
        switch (activeTab) {
        case ChannelSettingsTabs.INFO:
            return renderInfoTab();
        case ChannelSettingsTabs.CONFIGURATION:
            return renderConfigurationTab();
        case ChannelSettingsTabs.ARCHIVE:
            return renderArchiveTab();
        default:
            return renderInfoTab();
        }
    };

    const renderInfoTab = () => {
        // Channel name, URL, purpose, header, plus the public/private toggle
        return (
            <div className='ChannelSettingsModal__infoTab'>
                <label className='Input_legend'>{formatMessage({id: 'channel_settings.label.name', defaultMessage: 'Channel Name'})}</label>
                <input
                    type='text'
                    className='form-control'
                    value={displayName}
                    onChange={(e) => {
                        setDisplayName(e.target.value);
                        setServerError('');
                    }}
                    placeholder={formatMessage({id: 'channel_settings.placeholder.name', defaultMessage: 'Enter channel name'})}
                />
                {/* URL line */}
                <div className='ChannelSettingsModal__urlLine'>
                    <span>
                        {formatMessage({id: 'channel_settings.url', defaultMessage: 'URL:'})} {'https://your-mattermost-server.com/'}{channel?.team_id ?? 'team'}{'/'}
                        {isEditingURL ? (
                            <input
                                data-testid='channelURLInput'
                                className={classNames('ChannelSettingsModal__urlInput', {'with-error': urlError})}
                                type='text'
                                value={url}
                                onChange={(e) => setURL(e.target.value)}
                            />
                        ) : (
                            <span data-testid='channelURLLabel'>{url}</span>
                        )}
                    </span>
                    {isEditingURL ? (
                        <button
                            type='button'
                            className='btn btn-link ChannelSettingsModal__urlEditButton'
                            onClick={() => {
                                // Validate or finalize
                                if (!url) {
                                    setURLError(formatMessage({
                                        id: 'channel_settings.error.url_required',
                                        defaultMessage: 'URL cannot be empty',
                                    }));
                                    return;
                                }

                                // e.g. Additional validations on URL
                                setIsEditingURL(false);
                            }}
                        >
                            {formatMessage({id: 'channel_settings.url.done', defaultMessage: 'Done'})}
                        </button>
                    ) : (
                        <button
                            type='button'
                            className='btn btn-link ChannelSettingsModal__urlEditButton'
                            onClick={() => {
                                setIsEditingURL(true);
                                setURLError('');
                            }}
                        >
                            {formatMessage({id: 'channel_settings.url.edit', defaultMessage: 'Edit'})}
                        </button>
                    )}
                    {urlError && (
                        <div className='ChannelSettingsModal__urlError'>
                            {urlError}
                        </div>
                    )}
                </div>

                {/* Public/Private Selector */}
                <PublicPrivateSelector
                    className='ChannelSettingsModal__typeSelector'
                    selected={channelType}
                    publicButtonProps={{
                        title: formatMessage({id: 'channel_modal.type.public.title', defaultMessage: 'Public Channel'}),
                        description: formatMessage({id: 'channel_modal.type.public.description', defaultMessage: 'Anyone can join'}),
                        disabled: !canConvertToPublic,
                    }}
                    privateButtonProps={{
                        title: formatMessage({id: 'channel_modal.type.private.title', defaultMessage: 'Private Channel'}),
                        description: formatMessage({id: 'channel_modal.type.private.description', defaultMessage: 'Only invited members'}),
                        disabled: !canConvertToPrivate,
                    }}
                    onChange={handleChannelTypeChange}
                />

                {/* Purpose */}
                <div className='ChannelSettingsModal__purposeContainer'>
                    <label className='Input_legend'>{formatMessage({id: 'channel_settings.label.purpose', defaultMessage: 'Channel Purpose'})}</label>
                    <textarea
                        className={classNames('form-control', {'with-error': purposeError})}
                        placeholder={formatMessage({id: 'channel_settings.placeholder.purpose', defaultMessage: 'Enter channel purpose (optional)'})}
                        value={purpose}
                        onChange={(e) => {
                            setPurpose(e.target.value);
                            setPurposeError('');
                            setServerError('');
                        }}
                        rows={3}
                    />
                    {purposeError ? (
                        <div className='ChannelSettingsModal__purposeError'>
                            {purposeError}
                        </div>
                    ) : (
                        <div className='ChannelSettingsModal__purposeHelpText'>
                            {formatMessage({id: 'channel_settings.purpose.helpText', defaultMessage: 'This will be displayed when browsing for channels.'})}
                        </div>
                    )}
                </div>

                {/* Channel Header (Markdown with a preview icon) */}
                <div className='ChannelSettingsModal__headerContainer'>
                    <label className='Input_legend'>{formatMessage({id: 'channel_settings.label.header', defaultMessage: 'Channel Header'})}</label>
                    {/* Example of a small “Preview” toggle button, or a subcomponent that shows live markdown */}
                    {/* <MarkdownPreview
                        value={header}
                        onChange={(val: string) => {
                            setHeader(val);
                            setServerError('');
                        }}
                    /> */}
                </div>
            </div>
        );
    };

    const renderConfigurationTab = () => {
        // Could show channel permissions, guest/member permissions, etc.
        return (
            <div className='ChannelSettingsModal__configurationTab'>
                <FormattedMessage
                    id='channel_settings.configuration.placeholder'
                    defaultMessage='Channel Permissions or Additional Configuration (WIP)'
                />
                {/*
                  * e.g. toggles or forms for advanced channel moderation,
                  * borrowed from System Console or Channel Moderation settings
                  */}
            </div>
        );
    };

    const renderArchiveTab = () => {
        return (
            <div className='ChannelSettingsModal__archiveTab'>
                <FormattedMessage
                    id='channel_settings.archive.warning'
                    defaultMessage='Archiving this channel will remove it from the channel list. Are you sure you want to proceed?'
                />
                <button
                    type='button'
                    className='btn btn-danger'
                    onClick={handleArchiveChannel}
                >
                    <FormattedMessage
                        id='channel_settings.archive.button'
                        defaultMessage='Archive Channel'
                    />
                </button>
            </div>
        );
    };

    // Renders the body: left sidebar for tabs, the content on the right
    const renderModalBody = () => {
        return (
            <div
                ref={modalBodyRef}
                className='ChannelSettingsModal__bodyWrapper'
            >
                <div className='settings-table'>
                    <div className='settings-links'>
                        <ChannelSettingsSidebar
                            setActiveTab={(id: string) => updateTab(id)}
                            activeTab={activeTab}
                            tabs={[
                                {id: ChannelSettingsTabs.INFO, label: formatMessage({id: 'channel_settings.tab.info', defaultMessage: 'Info'})},
                                {id: ChannelSettingsTabs.CONFIGURATION, label: formatMessage({id: 'channel_settings.tab.configuration', defaultMessage: 'Configuration'})},
                                {id: ChannelSettingsTabs.ARCHIVE, label: formatMessage({id: 'channel_settings.tab.archive', defaultMessage: 'Archive Channel'})},
                            ]}
                        />
                    </div>
                    <div className='settings-content minimize-settings'>
                        {renderTabContent()}
                    </div>
                </div>
            </div>
        );
    };

    // For the main modal heading
    const modalTitle = formatMessage({id: 'channel_settings.modal.title', defaultMessage: 'Channel Settings'});

    // Error text to show in the GenericModal “footer area”
    // (As seen in `NewChannelModal`, we can pass an error string.)
    const errorText = serverError;

    return (
        <GenericModal
            id='channelSettingsModal'
            ariaLabel={modalTitle}
            className='ChannelSettingsModal'
            show={show}
            onHide={handleHide}
            onExited={handleHidden}
            compassDesign={true}
            enforceFocus={enforceFocus}

            // The main heading:
            modalHeaderText={modalTitle}
            errorText={errorText}

            // Primary “Save” or “Update” button text
            confirmButtonText={formatMessage({id: 'channel_settings.modal.save', defaultMessage: 'Save changes'})}
            cancelButtonText={formatMessage({id: 'channel_settings.modal.cancel', defaultMessage: 'Cancel'})}

            // If there are no changes or any field is invalid, disable “Save”
            isConfirmDisabled={!hasUnsavedChanges() || Boolean(urlError || serverError || purposeError)}

            // When user clicks “Save”
            handleConfirm={handleSave}

            // If pressing Enter in a sub‐form, we also want to handle saving:
            handleEnterKeyPress={handleSave}
            handleCancel={handleHide}
            autoCloseOnConfirmButton={false}
        >
            {renderModalBody()}

            {/* ConfirmModal for unsaved changes */}
            <ConfirmModal
                show={showConfirmModal}
                title={formatMessage({id: 'channel_settings.modal.confirmTitle', defaultMessage: 'Discard Changes?'})}
                message={formatMessage({id: 'channel_settings.modal.confirmMsg', defaultMessage: 'You have unsaved changes. Are you sure you want to discard them?'})}
                confirmButtonText={formatMessage({id: 'channel_settings.modal.confirmDiscard', defaultMessage: 'Yes, Discard'})}
                onConfirm={() => handleConfirm()}
                onCancel={handleCancelConfirmation}
            />
        </GenericModal>
    );
}

export default ChannelSettingsModal;
