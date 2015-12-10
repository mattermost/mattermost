// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';
import ManageIncomingHooks from './manage_incoming_hooks.jsx';
import ManageOutgoingHooks from './manage_outgoing_hooks.jsx';

const messages = defineMessages({
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
    title: {
        id: 'user.settings.integrations.title',
        defaultMessage: 'Integration Settings'
    },
    close: {
        id: 'user.settings.integrations.close',
        defaultMessage: 'Close'
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
        const {formatMessage} = this.props.intl;
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
                        title={formatMessage(messages.inName)}
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
                        title={formatMessage(messages.inName)}
                        width='medium'
                        describe={formatMessage(messages.inDesc)}
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
                        title={formatMessage(messages.outName)}
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
                        title={formatMessage(messages.outName)}
                        width='medium'
                        describe={formatMessage(messages.outDesc)}
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
                        aria-label={formatMessage(messages.close)}
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
                        {formatMessage(messages.title)}
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>{formatMessage(messages.title)}</h3>
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
    intl: intlShape.isRequired,
    user: React.PropTypes.object,
    updateSection: React.PropTypes.func,
    updateTab: React.PropTypes.func,
    activeSection: React.PropTypes.string,
    closeModal: React.PropTypes.func.isRequired,
    collapseModal: React.PropTypes.func.isRequired
};

export default injectIntl(UserSettingsIntegrationsTab);