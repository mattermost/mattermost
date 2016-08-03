// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import ReactDOM from 'react-dom';
import ConfirmModal from '../confirm_modal.jsx';
import UserSettings from './user_settings.jsx';
import SettingsSidebar from '../settings_sidebar.jsx';

import UserStore from 'stores/user_store.jsx';
import * as Utils from 'utils/utils.jsx';

import {Modal} from 'react-bootstrap';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'react-intl';

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

import React from 'react';

class UserSettingsModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleHide = this.handleHide.bind(this);
        this.handleHidden = this.handleHidden.bind(this);
        this.handleCollapse = this.handleCollapse.bind(this);
        this.handleConfirm = this.handleConfirm.bind(this);
        this.handleCancelConfirmation = this.handleCancelConfirmation.bind(this);

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
        UserStore.addChangeListener(this.onUserChanged);
    }

    componentDidUpdate() {
        UserStore.removeChangeListener(this.onUserChanged);
        if (!Utils.isMobile()) {
            $('.settings-modal .modal-body').perfectScrollbar();
        }
    }

    // Called when the close button is pressed on the main modal
    handleHide() {
        if (this.requireConfirm) {
            this.afterConfirm = () => this.handleHide();
            this.showConfirmModal();

            return;
        }

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
            this.setState({
                active_tab: tab,
                active_section: ''
            });
        }

        if (!Utils.isMobile()) {
            $('.settings-modal .modal-body').scrollTop(0).perfectScrollbar('update');
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
        if (this.state.currentUser == null) {
            return (<div/>);
        }
        var tabs = [];

        tabs.push({name: 'general', uiName: formatMessage(holders.general), icon: 'icon fa fa-gear'});
        tabs.push({name: 'security', uiName: formatMessage(holders.security), icon: 'icon fa fa-lock'});
        tabs.push({name: 'notifications', uiName: formatMessage(holders.notifications), icon: 'icon fa fa-exclamation-circle'});
        tabs.push({name: 'display', uiName: formatMessage(holders.display), icon: 'icon fa fa-eye'});
        tabs.push({name: 'advanced', uiName: formatMessage(holders.advanced), icon: 'icon fa fa-list-alt'});

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
