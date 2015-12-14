// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import ConfirmModal from '../confirm_modal.jsx';
const Modal = ReactBootstrap.Modal;
import SettingsSidebar from '../settings_sidebar.jsx';
import UserSettings from './user_settings.jsx';

const messages = defineMessages({
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
    appearance: {
        id: 'user.settings.modal.appearance',
        defaultMessage: 'Appearance'
    },
    developer: {
        id: 'user.settings.modal.developer',
        defaultMessage: 'Developer'
    },
    integrations: {
        id: 'user.settings.modal.integrations',
        defaultMessage: 'Integrations'
    },
    languages: {
        id: 'user.settings.modal.languages',
        defaultMessage: 'Languages'
    },
    close: {
        id: 'user.settings.modal.close',
        defaultMessage: 'Close'
    },
    title: {
        id: 'user.settings.modal.title',
        defaultMessage: 'Account Settings'
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
    },
    display: {
        id: 'user.settings.modal.display',
        defaultMessage: 'Display'
    },
    advanced: {
        id: 'user.settings.modal.advanced',
        defaultMessage: 'Advanced'
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

        this.state = {
            active_tab: 'general',
            active_section: '',
            showConfirmModal: false,
            enforceFocus: true
        };

        this.requireConfirm = false;
    }

    componentDidMount() {
        if (this.props.show) {
            this.handleShow();
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.show && !prevProps.show) {
            this.handleShow();
        }
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

            return false;
        }

        this.deactivateTab();
        this.props.onModalDismissed();
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
            this.setState({active_section: section});
        }
    }

    render() {
        const {formatMessage} = this.props.intl;
        var tabs = [];
        tabs.push({name: 'general', uiName: formatMessage(messages.general), icon: 'glyphicon glyphicon-cog'});
        tabs.push({name: 'security', uiName: formatMessage(messages.security), icon: 'glyphicon glyphicon-lock'});
        tabs.push({name: 'notifications', uiName: formatMessage(messages.notifications), icon: 'glyphicon glyphicon-exclamation-sign'});
        tabs.push({name: 'appearance', uiName: formatMessage(messages.appearance), icon: 'glyphicon glyphicon-wrench'});
        if (global.window.mm_config.EnableOAuthServiceProvider === 'true') {
            tabs.push({name: 'developer', uiName: formatMessage(messages.developer), icon: 'glyphicon glyphicon-th'});
        }

        if (global.window.mm_config.EnableIncomingWebhooks === 'true' || global.window.mm_config.EnableOutgoingWebhooks === 'true') {
            tabs.push({name: 'integrations', uiName: formatMessage(messages.integrations), icon: 'glyphicon glyphicon-transfer'});
        }
        tabs.push({name: 'display', uiName: formatMessage(messages.display), icon: 'glyphicon glyphicon-eye-open'});
        tabs.push({name: 'advanced', uiName: formatMessage(messages.advanced), icon: 'glyphicon glyphicon-list-alt'});
        tabs.push({name: 'languages', uiName: formatMessage(messages.languages), icon: 'glyphicon glyphicon-flag'});

        return (
            <Modal
                dialogClassName='settings-modal'
                show={this.props.show}
                onHide={this.handleHide}
                onExited={this.handleHidden}
                enforceFocus={this.state.enforceFocus}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>{formatMessage(messages.title)}</Modal.Title>
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
                                setRequireConfirm={(requireConfirm) => this.requireConfirm = requireConfirm}
                            />
                        </div>
                    </div>
                </Modal.Body>
                <ConfirmModal
                    title={formatMessage(messages.confirmTitle)}
                    message={formatMessage(messages.confirmMsg)}
                    confirm_button={formatMessage(messages.confirmBtns)}
                    show={this.state.showConfirmModal}
                    onConfirm={this.handleConfirm}
                    onCancel={this.handleCancelConfirmation}
                />
            </Modal>
        );
    }
}

UserSettingsModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onModalDismissed: React.PropTypes.func.isRequired,
    intl: intlShape.isRequired
};

export default injectIntl(UserSettingsModal);