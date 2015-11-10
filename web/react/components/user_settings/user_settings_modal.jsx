// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const ConfirmModal = require('../confirm_modal.jsx');
const Modal = require('../modal.jsx');
const SettingsSidebar = require('../settings_sidebar.jsx');
const UserSettings = require('./user_settings.jsx');

export default class UserSettingsModal extends React.Component {
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

    handleShow() {
        $(ReactDOM.findDOMNode(this.refs.modalBody)).css('max-height', $(window).height() - 300);
        if ($(window).width() > 768) {
            $(ReactDOM.findDOMNode(this.refs.modalBody)).perfectScrollbar();
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
        var tabs = [];
        tabs.push({name: 'general', uiName: 'General', icon: 'glyphicon glyphicon-cog'});
        tabs.push({name: 'security', uiName: 'Security', icon: 'glyphicon glyphicon-lock'});
        tabs.push({name: 'notifications', uiName: 'Notifications', icon: 'glyphicon glyphicon-exclamation-sign'});
        tabs.push({name: 'appearance', uiName: 'Appearance', icon: 'glyphicon glyphicon-wrench'});
        if (global.window.mm_config.EnableOAuthServiceProvider === 'true') {
            tabs.push({name: 'developer', uiName: 'Developer', icon: 'glyphicon glyphicon-th'});
        }

        if (global.window.mm_config.EnableIncomingWebhooks === 'true' || global.window.mm_config.EnableOutgoingWebhooks === 'true') {
            tabs.push({name: 'integrations', uiName: 'Integrations', icon: 'glyphicon glyphicon-transfer'});
        }
        tabs.push({name: 'display', uiName: 'Display', icon: 'glyphicon glyphicon-eye-open'});
        tabs.push({name: 'advanced', uiName: 'Advanced', icon: 'glyphicon glyphicon-list-alt'});

        return (
            <Modal
                dialogClassName='settings-modal'
                show={this.props.show}
                onShow={this.handleShow}
                onHide={this.handleHide}
                onExited={this.handleHidden}
                enforceFocus={this.state.enforceFocus}
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title>{'Account Settings'}</Modal.Title>
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
                    title='Discard Changes?'
                    message='You have unsaved changes, are you sure you want to discard them?'
                    confirm_button='Yes, Discard'
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
    onModalDismissed: React.PropTypes.func.isRequired
};
