// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {
    useCallback,
    useMemo,
    useState,
    useRef,
} from 'react';
import {useIntl} from 'react-intl';
import {shallowEqual, useSelector, useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import type {Channel} from '@mattermost/types/channels';

import Permissions from 'mattermost-redux/constants/permissions';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig, getLicense, isChannelPermissionPoliciesEnabled} from 'mattermost-redux/selectors/entities/general';
import {haveIChannelPermission, haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';

import {
    setShowPreviewOnChannelSettingsHeaderModal,
    setShowPreviewOnChannelSettingsPurposeModal,
} from 'actions/views/textbox';
import {getBasePath, isChannelAccessControlEnabled} from 'selectors/general';
import {getChannelSettingsTabs} from 'selectors/plugins';

import type {Tab as SidebarTab} from 'components/settings_sidebar/settings_sidebar';
import {normalizePluginIcon} from 'components/settings_sidebar/settings_sidebar';

import {focusElement} from 'utils/a11y_utils';
import Constants from 'utils/constants';
import {isMinimumEnterpriseAdvancedLicense} from 'utils/license_utils';

import type {GlobalState} from 'types/store';

import ChannelSettingsAccessRulesTab from './channel_settings_access_rules_tab';
import ChannelSettingsArchiveTab from './channel_settings_archive_tab';
import ChannelSettingsConfigurationTab from './channel_settings_configuration_tab';
import ChannelSettingsInfoTab from './channel_settings_info_tab';
import ChannelSettingsPermissionsPolicyTab from './channel_settings_permissions_policy_tab';
import ChannelSettingsPluginTab from './channel_settings_plugin_tab';

import './channel_settings_modal.scss';

// Lazy-loaded components
const SettingsSidebar = React.lazy(() => import('components/settings_sidebar'));

type ChannelSettingsModalProps = {
    channelId: string;
    onExited: () => void;
    isOpen: boolean;
    focusOriginElement?: string;
};

const BuiltInTabIds = {
    INFO: 'info',
    ACCESS_RULES: 'access_rules',
    PERMISSIONS_POLICY: 'permissions_policy',
    CONFIGURATION: 'configuration',
    ARCHIVE: 'archive',
} as const;
type BuiltInTabId = typeof BuiltInTabIds[keyof typeof BuiltInTabIds];

const builtInTabIdSet = new Set<BuiltInTabId>(Object.values(BuiltInTabIds));
const PLUGIN_TAB_PREFIX = 'plugin_';

const SHOW_PANEL_ERROR_STATE_TAB_SWITCH_TIMEOUT = 3000;

function getPluginTabName(registrationId: string): string {
    return `${PLUGIN_TAB_PREFIX}${registrationId}`;
}

function getPluginRegistrationId(tabName: string): string | undefined {
    if (!tabName.startsWith(PLUGIN_TAB_PREFIX)) {
        return undefined;
    }

    const registrationId = tabName.slice(PLUGIN_TAB_PREFIX.length);
    return registrationId || undefined;
}

function isBuiltInTabId(tabName: string): tabName is BuiltInTabId {
    return builtInTabIdSet.has(tabName as BuiltInTabId);
}

function getPreferredActiveTab(activeTab: string, visibleBuiltInTabs: SidebarTab[], visiblePluginTabs: SidebarTab[]): string {
    const visibleTabNames = [...visibleBuiltInTabs, ...visiblePluginTabs].map((tab) => tab.name);
    if (visibleTabNames.includes(activeTab)) {
        return activeTab;
    }

    return visibleBuiltInTabs[0]?.name ?? visiblePluginTabs[0]?.name ?? BuiltInTabIds.INFO;
}

function ChannelSettingsModal({channelId, isOpen, onExited, focusOriginElement}: ChannelSettingsModalProps) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId)) as Channel;
    const visiblePluginTabRegistrations = useSelector((state: GlobalState) => {
        const currentChannel = getChannel(state, channelId);
        if (!currentChannel) {
            return [];
        }

        return getChannelSettingsTabs(state).filter((registration) => registration.shouldRender?.(state, currentChannel) ?? true);
    }, shallowEqual);
    const isDMorGM = channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL;
    const channelBannerEnabled = isMinimumEnterpriseAdvancedLicense(useSelector(getLicense));

    const canManagePublicChannelBanner = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, Permissions.MANAGE_PUBLIC_CHANNEL_BANNER),
    );
    const canManagePrivateChannelBanner = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, Permissions.MANAGE_PRIVATE_CHANNEL_BANNER),
    );
    const hasManageChannelBannerPermission = (channel.type === 'O' && canManagePublicChannelBanner) || (channel.type === 'P' && canManagePrivateChannelBanner);

    const canManageChannelTranslation = useSelector((state: GlobalState) => {
        const config = getConfig(state);
        if (config?.EnableAutoTranslation !== 'true') {
            return false;
        }

        const isDMorGM = channel.type === Constants.DM_CHANNEL || channel.type === Constants.GM_CHANNEL;
        if (isDMorGM && config?.RestrictDMAndGMAutotranslation === 'true') {
            return false;
        }

        if (isDMorGM) {
            return true;
        }

        const permissionToCheck = channel.type === Constants.PRIVATE_CHANNEL ? Permissions.MANAGE_PRIVATE_CHANNEL_AUTO_TRANSLATION : Permissions.MANAGE_PUBLIC_CHANNEL_AUTO_TRANSLATION;
        return haveIChannelPermission(state, channel.team_id, channel.id, permissionToCheck);
    });

    const canManageBanner = channelBannerEnabled && hasManageChannelBannerPermission;
    const canManageChannelProperties = useSelector((state: GlobalState) => {
        if (isDMorGM) {
            return true;
        }
        const permission = channel.type === Constants.PRIVATE_CHANNEL ? Permissions.MANAGE_PRIVATE_CHANNEL_PROPERTIES : Permissions.MANAGE_PUBLIC_CHANNEL_PROPERTIES;
        return haveIChannelPermission(state, channel.team_id, channel.id, permission);
    });
    const canManageSharedChannels = useSelector((state: GlobalState) => {
        const config = getConfig(state);
        const connectedWorkspacesEnabled = config?.ExperimentalSharedChannels === 'true';
        if (!connectedWorkspacesEnabled || isDMorGM) {
            return false;
        }
        return haveISystemPermission(state, {permission: Permissions.MANAGE_SHARED_CHANNELS});
    });
    const canManageJoinLeaveMessages = !isDMorGM && canManageChannelProperties;
    const shouldShowConfigurationTab = canManageBanner || canManageChannelTranslation || canManageSharedChannels || canManageJoinLeaveMessages;
    const shouldShowInfoTab = canManageChannelProperties;

    const canArchivePrivateChannels = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, Permissions.DELETE_PRIVATE_CHANNEL),
    );

    const canArchivePublicChannels = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, Permissions.DELETE_PUBLIC_CHANNEL),
    );

    const canManageChannelAccessRules = useSelector((state: GlobalState) =>
        haveIChannelPermission(state, channel.team_id, channel.id, Permissions.MANAGE_CHANNEL_ACCESS_RULES),
    );

    const basePath = useSelector(getBasePath);
    const channelAdminABACControlEnabled = useSelector(isChannelAccessControlEnabled);

    // Channel-scope permission rules sit behind a dedicated sub-flag
    // (ChannelPermissionPolicies) that depends on the umbrella
    // PermissionPolicies flag — `isChannelPermissionPoliciesEnabled`
    // enforces that dependency so we don't have to check both flags
    // at every call site. The server rejects channel policies with
    // permission rules when this is off (`api.access_control_policy.
    // channel_permission_policies.feature_disabled`); hiding the tab
    // here keeps the UI consistent with that gate.
    const channelPermissionPoliciesEnabled = useSelector(isChannelPermissionPoliciesEnabled);

    const isPolicyEligibleChannelType = channel.type === Constants.PRIVATE_CHANNEL || channel.type === Constants.OPEN_CHANNEL;

    // Default channels (town-square / off-topic) cannot have ABAC policies —
    // ValidateChannelEligibilityForAccessControl rejects them on the server, so
    // showing the Membership Policy tab here would only let the user assemble
    // rules they can never save.
    const isDefaultChannel = channel.name === Constants.DEFAULT_CHANNEL || channel.name === Constants.OFFTOPIC_CHANNEL;
    const shouldShowAccessRulesTab = channelAdminABACControlEnabled && canManageChannelAccessRules && isPolicyEligibleChannelType && !channel.group_constrained && !isDefaultChannel && !channel.shared;

    // Permissions Policy is gated by the ABAC license + setting AND the
    // channel-scope permission-policies sub-flag (which itself requires
    // the PermissionPolicies umbrella). Same channel-eligibility rules
    // as the Membership Policy tab.
    const shouldShowPermissionsPolicyTab = shouldShowAccessRulesTab && channelPermissionPoliciesEnabled;

    const shouldShowArchiveTab = channel.name !== Constants.DEFAULT_CHANNEL &&
        ((channel.type === Constants.PRIVATE_CHANNEL && canArchivePrivateChannels) ||
        (channel.type === Constants.OPEN_CHANNEL && canArchivePublicChannels));

    const [show, setShow] = useState(isOpen);

    // The user's selected tab. The tab actually shown is derived as `activeTab`
    // below so a selection that becomes unavailable falls back automatically.
    const [selectedTab, setSelectedTab] = useState<string>(BuiltInTabIds.INFO);

    // State for showing error in the save changes panel when trying to switch tabs with unsaved changes
    const [showTabSwitchError, setShowTabSwitchError] = useState(false);

    // State to track if there are unsaved changes
    const [areThereUnsavedChanges, setAreThereUnsavedChanges] = useState(false);

    // State to track if user has been warned about unsaved changes
    const [hasBeenWarned, setHasBeenWarned] = useState(false);

    // Refs
    const modalBodyRef = useRef<HTMLDivElement>(null);

    const tabs = useMemo((): SidebarTab[] => {
        return [
            {
                name: BuiltInTabIds.INFO,
                uiName: formatMessage({id: 'channel_settings.tab.info', defaultMessage: 'Info'}),
                icon: 'icon icon-information-outline',
                iconTitle: formatMessage({id: 'generic_icons.info', defaultMessage: 'Info Icon'}),
                display: shouldShowInfoTab,
            },
            {
                name: BuiltInTabIds.ACCESS_RULES,
                uiName: formatMessage({id: 'channel_settings.tab.membership_policy', defaultMessage: 'Membership Policy'}),
                icon: 'icon icon-shield-outline',
                iconTitle: formatMessage({id: 'generic_icons.access_rules', defaultMessage: 'Membership Policy Icon'}),
                display: shouldShowAccessRulesTab,
            },
            {
                name: BuiltInTabIds.PERMISSIONS_POLICY,
                uiName: formatMessage({id: 'channel_settings.tab.permissions_policy', defaultMessage: 'Permissions Policy'}),
                icon: 'icon icon-key-variant',
                iconTitle: formatMessage({id: 'generic_icons.permissions_policy', defaultMessage: 'Permissions Policy Icon'}),
                display: shouldShowPermissionsPolicyTab,
            },
            {
                name: BuiltInTabIds.CONFIGURATION,
                uiName: formatMessage({id: 'channel_settings.tab.configuration', defaultMessage: 'Configuration'}),
                icon: 'icon icon-cog-outline',
                iconTitle: formatMessage({id: 'generic_icons.settings', defaultMessage: 'Settings Icon'}),
                display: shouldShowConfigurationTab,
            },
            {
                name: BuiltInTabIds.ARCHIVE,
                uiName: formatMessage({id: 'channel_settings.tab.archive', defaultMessage: 'Archive Channel'}),
                icon: 'icon icon-archive-outline',
                iconTitle: formatMessage({id: 'generic_icons.archive', defaultMessage: 'Archive Icon'}),
                display: shouldShowArchiveTab,
            },
        ];
    }, [
        formatMessage,
        shouldShowInfoTab,
        shouldShowAccessRulesTab,
        shouldShowPermissionsPolicyTab,
        shouldShowConfigurationTab,
        shouldShowArchiveTab,
    ]);

    const pluginTabs = useMemo((): SidebarTab[] => {
        return visiblePluginTabRegistrations.map((registration) => {
            return {
                name: getPluginTabName(registration.id),
                uiName: registration.uiName,
                iconTitle: registration.uiName,
                icon: normalizePluginIcon(registration.icon, basePath),
            };
        });
    }, [basePath, visiblePluginTabRegistrations]);

    const visibleBuiltInTabs = useMemo(() => tabs.filter((tab) => tab.display !== false), [tabs]);
    const visiblePluginTabs = useMemo(() => pluginTabs.filter((tab) => tab.display !== false), [pluginTabs]);

    // The tab to actually display: the user's selection if still visible,
    // otherwise the first available tab. Derived rather than stored so we never
    // need to sync state back when visibility changes. As a result, a tab that
    // becomes unavailable mid-edit switches away even with unsaved changes —
    // an acceptable trade for avoiding the extra render the old sync caused.
    const activeTab = useMemo(() => getPreferredActiveTab(selectedTab, visibleBuiltInTabs, visiblePluginTabs), [selectedTab, visibleBuiltInTabs, visiblePluginTabs]);

    const activePluginRegistrationId = getPluginRegistrationId(activeTab);
    const visibleActivePluginRegistration = useMemo(() => {
        if (!activePluginRegistrationId) {
            return undefined;
        }

        return visiblePluginTabRegistrations.find((registration) => registration.id === activePluginRegistrationId);
    }, [activePluginRegistrationId, visiblePluginTabRegistrations]);

    const setUnsaved = useCallback((unsaved: boolean) => {
        setAreThereUnsavedChanges(unsaved);
        if (!unsaved) {
            setHasBeenWarned(false);
        }
    }, []);

    // Called to set the active tab, prompting save changes panel if there are unsaved changes
    const updateTab = (newTab: string) => {
        /**
         * If there are unsaved changes, show an error in the save changes panel
         * and reset it after a timeout to indicate the user needs to save or discard changes
         * before switching tabs.
         */
        if (areThereUnsavedChanges) {
            setShowTabSwitchError(true);
            setTimeout(() => {
                setShowTabSwitchError(false);
            }, SHOW_PANEL_ERROR_STATE_TAB_SWITCH_TIMEOUT);
            return;
        }

        if (newTab !== activeTab) {
            setSelectedTab(newTab);
        }

        if (modalBodyRef.current) {
            modalBodyRef.current.scrollTop = 0;
        }
    };

    const handleHide = () => {
        // Prevent modal closing if there are unsaved changes (warn once, then allow)
        if (areThereUnsavedChanges && !hasBeenWarned) {
            setHasBeenWarned(true);

            // Show error message in SaveChangesPanel
            setShowTabSwitchError(true);
            setTimeout(() => {
                setShowTabSwitchError(false);
            }, SHOW_PANEL_ERROR_STATE_TAB_SWITCH_TIMEOUT);
        } else {
            handleHideConfirm();
        }
    };

    const handleHideConfirm = () => {
        // Reset preview states to false when closing the modal
        dispatch(setShowPreviewOnChannelSettingsHeaderModal(false));
        dispatch(setShowPreviewOnChannelSettingsPurposeModal(false));
        setShow(false);
    };

    // Called after the fade-out completes
    const handleExited = () => {
        // Clear anything if needed
        setSelectedTab(BuiltInTabIds.INFO);
        setHasBeenWarned(false);
        if (focusOriginElement) {
            focusElement(focusOriginElement, true);
        }
        onExited();
    };

    const renderInfoTab = () => {
        return (
            <ChannelSettingsInfoTab
                channel={channel}
                setAreThereUnsavedChanges={setAreThereUnsavedChanges}
                showTabSwitchError={showTabSwitchError}
            />
        );
    };

    const renderConfigurationTab = () => {
        return (
            <ChannelSettingsConfigurationTab
                channel={channel}
                setAreThereUnsavedChanges={setAreThereUnsavedChanges}
                showTabSwitchError={showTabSwitchError}
                canManageChannelTranslation={canManageChannelTranslation}
                canManageBanner={canManageBanner}
                canManageSharedChannels={canManageSharedChannels}
                canManageJoinLeaveMessages={canManageJoinLeaveMessages}
            />
        );
    };

    const renderAccessRulesTab = () => {
        return (
            <ChannelSettingsAccessRulesTab
                channel={channel}
                setAreThereUnsavedChanges={setAreThereUnsavedChanges}
                showTabSwitchError={showTabSwitchError}
            />
        );
    };

    const renderPermissionsPolicyTab = () => {
        return (
            <ChannelSettingsPermissionsPolicyTab
                channel={channel}
                setAreThereUnsavedChanges={setAreThereUnsavedChanges}
                showTabSwitchError={showTabSwitchError}
            />
        );
    };

    const renderArchiveTab = () => {
        return (
            <ChannelSettingsArchiveTab
                channel={channel}
                onHide={handleHideConfirm}
            />
        );
    };

    const renderBuiltInTabContent = (tab: BuiltInTabId) => {
        switch (tab) {
        case BuiltInTabIds.INFO:
            return renderInfoTab();
        case BuiltInTabIds.ACCESS_RULES:
            return renderAccessRulesTab();
        case BuiltInTabIds.PERMISSIONS_POLICY:
            return renderPermissionsPolicyTab();
        case BuiltInTabIds.CONFIGURATION:
            return renderConfigurationTab();
        case BuiltInTabIds.ARCHIVE:
            return renderArchiveTab();
        default: {
            const exhaustiveCheck: never = tab;
            return exhaustiveCheck;
        }
        }
    };

    // Renders content based on active tab
    const renderTabContent = () => {
        if (visibleActivePluginRegistration) {
            return (
                <ChannelSettingsPluginTab
                    key={visibleActivePluginRegistration.id}
                    channel={channel}
                    registration={visibleActivePluginRegistration}
                    areThereUnsavedChanges={areThereUnsavedChanges}
                    showTabSwitchError={showTabSwitchError}
                    setUnsaved={setUnsaved}
                />
            );
        }

        return renderBuiltInTabContent(isBuiltInTabId(activeTab) ? activeTab : BuiltInTabIds.INFO);
    };

    // Renders the body: left sidebar for tabs, the content on the right
    const renderModalBody = () => {
        return (
            <div
                ref={modalBodyRef}
                className='settings-table'
            >
                <div className='settings-links'>
                    <React.Suspense fallback={null}>
                        <SettingsSidebar
                            tabs={tabs}
                            pluginTabs={pluginTabs}
                            activeTab={activeTab}
                            updateTab={updateTab}
                        />
                    </React.Suspense>
                </div>
                <div className='settings-content minimize-settings'>
                    {renderTabContent()}
                </div>
            </div>
        );
    };

    const modalTitle = formatMessage({id: 'channel_settings.modal.title', defaultMessage: 'Channel Settings'});

    return (
        <GenericModal
            id='channelSettingsModal'
            ariaLabel={modalTitle}
            className='ChannelSettingsModal settings-modal'
            show={show}
            onHide={handleHide}
            preventClose={areThereUnsavedChanges && !hasBeenWarned}
            onExited={handleExited}
            compassDesign={true}
            modalHeaderText={modalTitle}
            bodyPadding={false}
            modalLocation={'top'}
            enforceFocus={false}
        >
            <div className='ChannelSettingsModal__bodyWrapper'>
                {renderModalBody()}
            </div>
        </GenericModal>
    );
}

export default ChannelSettingsModal;
