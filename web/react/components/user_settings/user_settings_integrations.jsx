// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var SettingItemMin = require('../setting_item_min.jsx');
var SettingItemMax = require('../setting_item_max.jsx');
var ManageIncomingHooks = require('./manage_incoming_hooks.jsx');

export default class UserSettingsIntegrationsTab extends React.Component {
    constructor(props) {
        super(props);

        this.updateSection = this.updateSection.bind(this);
        this.handleClose = this.handleClose.bind(this);

        this.state = {};
    }
    updateSection(section) {
        this.props.updateSection(section);
    }
    handleClose() {
        this.updateSection('');
    }
    componentDidMount() {
        $('#user_settings').on('hidden.bs.modal', this.handleClose);
    }
    componentWillUnmount() {
        $('#user_settings').off('hidden.bs.modal', this.handleClose);
    }
    render() {
        let incomingHooksSection;
        var inputs = [];

        if (this.props.activeSection === 'incoming-hooks') {
            inputs.push(
                <ManageIncomingHooks />
            );

            incomingHooksSection = (
                <SettingItemMax
                    title='Incoming Webhooks'
                    inputs={inputs}
                    updateSection={function clearSection(e) {
                        this.updateSection('');
                        e.preventDefault();
                    }.bind(this)}
                />
            );
        } else {
            incomingHooksSection = (
                <SettingItemMin
                    title='Incoming Webhooks'
                    describe='Manage your incoming webhooks'
                    updateSection={function updateNameSection() {
                        this.updateSection('incoming-hooks');
                    }.bind(this)}
                />
            );
        }

        return (
            <div>
                <div className='modal-header'>
                    <button
                        type='button'
                        className='close'
                        data-dismiss='modal'
                        aria-label='Close'
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <i className='modal-back'></i>
                        {'Integration Settings'}
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>{'Integration Settings'}</h3>
                    <div className='divider-dark first'/>
                    {incomingHooksSection}
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
}

UserSettingsIntegrationsTab.propTypes = {
    user: React.PropTypes.object,
    updateSection: React.PropTypes.func,
    updateTab: React.PropTypes.func,
    activeSection: React.PropTypes.string
};
