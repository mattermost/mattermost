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

export default class AddOutgoingWebhook extends React.Component {
    constructor(props) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.updateName = this.updateName.bind(this);
        this.updateDescription = this.updateDescription.bind(this);
        this.updateChannelId = this.updateChannelId.bind(this);
        this.updateTriggerWords = this.updateTriggerWords.bind(this);
        this.updateCallbackUrls = this.updateCallbackUrls.bind(this);

        this.state = {
            team: TeamStore.getCurrent(),
            name: '',
            description: '',
            channelId: '',
            triggerWords: '',
            callbackUrls: '',
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

        if (!this.state.channelId && !this.state.triggerWords) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_outgoing_webhook.triggerWordsOrChannelRequired'
                        defaultMessage='A valid channel or a list of trigger words is required'
                    />
                )
            });

            return;
        }

        if (!this.state.callbackUrls) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_outgoing_webhook.callbackUrlsRequired'
                        defaultMessage='One or more callback URLs are required'
                    />
                )
            });

            return;
        }

        const hook = {
            channel_id: this.state.channelId,
            trigger_words: this.state.triggerWords.split('\n').map((word) => word.trim()),
            callback_urls: this.state.callbackUrls.split('\n').map((url) => url.trim())
        };

        AsyncClient.addOutgoingHook(
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

    updateTriggerWords(e) {
        this.setState({
            triggerWords: e.target.value
        });
    }

    updateCallbackUrls(e) {
        this.setState({
            callbackUrls: e.target.value
        });
    }

    render() {
        const team = TeamStore.getCurrent();

        if (!team) {
            return null;
        }

        return (
            <div className='backstage row'>
                <div className='add-outgoing-webhook'>
                    <div className='backstage__header'>
                        <h1 className='text'>
                            <FormattedMessage
                                id='add_outgoing_webhook.header'
                                defaultMessage='Add Outgoing Webhook'
                            />
                        </h1>
                    </div>
                </div>
                <form className='add-outgoing-webhook__body'>
                    <div className='add-integration__row'>
                        <label
                            className='add-integration__label'
                            htmlFor='name'
                        >
                            <FormattedMessage
                                id='add_outgoing_webhook.name'
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
                                id='add_outgoing_webhook.description'
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
                                id='add_outgoing_webhook.channel'
                                defaultMessage='Channel'
                            />
                        </label>
                        <ChannelSelect
                            id='channelId'
                            value={this.state.channelId}
                            onChange={this.updateChannelId}
                        />
                    </div>
                    <div className='add-integration__row'>
                        <label
                            className='add-integration__label'
                            htmlFor='triggerWords'
                        >
                            <FormattedMessage
                                id='add_outgoing_webhook.triggerWords'
                                defaultMessage='Trigger Words (One Per Line)'
                            />
                        </label>
                        <textarea
                            id='triggerWords'
                            rows='3'
                            value={this.state.triggerWords}
                            onChange={this.updateTriggerWords}
                        />
                    </div>
                    <div className='add-integration__row'>
                        <label
                            className='add-integration__label'
                            htmlFor='callbackUrls'
                        >
                            <FormattedMessage
                                id='add_outgoing_webhook.callbackUrls'
                                defaultMessage='Callback URLs (One Per Line)'
                            />
                        </label>
                        <textarea
                            id='callbackUrls'
                            rows='3'
                            value={this.state.callbackUrls}
                            onChange={this.updateCallbackUrls}
                        />
                    </div>
                    <div className='add-integration__submit-row'>
                        <Link
                            className='btn btn-sm'
                            to={`/${team.name}/integrations/add`}
                        >
                            <FormattedMessage
                                id='add_outgoing_webhook.cancel'
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
                                id='add_outgoing_webhook.save'
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
