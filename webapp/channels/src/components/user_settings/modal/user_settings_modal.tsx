// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {PreferencesType} from '@mattermost/types/preferences';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ConfirmModal from 'components/confirm_modal';
import SettingsSidebar from 'components/settings_sidebar';
import UserSettings from 'components/user_settings';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';
import SmartLoader from 'components/widgets/smart_loader';

import {focusElement} from 'utils/a11y_utils';
import Constants from 'utils/constants';
import {cmdOrCtrlPressed, isKeyPressed} from 'utils/keyboard';
import {stopTryNotificationRing} from 'utils/notification_sounds';
import {isValidUrl} from 'utils/url';
import {getDisplayName} from 'utils/utils';

import type {PluginConfiguration} from 'types/plugins/user_settings';

import './user_settings_modal.scss';

export type OwnProps = {
    userID?: string;
    adminMode?: boolean;
    isContentProductSettings: boolean;
    userPreferences?: PreferencesType;
    activeTab?: string;
}

export type Props = OwnProps & {
    intl: IntlShape;
    pluginSettings: {[pluginId: string]: PluginConfiguration};
    user?: UserProfile;
    onExited: () => void;
    focusOriginElement?: string;
    actions: {
        sendVerificationEmail: (email: string) => Promise<ActionResult>;
        getUserPreferences: (userID: string) => Promise<unknown>;
        getUser: (userID: string) => Promise<unknown>;
    };
}

type State = {
    active_tab?: string;
    active_section: string;
    showConfirmModal: boolean;
    enforceFocus?: boolean;
    show: boolean;
    resendStatus: string;
    loading: boolean;
};

class UserSettingsModal extends React.PureComponent<Props, State> {
    private requireConfirm: boolean;
    private customConfirmAction: ((handleConfirm: () => void) => void) | null;
    private afterConfirm: (() => void) | null;
    private modalBodyRef: React.RefObject<HTMLDivElement>;

    constructor(props: Props) {
        super(props);

        this.state = {
            active_tab: props.activeTab ?? (props.isContentProductSettings ? 'notifications' : 'profile'),
            active_section: '',
            showConfirmModal: false,
            enforceFocus: true,
            show: true,
            resendStatus: '',
            loading: false,
        };

        this.requireConfirm = false;

        // Used when settings want to override the default confirm modal with their own
        // If set by a child, it will be called in place of showing the regular confirm
        // modal. It will be passed a function to call on modal confirm
        this.customConfirmAction = null;
        this.afterConfirm = null;

        this.modalBodyRef = React.createRef();
    }

    handleResend = (email: string) => {
        this.setState({resendStatus: 'sending'});

        this.props.actions.sendVerificationEmail(email).then(({data, error: err}) => {
            if (data) {
                this.setState({resendStatus: 'success'});
            } else if (err) {
                this.setState({resendStatus: 'failure'});
            }
        });
    };

    componentDidMount() {
        document.addEventListener('keydown', this.handleKeyDown);

        if (this.props.adminMode && this.props.userID) {
            this.setState({loading: true});

            if (!this.props.userPreferences) {
                this.props.actions.getUserPreferences(this.props.userID);
            }
            if (!this.props.user) {
                this.props.actions.getUser(this.props.userID);
            }
        }

        if (!this.props.adminMode) {
            this.setState({loading: false});
        }
    }

    componentWillUnmount() {
        document.removeEventListener('keydown', this.handleKeyDown);
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        if (this.state.active_tab !== prevState.active_tab) {
            // Scroll to top if user changes tabs
            if (this.modalBodyRef.current) {
                const el = this.modalBodyRef.current as HTMLDivElement;
                el.scrollTop = 0;
            }
        }
    }

    setLoadingFinished = () => {
        this.setState({loading: false});
    };

    handleKeyDown = (e: KeyboardEvent) => {
        // Ctrl+Shift+A (or Cmd+Shift+A) to close
        if (cmdOrCtrlPressed(e) && e.shiftKey && isKeyPressed(e, Constants.KeyCodes.A)) {
            e.preventDefault();
            this.handleHide();
        }
    };

    // Called when the close button is pressed on the main modal
    handleHide = () => {
        if (this.requireConfirm) {
            this.showConfirmModal(() => this.handleHide());
            return;
        }

        // Cancel any ongoing notification sound, if any (from DesktopNotificationSettings)
        stopTryNotificationRing();
        this.setState({show: false});
    };

    // called after the dialog is fully hidden and faded out
    handleHidden = () => {
        this.setState({
            active_tab: this.props.isContentProductSettings ? 'notifications' : 'profile',
            active_section: '',
        });
        if (this.props.focusOriginElement) {
            focusElement(this.props.focusOriginElement, true);
        }
        this.props.onExited();
    };

    // Called to hide the settings pane when on mobile
    handleCollapse = () => {
        const el = ReactDOM.findDOMNode(this.modalBodyRef.current) as HTMLDivElement;
        el.closest('.modal-dialog')!.classList.remove('display--content');

        this.setState({
            active_tab: '',
            active_section: '',
        });
    };

    handleConfirm = () => {
        this.setState({
            showConfirmModal: false,
            enforceFocus: true,
        });
        this.requireConfirm = false;
        this.customConfirmAction = null;

        if (this.afterConfirm) {
            this.afterConfirm();
            this.afterConfirm = null;
        }
    };

    handleCancelConfirmation = () => {
        this.setState({
            showConfirmModal: false,
            enforceFocus: true,
        });
        this.afterConfirm = null;
    };

    showConfirmModal = (afterConfirm: () => void) => {
        if (afterConfirm) {
            this.afterConfirm = afterConfirm;
        }

        if (this.customConfirmAction) {
            this.customConfirmAction(this.handleConfirm);
            return;
        }

        this.setState({
            showConfirmModal: true,
            enforceFocus: false,
        });
    };

    // Called by settings tabs when their close button is pressed
    closeModal = () => {
        if (this.requireConfirm) {
            this.showConfirmModal(this.closeModal);
        } else {
            this.handleHide();
        }
    };

    // Called by settings tabs when their back button is pressed
    collapseModal = () => {
        if (this.requireConfirm) {
            this.showConfirmModal(this.collapseModal);
        } else {
            this.handleCollapse();
        }
    };

    updateTab = (tab?: string, skipConfirm?: boolean) => {
        if (!skipConfirm && this.requireConfirm) {
            this.showConfirmModal(() => this.updateTab(tab, true));
        } else {
            this.setState({
                active_tab: tab,
                active_section: '',
            });
        }
    };

    updateSection = (section?: string, skipConfirm?: boolean) => {
        if (!skipConfirm && this.requireConfirm) {
            this.showConfirmModal(() => this.updateSection(section, true));
        } else {
            this.setState({active_section: section ?? ''});
        }
    };

    getUserSettingsTabs = () => {
        const {formatMessage} = this.props.intl;
        return [
            {
                name: 'notifications',
                uiName: formatMessage({id: 'user.settings.modal.notifications', defaultMessage: 'Notifications'}),
                icon: 'icon icon-bell-outline',
                iconTitle: formatMessage({id: 'user.settings.notifications.icon', defaultMessage: 'Notification Settings Icon'}),
            },
            {
                name: 'display',
                uiName: formatMessage({id: 'user.settings.modal.display', defaultMessage: 'Display'}),
                icon: 'icon icon-eye-outline',
                iconTitle: formatMessage({id: 'user.settings.display.icon', defaultMessage: 'Display Settings Icon'}),
            },
            {
                name: 'sidebar',
                uiName: formatMessage({id: 'user.settings.modal.sidebar', defaultMessage: 'Sidebar'}),
                icon: 'icon icon-dock-left',
                iconTitle: formatMessage({id: 'user.settings.sidebar.icon', defaultMessage: 'Sidebar Settings Icon'}),
            },
            {
                name: 'advanced',
                uiName: formatMessage({id: 'user.settings.modal.advanced', defaultMessage: 'Advanced'}),
                icon: 'icon icon-tune',
                iconTitle: formatMessage({id: 'user.settings.advance.icon', defaultMessage: 'Advanced Settings Icon'}),
            },
        ];
    };

    getProfileSettingsTab = () => {
        const {formatMessage} = this.props.intl;
        return [
            {
                name: 'profile',
                uiName: formatMessage({id: 'user.settings.modal.profile', defaultMessage: 'Profile'}),
                icon: 'icon icon-settings-outline',
                iconTitle: formatMessage({id: 'user.settings.profile.icon', defaultMessage: 'Profile Settings Icon'}),
            },
            {
                name: 'security',
                uiName: formatMessage({id: 'user.settings.modal.security', defaultMessage: 'Security'}),
                icon: 'icon icon-lock-outline',
                iconTitle: formatMessage({id: 'user.settings.security.icon', defaultMessage: 'Security Settings Icon'}),
            },
        ];
    };

    getPluginsSettingsTab = () => {
        return Object.values(this.props.pluginSettings).map((v) => {
            const useURL = v.icon && (isValidUrl(v.icon) || v.icon.startsWith('/'));
            const className = v.icon ? `icon ${v.icon}` : 'icon icon-power-plug-outline';
            return {
                name: v.id,
                uiName: v.uiName,
                icon: useURL ? {url: v.icon!} : className,
                iconTitle: v.uiName,
            };
        });
    };

    render() {
        const {formatMessage} = this.props.intl;

        let modalTitle: string;
        if (this.props.adminMode && this.props.user) {
            modalTitle = formatMessage(
                {id: 'userSettings.adminMode.modal_header', defaultMessage: "{userDisplayName}'s Settings"},
                {userDisplayName: getDisplayName(this.props.user)},
            );
        } else if (this.props.isContentProductSettings) {
            modalTitle = formatMessage({id: 'global_header.productSettings', defaultMessage: 'Settings'});
        } else {
            modalTitle = formatMessage({id: 'user.settings.modal.title', defaultMessage: 'Profile'});
        }

        const headerTitle = (
            <div
                className='UserSettingsModal__headerWrapper'
                id='accountSettingsHeader'
            >
                <span
                    id='accountSettingsModalLabel'
                    className='modal-header__title'
                >
                    {modalTitle}
                </span>
                {this.props.adminMode && (
                    <div className='adminModeBadge'>
                        <FormattedMessage
                            id='userSettings.adminMode.admin_mode_badge'
                            defaultMessage='Admin Mode'
                        />
                    </div>
                )}
            </div>
        );

        return (
            <GenericModal
                id='accountSettingsModal'
                className='a11y__modal settings-modal UserSettingsModal'
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleHidden}
                ariaLabel={modalTitle}
                compassDesign={true}
                enforceFocus={this.state.enforceFocus}
                bodyPadding={false}
                modalHeaderText={headerTitle}
                modalLocation='top'
                delayFocusTrap={true}
            >
                <div
                    ref={this.modalBodyRef}
                >
                    {/* Admin Mode: wait for user + preferences */}
                    {this.props.adminMode &&
                        <SmartLoader
                            loading={this.props.adminMode && (!this.props.userPreferences || !this.props.user)}
                            className='loadingIndicator'
                            onLoaded={this.setLoadingFinished}
                        >
                            <LoadingSpinner/>
                        </SmartLoader>
                    }

                    {/* Show content only when not loading */}
                    {!this.state.loading && this.props.user &&
                        <>
                            <div className='settings-table'>
                                <div className='settings-links'>
                                    <SettingsSidebar
                                        tabs={this.props.isContentProductSettings ? this.getUserSettingsTabs() : this.getProfileSettingsTab()}
                                        pluginTabs={this.props.isContentProductSettings ? this.getPluginsSettingsTab() : []}
                                        activeTab={this.state.active_tab}
                                        updateTab={this.updateTab}
                                    />
                                </div>
                                <div className='settings-content minimize-settings'>
                                    <UserSettings
                                        activeTab={this.state.active_tab}
                                        activeSection={this.state.active_section}
                                        updateSection={this.updateSection}
                                        updateTab={this.updateTab}
                                        closeModal={this.closeModal}
                                        collapseModal={this.collapseModal}
                                        setRequireConfirm={(requireConfirm?: boolean, customConfirmAction?: () => () => void) => {
                                            this.requireConfirm = requireConfirm || false;
                                            this.customConfirmAction = customConfirmAction || null;
                                        }}
                                        pluginSettings={this.props.pluginSettings}
                                        user={this.props.user}
                                        adminMode={this.props.adminMode}
                                        userPreferences={this.props.userPreferences}
                                    />
                                </div>
                            </div>
                        </>
                    }
                </div>

                <ConfirmModal
                    title={formatMessage({id: 'user.settings.modal.confirmTitle', defaultMessage: 'Discard Changes?'})}
                    message={formatMessage({
                        id: 'user.settings.modal.confirmMsg',
                        defaultMessage: 'You have unsaved changes, are you sure you want to discard them?',
                    })}
                    confirmButtonText={formatMessage({
                        id: 'user.settings.modal.confirmBtns',
                        defaultMessage: 'Yes, Discard',
                    })}
                    show={this.state.showConfirmModal}
                    onConfirm={this.handleConfirm}
                    onCancel={this.handleCancelConfirmation}
                />
            </GenericModal>
        );
    }
}

export default injectIntl(UserSettingsModal);
