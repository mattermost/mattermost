// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useState,
    useRef,
    useEffect,
    useCallback,
} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel, ChannelType} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';

import {patchChannel} from 'mattermost-redux/actions/channels';
import Permissions from 'mattermost-redux/constants/permissions';
import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';

import ConfirmationModal from 'components/confirm_modal';
import type TextboxClass from 'components/textbox/textbox';
import type {SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import {focusElement} from 'utils/a11y_utils';
import Constants from 'utils/constants';
import {isKeyPressed, cmdOrCtrlPressed} from 'utils/keyboard';
import {stopTryNotificationRing} from 'utils/notification_sounds';

import type {GlobalState} from 'types/store';

import ChannelSettingsArchiveTab from './channel_settings_archive_tab';
import ChannelSettingsConfigurationTab from './channel_settings_configuration_tab';
import ChannelSettingsInfoTab from './channel_settings_info_tab';

import './channel_settings_modal.scss';

// Lazy-loaded components
const SettingsSidebar = React.lazy(() => import('components/settings_sidebar'));

type ChannelSettingsModalProps = {
    channel: Channel;
    onExited: () => void;
    focusOriginElement?: string;
    isOpen: boolean;
};

enum ChannelSettingsTabs {
    INFO = 'info',
    CONFIGURATION = 'configuration',
    ARCHIVE = 'archive',
}

/** TODO:
 * 1. Define if we keep the eddit purpose modal, in DMs we provide that option, so, should we show this modal hiding
 *    remaining elements or keep the existing one.
 * 2. Add logic to avoid showing archive section in town-square and off-topic channels
 */
function ChannelSettingsModal({channel, isOpen, onExited, focusOriginElement}: ChannelSettingsModalProps) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const canConvertToPrivate = useSelector((state: GlobalState) =>
        haveITeamPermission(state, channel?.team_id ?? '', Permissions.CREATE_PRIVATE_CHANNEL),
    );
    const canConvertToPublic = useSelector((state: GlobalState) =>
        haveITeamPermission(state, channel?.team_id ?? '', Permissions.CREATE_PUBLIC_CHANNEL),
    );

    const [show, setShow] = useState(isOpen);

    // Active tab
    const [activeTab, setActiveTab] = useState<ChannelSettingsTabs>(ChannelSettingsTabs.INFO);

    // We track unsaved changes to prompt a save changes panel
    const [requireConfirm, setRequireConfirm] = useState(false);
    const [showArchiveConfirmModal, setShowArchiveConfirmModal] = useState(false);
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();

    // The fields we allow editing
    const [displayName, setDisplayName] = useState(channel?.display_name ?? '');
    const [url, setURL] = useState(channel?.name ?? '');
    const [channelPurpose, setChannelPurpose] = useState(channel.purpose ?? '');

    const [channelHeader, setChannelHeader] = useState(channel?.header ?? '');
    const [channelType, setChannelType] = useState<ChannelType>(channel?.type as ChannelType ?? Constants.OPEN_CHANNEL as ChannelType);

    // Refs
    const modalBodyRef = useRef<HTMLDivElement>(null);
    const headerTextboxRef = useRef<TextboxClass>(null);
    const purposeTextboxRef = useRef<TextboxClass>(null);

    // UI Feedback: errors, states
    const [urlError, setURLError] = useState('');
    const [serverError, setServerError] = useState('');

    // For checking unsaved changes, we store the initial "loaded" values or do a direct comparison
    const hasUnsavedChanges = useCallback(() => {
        // Compare fields to their original values
        if (!channel) {
            return false;
        }
        return (
            displayName !== channel.display_name ||
            url !== channel.name ||
            channelPurpose !== channel.purpose ||
            channelHeader !== channel.header ||
            channelType !== channel.type
        );
    }, [channel, displayName, url, channelPurpose, channelHeader, channelType]);

    // Possibly set requireConfirm whenever an edit has occurred
    useEffect(() => {
        setRequireConfirm(hasUnsavedChanges());
    }, [displayName, url, channelPurpose, channelHeader, channelType, hasUnsavedChanges]);

    // For KeyDown handling
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

    // Called to set the active tab, prompting save changes panel if there are unsaved changes
    const updateTab = useCallback((newTab: string) => {
        if (requireConfirm) {
            setSaveChangesPanelState('editing');
            return;
        }
        updateTabConfirm(newTab);
    }, [requireConfirm]);

    const updateTabConfirm = (newTab: string) => {
        const tab = newTab as ChannelSettingsTabs;
        setActiveTab(tab);

        if (modalBodyRef.current) {
            modalBodyRef.current.scrollTop = 0;
        }
    };

    // Validate & Save - using useCallback to ensure it has the latest state values
    const handleSave = useCallback(async (): Promise<boolean> => {
        if (!channel) {
            return false;
        }

        // TODO: expand this simple example of the client-side check, enhance and cover all scenarios shown int he UX
        if (!displayName.trim()) {
            setServerError(formatMessage({
                id: 'channel_settings.error_display_name_required',
                defaultMessage: 'Channel name is required',
            }));
            return false;
        }

        // Build updated channel object
        const updated: Channel = {
            ...channel,
            display_name: displayName.trim(),
            name: url.trim(),
            purpose: channelPurpose.trim(),
            header: channelHeader.trim(), // Now using the latest header value from state
            type: channelType as ChannelType,
        };

        const {error} = await dispatch(patchChannel(channel.id, updated));
        if (error) {
            handleServerError(error as ServerError);
            return false;
        }

        // Return success, but don't close the modal yet
        // Let the SaveChangesPanel show the "Settings saved" message first
        return true;
    }, [channel, displayName, url, channelPurpose, channelHeader, channelType, dispatch, formatMessage]);

    // Handle save changes panel actions
    const handleSaveChanges = useCallback(async () => {
        const success = await handleSave();
        if (!success) {
            setSaveChangesPanelState('error');
            return;
        }
        setSaveChangesPanelState('saved');
    }, [handleSave]);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState(undefined);
        setRequireConfirm(false);
    }, []);

    const handleCancel = useCallback(() => {
        // Reset all form fields to their original values
        setDisplayName(channel?.display_name ?? '');
        setURL(channel?.name ?? '');
        setChannelPurpose(channel?.purpose ?? '');
        setChannelHeader(channel?.header ?? '');
        setChannelType(channel?.type as ChannelType ?? Constants.OPEN_CHANNEL as ChannelType);

        // Clear errors
        setURLError('');
        setServerError('');

        handleClose();
    }, [channel]);

    const handleHide = () => {
        if (requireConfirm) {
            setSaveChangesPanelState('editing');
        } else {
            handleHideConfirm();
        }
    };

    const handleHideConfirm = () => {
        stopTryNotificationRing();
        setShow(false);
    };

    // Called after the fade-out completes
    const handleHidden = () => {
        // Clear anything if needed
        setActiveTab(ChannelSettingsTabs.INFO);
        if (focusOriginElement) {
            focusElement(focusOriginElement, true);
        }
        onExited();
    };

    const handleServerError = (err: ServerError) => {
        setServerError(err.message || formatMessage({id: 'channel_settings.unknown_error', defaultMessage: 'Something went wrong.'}));
    };

    const handleArchiveChannel = useCallback(() => {
        setShowArchiveConfirmModal(true);
    }, []);

    const doArchiveChannel = () => {
        // TODO: add the extra logic to archive the channel
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
        return (
            <ChannelSettingsInfoTab
                channel={channel}
                displayName={displayName}
                setDisplayName={setDisplayName}
                url={url}
                setURL={setURL}
                channelType={channelType}
                setChannelType={setChannelType}
                channelHeader={channelHeader}
                setChannelHeader={setChannelHeader}
                channelPurpose={channelPurpose}
                setChannelPurpose={setChannelPurpose}
                urlError={urlError}
                setURLError={setURLError}
                serverError={serverError}
                setServerError={setServerError}
                canConvertToPublic={canConvertToPublic}
                canConvertToPrivate={canConvertToPrivate}
                headerTextboxRef={headerTextboxRef}
                purposeTextboxRef={purposeTextboxRef}
                requireConfirm={requireConfirm}
                saveChangesPanelState={saveChangesPanelState}
                handleSaveChanges={handleSaveChanges}
                handleCancel={handleCancel}
                handleClose={handleClose}
            />
        );
    };

    const renderConfigurationTab = () => {
        return (
            <ChannelSettingsConfigurationTab/>
        );
    };

    const renderArchiveTab = () => {
        return (
            <ChannelSettingsArchiveTab
                handleArchiveChannel={handleArchiveChannel}
            />
        );
    };

    // Define tabs for the settings sidebar
    const tabs = [
        {
            name: ChannelSettingsTabs.INFO,
            uiName: formatMessage({id: 'channel_settings.tab.info', defaultMessage: 'Info'}),
            icon: 'icon icon-information-outline',
            iconTitle: formatMessage({id: 'generic_icons.info', defaultMessage: 'Info Icon'}),
        },
        {
            name: ChannelSettingsTabs.CONFIGURATION,
            uiName: formatMessage({id: 'channel_settings.tab.configuration', defaultMessage: 'Configuration'}),
            icon: 'icon icon-cog-outline',
            iconTitle: formatMessage({id: 'generic_icons.settings', defaultMessage: 'Settings Icon'}),
        },
        {
            name: ChannelSettingsTabs.ARCHIVE,
            uiName: formatMessage({id: 'channel_settings.tab.archive', defaultMessage: 'Archive Channel'}),
            icon: 'icon icon-archive-outline',
            iconTitle: formatMessage({id: 'generic_icons.archive', defaultMessage: 'Archive Icon'}),
            newGroup: true,
        },
    ];

    // Renders the body: left sidebar for tabs, the content on the right
    const renderModalBody = () => {
        return (
            <div
                ref={modalBodyRef}
                className='ChannelSettingsModal__bodyWrapper'
            >
                <div className='settings-table'>
                    <div className='settings-links'>
                        <React.Suspense fallback={null}>
                            <SettingsSidebar
                                tabs={tabs}
                                activeTab={activeTab}
                                updateTab={updateTab}
                            />
                        </React.Suspense>
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

    // Error text to show in the GenericModal "footer area"
    const errorText = serverError;

    return (
        <GenericModal
            id='channelSettingsModal'
            ariaLabel={modalTitle}
            className='ChannelSettingsModal settings-modal'
            show={show}
            onHide={handleHide}
            onExited={handleHidden}
            compassDesign={true}

            // The main heading:
            modalHeaderText={modalTitle}
            errorText={errorText}

            // If pressing Enter in a sub‐form, we also want to handle saving:
            handleEnterKeyPress={handleSaveChanges}
            bodyPadding={false}
        >
            {renderModalBody()}

            {/* Confirmation Modal for archiving channel */}
            {showArchiveConfirmModal &&
                <ConfirmationModal
                    id='archiveChannelConfirmModal'
                    show={true}
                    title={formatMessage({id: 'channel_settings.modal.archiveTitle', defaultMessage: 'Archive Channel?'})}
                    message={formatMessage({id: 'channel_settings.modal.archiveMsg', defaultMessage: 'Are you sure you want to archive this channel? This action cannot be undone.'})}
                    confirmButtonText={formatMessage({id: 'channel_settings.modal.confirmArchive', defaultMessage: 'Yes, Archive'})}
                    onConfirm={doArchiveChannel}
                    onCancel={() => setShowArchiveConfirmModal(false)}
                    confirmButtonClass='btn-danger'
                    modalClass='archiveChannelConfirmModal'
                    focusOriginElement='channelSettingsArchiveChannelButton'
                />
            }
        </GenericModal>
    );
}

export default ChannelSettingsModal;
