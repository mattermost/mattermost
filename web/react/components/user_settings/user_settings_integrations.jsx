// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var SettingItemMin = require('../setting_item_min.jsx');
var SettingItemMax = require('../setting_item_max.jsx');
var ManageIncomingHooks = require('./manage_incoming_hooks.jsx');
var ManageOutgoingHooks = require('./manage_outgoing_hooks.jsx');

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
        let outgoingHooksSection;
        var inputs = [];

        if (this.props.activeSection === 'incoming-hooks') {
            inputs.push(
                <ManageIncomingHooks />
            );

            incomingHooksSection = (
                <SettingItemMax
                    title='Incoming Webhooks'
                    width = 'full'
                    inputs={inputs}
                    updateSection={(e) => {
                        this.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        } else {
            incomingHooksSection = (
                <SettingItemMin
                    title='Incoming Webhooks'
                    width = 'full'
                    describe='Manage your incoming webhooks (Developer feature)'
                    updateSection={() => {
                        this.updateSection('incoming-hooks');
                    }}
                />
            );
        }

        if (this.props.activeSection === 'outgoing-hooks') {
            inputs.push(
                <ManageOutgoingHooks />
            );

            outgoingHooksSection = (
                <SettingItemMax
                    title='Outgoing Webhooks'
                    inputs={inputs}
                    updateSection={(e) => {
                        this.updateSection('');
                        e.preventDefault();
                    }}
                />
            );
        } else {
            outgoingHooksSection = (
                <SettingItemMin
                    title='Outgoing Webhooks'
                    describe='Manage your outgoing webhooks'
                    updateSection={() => {
                        this.updateSection('outgoing-hooks');
                    }}
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
                    <div className='divider-light'/>
                    {outgoingHooksSection}
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
