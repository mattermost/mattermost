// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';
import ManageIncomingHooks from './manage_incoming_hooks.jsx';
import ManageOutgoingHooks from './manage_outgoing_hooks.jsx';
import ManageCommandHooks from './manage_command_hooks.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'mm-intl';

const holders = defineMessages({
    inName: {
        id: 'user.settings.integrations.incomingWebhooks',
        defaultMessage: 'Incoming Webhooks'
    },
    inDesc: {
        id: 'user.settings.integrations.incomingWebhooksDescription',
        defaultMessage: 'Manage your incoming webhooks'
    },
    outName: {
        id: 'user.settings.integrations.outWebhooks',
        defaultMessage: 'Outgoing Webhooks'
    },
    outDesc: {
        id: 'user.settings.integrations.outWebhooksDescription',
        defaultMessage: 'Manage your outgoing webhooks'
    },
    cmdName: {
        id: 'user.settings.integrations.commands',
        defaultMessage: 'Slash Commands'
    },
    cmdDesc: {
        id: 'user.settings.integrations.commandsDescription',
        defaultMessage: 'Manage your slash commands'
    }
});

class UserSettingsIntegrationsTab extends React.Component {
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
        let commandHooksSection;
        var inputs = [];
        const {formatMessage} = this.props.intl;

        if (global.window.mm_config.EnableIncomingWebhooks === 'true') {
            if (this.props.activeSection === 'incoming-hooks') {
                inputs.push(
                    <ManageIncomingHooks key='incoming-hook-ui'/>
                );

                incomingHooksSection = (
                    <SettingItemMax
                        title={formatMessage(holders.inName)}
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
                        title={formatMessage(holders.inName)}
                        width='medium'
                        describe={formatMessage(holders.inDesc)}
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
                    <ManageOutgoingHooks key='outgoing-hook-ui'/>
                );

                outgoingHooksSection = (
                    <SettingItemMax
                        title={formatMessage(holders.outName)}
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
                        title={formatMessage(holders.outName)}
                        width='medium'
                        describe={formatMessage(holders.outDesc)}
                        updateSection={() => {
                            this.updateSection('outgoing-hooks');
                        }}
                    />
                );
            }
        }

        if (global.window.mm_config.EnableCommands === 'true') {
            if (this.props.activeSection === 'command-hooks') {
                inputs.push(
                    <ManageCommandHooks key='command-hook-ui'/>
                );

                commandHooksSection = (
                    <SettingItemMax
                        title={formatMessage(holders.cmdName)}
                        width='medium'
                        inputs={inputs}
                        updateSection={(e) => {
                            this.updateSection('');
                            e.preventDefault();
                        }}
                    />
                );
            } else {
                commandHooksSection = (
                    <SettingItemMin
                        title={formatMessage(holders.cmdName)}
                        width='medium'
                        describe={formatMessage(holders.cmdDesc)}
                        updateSection={() => {
                            this.updateSection('command-hooks');
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
                        <div className='modal-back'>
                            <i
                                className='fa fa-angle-left'
                                onClick={this.props.collapseModal}
                            />
                        </div>
                        <FormattedMessage
                            id='user.settings.integrations.title'
                            defaultMessage='Integration Settings'
                        />
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>
                        <FormattedMessage
                            id='user.settings.integrations.title'
                            defaultMessage='Integration Settings'
                        />
                    </h3>
                    <div className='divider-dark first'/>
                    {incomingHooksSection}
                    <div className='divider-light'/>
                    {outgoingHooksSection}
                    <div className='divider-dark'/>
                    {commandHooksSection}
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
}

UserSettingsIntegrationsTab.propTypes = {
    intl: intlShape.isRequired,
    user: React.PropTypes.object,
    updateSection: React.PropTypes.func,
    updateTab: React.PropTypes.func,
    activeSection: React.PropTypes.string,
    closeModal: React.PropTypes.func.isRequired,
    collapseModal: React.PropTypes.func.isRequired
};

export default injectIntl(UserSettingsIntegrationsTab);