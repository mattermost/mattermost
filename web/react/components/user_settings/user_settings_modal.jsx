// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

const Modal = ReactBootstrap.Modal;
var SettingsSidebar = require('../settings_sidebar.jsx');
var UserSettings = require('./user_settings.jsx');

export default class UserSettingsModal extends React.Component {
    constructor(props) {
        super(props);

        this.handleHide = this.handleHide.bind(this);
        this.handleHidden = this.handleHidden.bind(this);

        this.updateTab = this.updateTab.bind(this);
        this.updateSection = this.updateSection.bind(this);

        this.state = {
            active_tab: 'general',
            active_section: ''
        };
    }

    componentDidMount() {
        $('body').on('click', '.settings-content .modal-back', () => {
            $(this).closest('.modal-dialog').removeClass('display--content');
        });
        $('body').on('click', '.settings-content .modal-header .close', () => {
            this.handleHide();

            setTimeout(() => {
                $('.modal-dialog.display--content').removeClass('display--content');
            }, 500);
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

    handleHide() {
        // called when the close button is pressed
        this.props.onModalDismissed();
    }

    handleHidden() {
        // called after the dialog is fully hidden and faded out
        this.setState({
            active_tag: 'general',
            active_section: ''
        });
    }

    updateTab(tab) {
        this.setState({active_tab: tab});
    }

    updateSection(section) {
        this.setState({active_section: section});
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
                            />
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
        );
    }
}

UserSettingsModal.propTypes = {
    show: React.PropTypes.bool.isRequired,
    onModalDismissed: React.PropTypes.func.isRequired
};
