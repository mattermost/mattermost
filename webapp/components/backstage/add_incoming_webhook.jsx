// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as AsyncClient from 'utils/async_client.jsx';
import {browserHistory} from 'react-router';
import TeamStore from 'stores/team_store.jsx';

import ChannelSelect from 'components/channel_select.jsx';
import {FormattedMessage} from 'react-intl';
import FormError from 'components/form_error.jsx';
import {Link} from 'react-router';
import SpinnerButton from 'components/spinner_button.jsx';

export default class AddIncomingWebhook extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.updateName = this.updateName.bind(this);
        this.updateDescription = this.updateDescription.bind(this);
        this.updateChannelId = this.updateChannelId.bind(this);

        this.state = {
            team: TeamStore.getCurrent(),
            name: '',
            description: '',
            channelId: '',
            saving: false,
            serverError: '',
            clientError: null
        };
    }

    componentDidMount() {
        TeamStore.addChangeListener(this.handleChange);
    }

    componentWillUnmount() {
        TeamStore.removeChangeListener(this.handleChange);
    }

    handleChange() {
        this.setState({
            team: TeamStore.getCurrent()
        });
    }

    handleSubmit(e) {
        e.preventDefault();

        if (this.state.saving) {
            return;
        }

        this.setState({
            saving: true,
            serverError: '',
            clientError: ''
        });

        if (!this.state.channelId) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_incoming_webhook.channelRequired'
                        defaultMessage='A valid channel is required'
                    />
                )
            });

            return;
        }

        const hook = {
            channel_id: this.state.channelId
        };

        AsyncClient.addIncomingHook(
            hook,
            () => {
                browserHistory.push(`/${this.state.team.name}/integrations/installed`);
            },
            (err) => {
                this.setState({
                    serverError: err.message
                });
            }
        );
    }

    updateName(e) {
        this.setState({
            name: e.target.value
        });
    }

    updateDescription(e) {
        this.setState({
            description: e.target.value
        });
    }

    updateChannelId(e) {
        this.setState({
            channelId: e.target.value
        });
    }

    render() {
        const team = TeamStore.getCurrent();

        if (!team) {
            return null;
        }

        return (
            <div className='backstage row'>
                <div className='add-incoming-webhook'>
                    <div className='backstage__header'>
                        <h1 className='text'>
                            <FormattedMessage
                                id='add_incoming_webhook.header'
                                defaultMessage='Add Incoming Webhook'
                            />
                        </h1>
                    </div>
                </div>
                <form className='add-incoming-webhook__body'>
                    <div className='add-integration__row'>
                        <label
                            className='add-integration__label'
                            htmlFor='name'
                        >
                            <FormattedMessage
                                id='add_incoming_webhook.name'
                                defaultMessage='Name'
                            />
                        </label>
                        <input
                            id='name'
                            type='text'
                            value={this.state.name}
                            onChange={this.updateName}
                        />
                    </div>
                    <div className='add-integration__row'>
                        <label
                            className='add-integration__label'
                            htmlFor='description'
                        >
                            <FormattedMessage
                                id='add_incoming_webhook.description'
                                defaultMessage='Description'
                            />
                        </label>
                        <input
                            id='description'
                            type='text'
                            value={this.state.description}
                            onChange={this.updateDescription}
                        />
                    </div>
                    <div className='add-integration__row'>
                        <label
                            className='add-integration__label'
                            htmlFor='channelId'
                        >
                            <FormattedMessage
                                id='add_incoming_webhook.channel'
                                defaultMessage='Channel'
                            />
                        </label>
                        <ChannelSelect
                            id='channelId'
                            value={this.state.channelId}
                            onChange={this.updateChannelId}
                        />
                    </div>
                    <div className='add-integration__submit-row'>
                        <Link
                            className='btn btn-sm'
                            to={`/${team.name}/integrations/add`}
                        >
                            <FormattedMessage
                                id='add_incoming_webhook.cancel'
                                defaultMessage='Cancel'
                            />
                        </Link>
                        <SpinnerButton
                            className='btn btn-primary'
                            type='submit'
                            spinning={this.state.saving}
                            onClick={this.handleSubmit}
                        >
                            <FormattedMessage
                                id='add_incoming_webhook.save'
                                defaultMessage='Save'
                            />
                        </SpinnerButton>
                    </div>
                    <FormError errors={[this.state.serverError, this.state.clientError]}/>
                </form>
            </div>
        );
    }
}
