// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';
import ManageIncomingHooks from './manage_incoming_hooks.jsx';
import ManageOutgoingHooks from './manage_outgoing_hooks.jsx';

export default class UserSettingsIntegrationsTab extends React.Component {
    constructor(props) {
        super(props);

        this.updateSection = this.updateSection.bind(this);

        this.state = {};
    }
    updateSection(section) {
        this.props.updateSection(section);
    }
    render() {
        let incomingHooksSection;
        let outgoingHooksSection;
        var inputs = [];

        if (global.window.mm_config.EnableIncomingWebhooks === 'true') {
            if (this.props.activeSection === 'incoming-hooks') {
                inputs.push(
                    <ManageIncomingHooks key='incoming-hook-ui' />
                );

                incomingHooksSection = (
                    <SettingItemMax
                        title='Incoming Webhooks'
                        width='medium'
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
                        width='medium'
                        describe='Manage your incoming webhooks'
                        updateSection={() => {
                            this.updateSection('incoming-hooks');
                        }}
                    />
                );
            }
        }

        if (global.window.mm_config.EnableOutgoingWebhooks === 'true') {
            if (this.props.activeSection === 'outgoing-hooks') {
                inputs.push(
                    <ManageOutgoingHooks key='outgoing-hook-ui' />
                );

                outgoingHooksSection = (
                    <SettingItemMax
                        title='Outgoing Webhooks'
                        width='medium'
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
                        width='medium'
                        describe='Manage your outgoing webhooks'
                        updateSection={() => {
                            this.updateSection('outgoing-hooks');
                        }}
                    />
                );
            }
        }

        return (
            <div>
                <div className='modal-header'>
                    <button
                        type='button'
                        className='close'
                        data-dismiss='modal'
                        aria-label='Close'
                        onClick={this.props.closeModal}
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <i
                            className='modal-back'
                            onClick={this.props.collapseModal}
                        />
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
    activeSection: React.PropTypes.string,
    closeModal: React.PropTypes.func.isRequired,
    collapseModal: React.PropTypes.func.isRequired
};
