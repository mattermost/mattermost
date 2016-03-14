// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ConfirmModal from '../confirm_modal.jsx';
import UserSettings from './user_settings.jsx';
import SettingsSidebar from '../settings_sidebar.jsx';

import UserStore from '../../stores/user_store.jsx';
import * as Utils from '../../utils/utils.jsx';
import Constants from '../../utils/constants.jsx';

const Modal = ReactBootstrap.Modal;

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    general: {
        id: 'user.settings.modal.general',
        defaultMessage: 'General'
    },
    security: {
        id: 'user.settings.modal.security',
        defaultMessage: 'Security'
    },
    notifications: {
        id: 'user.settings.modal.notifications',
        defaultMessage: 'Notifications'
    },
    developer: {
        id: 'user.settings.modal.developer',
        defaultMessage: 'Developer'
    },
    integrations: {
        id: 'user.settings.modal.integrations',
        defaultMessage: 'Integrations'
    },
    display: {
        id: 'user.settings.modal.display',
        defaultMessage: 'Display'
    },
    advanced: {
        id: 'user.settings.modal.advanced',
        defaultMessage: 'Advanced'
    },
    confirmTitle: {
        id: 'user.settings.modal.confirmTitle',
        defaultMessage: 'Discard Changes?'
    },
    confirmMsg: {
        id: 'user.settings.modal.confirmMsg',
        defaultMessage: 'You have unsaved changes, are you sure you want to discard them?'
    },
    confirmBtns: {
        id: 'user.settings.modal.confirmBtns',
        defaultMessage: 'Yes, Discard'
    }
});

class UserSettingsModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleShow = this.handleShow.bind(this);
        this.handleHide = this.handleHide.bind(this);
        this.handleHidden = this.handleHidden.bind(this);
        this.handleCollapse = this.handleCollapse.bind(this);
        this.handleConfirm = this.handleConfirm.bind(this);
        this.handleCancelConfirmation = this.handleCancelConfirmation.bind(this);

        this.deactivateTab = this.deactivateTab.bind(this);
        this.closeModal = this.closeModal.bind(this);
        this.collapseModal = this.collapseModal.bind(this);

        this.updateTab = this.updateTab.bind(this);
        this.updateSection = this.updateSection.bind(this);
        this.onUserChanged = this.onUserChanged.bind(this);

        this.state = {
            active_tab: 'general',
            active_section: '',
            showConfirmModal: false,
            enforceFocus: true,
            currentUser: UserStore.getCurrentUser()
        };

        this.requireConfirm = false;
    }

    onUserChanged() {
        this.setState({currentUser: UserStore.getCurrentUser()});
    }

    componentDidMount() {
        if (this.props.show) {
            this.handleShow();
        }
        UserStore.addChangeListener(this.onUserChanged);
    }

    componentDidUpdate(prevProps) {
        if (this.props.show && !prevProps.show) {
            this.handleShow();
        }
        UserStore.removeChangeListener(this.onUserChanged);
    }

    handleShow() {
        if ($(window).width() > 768) {
            $(ReactDOM.findDOMNode(this.refs.modalBody)).perfectScrollbar();
            $(ReactDOM.findDOMNode(this.refs.modalBody)).css('max-height', $(window).height() - 200);
        } else {
            $(ReactDOM.findDOMNode(this.refs.modalBody)).css('max-height', $(window).height() - 50);
        }
    }

    // Called when the close button is pressed on the main modal
    handleHide() {
        if (this.requireConfirm) {
            this.afterConfirm = () => this.handleHide();
            this.showConfirmModal();

            return;
        }

        this.resetTheme();
        this.deactivateTab();
        this.props.onModalDismissed();
        return;
    }

    // called after the dialog is fully hidden and faded out
    handleHidden() {
        this.setState({
            active_tab: 'general',
            active_section: ''
        });
    }

    // Called to hide the settings pane when on mobile
    handleCollapse() {
        $(ReactDOM.findDOMNode(this.refs.modalBody)).closest('.modal-dialog').removeClass('display--content');

        this.deactivateTab();

        this.setState({
            active_tab: '',
            active_section: ''
        });
    }

    handleConfirm() {
        this.setState({
            showConfirmModal: false,
            enforceFocus: true
        });

        this.requireConfirm = false;

        if (this.afterConfirm) {
            this.afterConfirm();
            this.afterConfirm = null;
        }
    }

    handleCancelConfirmation() {
        this.setState({
            showConfirmModal: false,
            enforceFocus: true
        });

        this.afterConfirm = null;
    }

    showConfirmModal(afterConfirm) {
        this.setState({
            showConfirmModal: true,
            enforceFocus: false
        });

        if (afterConfirm) {
            this.afterConfirm = afterConfirm;
        }
    }

    // Called to let settings tab perform cleanup before being closed
    deactivateTab() {
        const activeTab = this.refs.userSettings.getActiveTab();
        if (activeTab && activeTab.deactivate) {
            activeTab.deactivate();
        }
    }

    // Called by settings tabs when their close button is pressed
    closeModal() {
        if (this.requireConfirm) {
            this.showConfirmModal(this.closeModal);
        } else {
            this.handleHide();
        }
    }

    // Called by settings tabs when their back button is pressed
    collapseModal() {
        if (this.requireConfirm) {
            this.showConfirmModal(this.collapseModal);
        } else {
            this.handleCollapse();
        }
    }

    updateTab(tab, skipConfirm) {
        if (!skipConfirm && this.requireConfirm) {
            this.showConfirmModal(() => this.updateTab(tab, true));
        } else {
            this.deactivateTab();

            this.setState({
                active_tab: tab,
                active_section: ''
            });
        }
    }

    updateSection(section, skipConfirm) {
        if (!skipConfirm && this.requireConfirm) {
            this.showConfirmModal(() => this.updateSection(section, true));
        } else {
            if (this.state.active_section === 'theme' && section !== 'theme') {
                this.resetTheme();
            }
            this.setState({active_section: section});
        }
    }

    resetTheme() {
        const user = UserStore.getCurrentUser();
        if (user.theme_props == null) {
            Utils.applyTheme(Constants.THEMES.default);
        } else {
            Utils.applyTheme(user.theme_props);
        }
    }

    render() {
        const {formatMessage} = this.props.intl;
        if (this.state.currentUser == null) {
            return (<div/>);
        }
        var isAdmin = Utils.isAdmin(this.state.currentUser.roles);
        var tabs = [];

        tabs.push({name: 'general', uiName: formatMessage(holders.general), icon: 'glyphicon glyphicon-cog'});
        tabs.push({name: 'security', uiName: formatMessage(holders.security), icon: 'glyphicon glyphicon-lock'});
        tabs.push({name: 'notifications', uiName: formatMessage(holders.notifications), icon: 'glyphicon glyphicon-exclamation-sign'});
        if (global.window.mm_config.EnableOAuthServiceProvider === 'true') {
            tabs.push({name: 'developer', uiName: formatMessage(holders.developer), icon: 'glyphicon glyphicon-th'});
        }

        if (global.window.mm_config.EnableIncomingWebhooks === 'true' || global.window.mm_config.EnableOutgoingWebhooks === 'true' || global.window.mm_config.EnableCommands === 'true') {
            var show = global.window.mm_config.EnableOnlyAdminIntegrations !== 'true';

            if (global.window.mm_config.EnableOnlyAdminIntegrations === 'true' && isAdmin) {
                show = true;
            }

            if (show) {
                tabs.push({name: 'integrations', uiName: formatMessage(holders.integrations), icon: 'glyphicon glyphicon-transfer'});
            }
        }

        tabs.push({name: 'display', uiName: formatMessage(holders.display), icon: 'glyphicon glyphicon-eye-open'});
        tabs.push({name: 'advanced', uiName: formatMessage(holders.advanced), icon: 'glyphicon glyphicon-list-alt'});

        return (
            <Modal
                dialogClassName='settings-modal'
                show={this.props.show}
                onHide={this.handleHide}
                onExited={this.handleHidden}
                enforceFocus={this.state.enforceFocus}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>
                        <FormattedMessage
                            id='user.settings.modal.title'
                            defaultMessage='Account Settings'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body ref='modalBody'>
                    <div className='settings-table'>
                        <div className='settings-links'>
                            <SettingsSidebar
                                tabs={tabs}
                                activeTab={this.state.active_tab}
                                updateTab={this.updateTab}
                            />
                        </div>
                        <div className='settings-content minimize-settings'>
                            <UserSettings
                                ref='userSettings'
                                activeTab={this.state.active_tab}
                                activeSection={this.state.active_section}
                                updateSection={this.updateSection}
                                updateTab={this.updateTab}
                                closeModal={this.closeModal}
                                collapseModal={this.collapseModal}
                                setEnforceFocus={(enforceFocus) => this.setState({enforceFocus})}
                                setRequireConfirm={
                                    (requireConfirm) => {
                                        this.requireConfirm = requireConfirm;
                                        return;
                                    }
                                }
                            />
                        </div>
                    </div>
                </Modal.Body>
                <ConfirmModal
                    title={formatMessage(holders.confirmTitle)}
                    message={formatMessage(holders.confirmMsg)}
                    confirmButton={formatMessage(holders.confirmBtns)}
                    show={this.state.showConfirmModal}
                    onConfirm={this.handleConfirm}
                    onCancel={this.handleCancelConfirmation}
                />
            </Modal>
        );
    }
}

UserSettingsModal.propTypes = {
    intl: intlShape.isRequired,
    show: React.PropTypes.bool.isRequired,
    onModalDismissed: React.PropTypes.func.isRequired
};

export default injectIntl(UserSettingsModal);
