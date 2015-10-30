// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const ConfirmModal = require('../confirm_modal.jsx');
const Modal = ReactBootstrap.Modal;
const SettingsSidebar = require('../settings_sidebar.jsx');
const UserSettings = require('./user_settings.jsx');

export default class UserSettingsModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleHide = this.handleHide.bind(this);
        this.handleHidden = this.handleHidden.bind(this);
        this.handleConfirm = this.handleConfirm.bind(this);
        this.handleCancelConfirmation = this.handleCancelConfirmation.bind(this);

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
        $('body').on('click', '.settings-content .modal-back', () => {
            if (!this.requireConfirm) {
                $(this).closest('.modal-dialog').removeClass('display--content');
            }
        });
        $('body').on('click', '.settings-content .modal-header .close', () => {
            if (!this.props.show) {
                return;
            }

            this.handleHide();

            if (!this.requireConfirm) {
                setTimeout(() => {
                    $('.modal-dialog.display--content').removeClass('display--content');
                }, 500);
            }
        });
    }

    componentDidUpdate(prevProps) {
        if (!prevProps.show && this.props.show) {
            $(ReactDOM.findDOMNode(this.refs.modalBody)).css('max-height', $(window).height() - 300);
            if ($(window).width() > 768) {
                $(ReactDOM.findDOMNode(this.refs.modalBody)).perfectScrollbar();
            }
        }
    }

    // called when the close button is pressed
    handleHide(skipConfirm) {
        if (!skipConfirm && this.requireConfirm) {
            this.afterConfirm = () => this.handleHide(true);
            this.showConfirmModal();

            return false;
        }

        this.props.onModalDismissed();
    }

    // called after the dialog is fully hidden and faded out
    handleHidden() {
        this.setState({
            active_tab: 'general',
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
    }

    showConfirmModal() {
        this.setState({
            showConfirmModal: true,
            enforceFocus: false
        });
    }

    updateTab(tab, skipConfirm) {
        if (!skipConfirm && this.requireConfirm) {
            this.afterConfirm = () => this.updateTab(tab, true);
            this.showConfirmModal();
        } else {
            this.setState({
                active_tab: tab,
                active_section: ''
            });
        }
    }

    updateSection(section, skipConfirm) {
        if (!skipConfirm && this.requireConfirm) {
            this.afterConfirm = () => this.updateSection(section, true);
            this.showConfirmModal();
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
