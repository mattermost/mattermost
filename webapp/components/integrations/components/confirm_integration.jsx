// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import BackstageHeader from 'components/backstage/components/backstage_header.jsx';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';
import {browserHistory, Link} from 'react-router/es6';
import SpinnerButton from 'components/spinner_button.jsx';

import Constants from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

export default class ConfirmIntegration extends React.Component {
    static get propTypes() {
        return {
            team: React.propTypes.object.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.handleDone = this.handleDone.bind(this);

        this.state = {
            type: '',
            token: ''
        };
    }

    componentWillMount() {
        const type = Utils.getUrlParameter('type');
        let token = Utils.getUrlParameter('token');

        // Special case for incoming webhooks
        if (type === Constants.Integrations.INCOMING_WEBHOOK) {
            token = Utils.getWindowLocationOrigin() + '/hooks/' + token;
        }

        this.setState({
            type,
            token
        });
    }

    handleDone() {
        browserHistory.push('/' + this.props.team.name + '/integrations/' + this.state.type);
        this.setState({
            token: ''
        });
    }

    render() {
        let textId = '';
        if (this.state.type === Constants.Integrations.COMMAND) {
            textId = 'add_command';
        } else if (this.state.type === Constants.Integrations.INCOMING_WEBHOOK) {
            textId = 'add_incoming_webhook';
        } else if (this.state.type === Constants.Integrations.OUTGOING_WEBHOOK) {
            textId = 'add_outgoing_webhook';
        }

        return (
            <div className='backstage-content row'>
                <BackstageHeader>
                    <Link to={'/' + this.props.team.name + '/integrations/' + this.state.type}>
                        <FormattedMessage
                            id={'installed_' + this.state.type + '.header'}
                            defaultMessage='Slash Commands'
                        />
                    </Link>
                    <FormattedMessage
                        id='integrations.add'
                        defaultMessage='Add'
                    />
                </BackstageHeader>
                <div className='backstage-list__help'>
                    <FormattedHTMLMessage
                        id={textId + '.doneHelp'}
                        defaultMessage='Your slash command has been set up. The following token will be sent in the outgoing payload. Please use it to verify the request came from your Mattermost team (see <a href="https://docs.mattermost.com/developer/slash-commands.html">documentation</a> for further details).'
                    />
                </div>
                <div className='backstage-list__help'>
                    <FormattedMessage
                        id={textId + '.token'}
                        defaultMessage='Token: {token}'
                        values={{
                            token: this.state.token
                        }}
                    />
                </div>
                <div className='backstage-list__help'>
                    <SpinnerButton
                        className='btn btn-primary'
                        type='submit'
                        onClick={this.handleDone}
                    >
                        <FormattedMessage
                            id='integrations.done'
                            defaultMessage='Done'
                        />
                    </SpinnerButton>
                </div>
            </div>
        );
    }
}
