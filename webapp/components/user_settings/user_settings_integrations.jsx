// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';
import ManageCommandHooks from './manage_command_hooks.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage} from 'react-intl';

const holders = defineMessages({
    cmdName: {
        id: 'user.settings.integrations.commands',
        defaultMessage: 'Slash Commands'
    },
    cmdDesc: {
        id: 'user.settings.integrations.commandsDescription',
        defaultMessage: 'Manage your slash commands'
    }
});

import React from 'react';

class UserSettingsIntegrationsTab extends React.Component {
    constructor(props) {
        super(props);

        this.updateSection = this.updateSection.bind(this);

        this.state = {};
    }
    updateSection(section) {
        $('.settings-modal .modal-body').scrollTop(0).perfectScrollbar('update');
        this.props.updateSection(section);
    }
    render() {
        let commandHooksSection;
        var inputs = [];
        const {formatMessage} = this.props.intl;

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
