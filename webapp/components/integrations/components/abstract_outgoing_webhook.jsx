// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import PropTypes from 'prop-types';

import TeamStore from 'stores/team_store.jsx';

import {localizeMessage} from 'utils/utils.jsx';

import BackstageHeader from 'components/backstage/components/backstage_header.jsx';
import ChannelSelect from 'components/channel_select.jsx';
import {FormattedMessage} from 'react-intl';
import FormError from 'components/form_error.jsx';
import {Link} from 'react-router/es6';
import SpinnerButton from 'components/spinner_button.jsx';

export default class AbstractOutgoingWebhook extends React.Component {
    static propTypes = {

        /**
         * The current team
         */
        team: PropTypes.object.isRequired,

        /**
         * The header text to render, has id and defaultMessage
         */
        header: PropTypes.object.isRequired,

        /**
         * The footer text to render, has id and defaultMessage
         */
        footer: PropTypes.object.isRequired,

        /**
         * Any extra component/node to render
         */
        renderExtra: PropTypes.node.isRequired,

        /**
         * The server error text after a failed action
         */
        serverError: PropTypes.string.isRequired,

        /**
         * The hook used to set the initial state
         */
        initialHook: PropTypes.object,

        /**
         * The async function to run when the action button is pressed
         */
        action: PropTypes.func.isRequired
    }

    constructor(props) {
        super(props);

        this.state = this.getStateFromHook(this.props.initialHook || {});
    }

    getStateFromHook = (hook) => {
        let triggerWords = '';
        if (hook.trigger_words) {
            let i = 0;
            for (i = 0; i < hook.trigger_words.length; i++) {
                triggerWords += hook.trigger_words[i] + '\n';
            }
        }

        let callbackUrls = '';
        if (hook.callback_urls) {
            let i = 0;
            for (i = 0; i < hook.callback_urls.length; i++) {
                callbackUrls += hook.callback_urls[i] + '\n';
            }
        }

        return {
            displayName: hook.display_name || '',
            description: hook.description || '',
            contentType: hook.content_type || 'application/x-www-form-urlencoded',
            channelId: hook.channel_id || '',
            triggerWords,
            triggerWhen: hook.trigger_when || 0,
            callbackUrls,
            saving: false,
            clientError: null
        };
    }

    handleSubmit = (e) => {
        e.preventDefault();

        if (this.state.saving) {
            return;
        }

        this.setState({
            saving: true,
            clientError: ''
        });

        const triggerWords = [];
        if (this.state.triggerWords) {
            for (let triggerWord of this.state.triggerWords.split('\n')) {
                triggerWord = triggerWord.trim();

                if (triggerWord.length > 0) {
                    triggerWords.push(triggerWord);
                }
            }
        }

        if (!this.state.channelId && triggerWords.length === 0) {
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

        const callbackUrls = [];
        for (let callbackUrl of this.state.callbackUrls.split('\n')) {
            callbackUrl = callbackUrl.trim();

            if (callbackUrl.length > 0) {
                callbackUrls.push(callbackUrl);
            }
        }

        if (callbackUrls.length === 0) {
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
            team_id: TeamStore.getCurrentId(),
            channel_id: this.state.channelId,
            trigger_words: triggerWords,
            trigger_when: parseInt(this.state.triggerWhen, 10),
            callback_urls: callbackUrls,
            display_name: this.state.displayName,
            content_type: this.state.contentType,
            description: this.state.description
        };

        this.props.action(hook).then(() => this.setState({saving: false}));
    }

    updateDisplayName = (e) => {
        this.setState({
            displayName: e.target.value
        });
    }

    updateDescription = (e) => {
        this.setState({
            description: e.target.value
        });
    }

    updateContentType = (e) => {
        this.setState({
            contentType: e.target.value
        });
    }

    updateChannelId = (e) => {
        this.setState({
            channelId: e.target.value
        });
    }

    updateTriggerWords = (e) => {
        this.setState({
            triggerWords: e.target.value
        });
    }

    updateTriggerWhen = (e) => {
        this.setState({
            triggerWhen: e.target.value
        });
    }

    updateCallbackUrls = (e) => {
        this.setState({
            callbackUrls: e.target.value
        });
    }

    render() {
        const contentTypeOption1 = 'application/x-www-form-urlencoded';
        const contentTypeOption2 = 'application/json';

        var headerToRender = this.props.header;
        var footerToRender = this.props.footer;
        var renderExtra = this.props.renderExtra;

        return (
            <div className='backstage-content'>
                <BackstageHeader>
                    <Link to={`/${this.props.team.name}/integrations/outgoing_webhooks`}>
                        <FormattedMessage
                            id='installed_outgoing_webhooks.header'
                            defaultMessage='Outgoing Webhooks'
                        />
                    </Link>
                    <FormattedMessage
                        id={headerToRender.id}
                        defaultMessage={headerToRender.defaultMessage}
                    />
                </BackstageHeader>
                <div className='backstage-form'>
                    <form
                        className='form-horizontal'
                        onSubmit={this.handleSubmit}
                    >
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='displayName'
                            >
                                <FormattedMessage
                                    id='add_outgoing_webhook.displayName'
                                    defaultMessage='Display Name'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <input
                                    id='displayName'
                                    type='text'
                                    maxLength='64'
                                    className='form-control'
                                    value={this.state.displayName}
                                    onChange={this.updateDisplayName}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_outgoing_webhook.displayName.help'
                                        defaultMessage='Display name for your incoming webhook made of up to 64 characters.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='description'
                            >
                                <FormattedMessage
                                    id='add_outgoing_webhook.description'
                                    defaultMessage='Description'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <input
                                    id='description'
                                    type='text'
                                    maxLength='128'
                                    className='form-control'
                                    value={this.state.description}
                                    onChange={this.updateDescription}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_outgoing_webhook.description.help'
                                        defaultMessage='Description for your incoming webhook.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='contentType'
                            >
                                <FormattedMessage
                                    id='add_outgoing_webhook.content_Type'
                                    defaultMessage='Content Type'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <select
                                    className='form-control'
                                    value={this.state.contentType}
                                    onChange={this.updateContentType}
                                >
                                    <option
                                        value={contentTypeOption1}
                                    >
                                        {contentTypeOption1}
                                    </option>
                                    <option
                                        value={contentTypeOption2}
                                    >
                                        {contentTypeOption2}
                                    </option>
                                </select>
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_outgoing_webhook.contentType.help1'
                                        defaultMessage='Choose the content type by which the response will be sent.'
                                    />
                                </div>
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_outgoing_webhook.contentType.help2'
                                        defaultMessage='If application/x-www-form-urlencoded is chosen, the server assumes you will be encoding the parameters in a URL format.'
                                    />
                                </div>
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_outgoing_webhook.contentType.help3'
                                        defaultMessage='If application/json is chosen, the server assumes you will posting JSON data.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='channelId'
                            >
                                <FormattedMessage
                                    id='add_outgoing_webhook.channel'
                                    defaultMessage='Channel'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <ChannelSelect
                                    id='channelId'
                                    value={this.state.channelId}
                                    onChange={this.updateChannelId}
                                    selectOpen={true}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_outgoing_webhook.channel.help'
                                        defaultMessage='Public channel to receive webhook payloads. Optional if at least one Trigger Word is specified.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='triggerWords'
                            >
                                <FormattedMessage
                                    id='add_outgoing_webhook.triggerWords'
                                    defaultMessage='Trigger Words (One Per Line)'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <textarea
                                    id='triggerWords'
                                    rows='3'
                                    maxLength='1000'
                                    className='form-control'
                                    value={this.state.triggerWords}
                                    onChange={this.updateTriggerWords}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_outgoing_webhook.triggerWords.help'
                                        defaultMessage='Messages that start with one of the specified words will trigger the outgoing webhook. Optional if Channel is selected.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='triggerWords'
                            >
                                <FormattedMessage
                                    id='add_outgoing_webhook.triggerWordsTriggerWhen'
                                    defaultMessage='Trigger When'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <select
                                    className='form-control'
                                    value={this.state.triggerWhen}
                                    onChange={this.updateTriggerWhen}
                                >
                                    <option
                                        value='0'
                                    >
                                        {localizeMessage('add_outgoing_webhook.triggerWordsTriggerWhenFullWord', 'First word matches a trigger word exactly')}
                                    </option>
                                    <option
                                        value='1'
                                    >
                                        {localizeMessage('add_outgoing_webhook.triggerWordsTriggerWhenStartsWith', 'First word starts with a trigger word')}
                                    </option>
                                </select>
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_outgoing_webhook.triggerWordsTriggerWhen.help'
                                        defaultMessage='Choose when to trigger the outgoing webhook; if the first word of a message matches a Trigger Word exactly, or if it starts with a Trigger Word.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='callbackUrls'
                            >
                                <FormattedMessage
                                    id='add_outgoing_webhook.callbackUrls'
                                    defaultMessage='Callback URLs (One Per Line)'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <textarea
                                    id='callbackUrls'
                                    rows='3'
                                    maxLength='1000'
                                    className='form-control'
                                    value={this.state.callbackUrls}
                                    onChange={this.updateCallbackUrls}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_outgoing_webhook.callbackUrls.help'
                                        defaultMessage='The URL that messages will be sent to.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='backstage-form__footer'>
                            <FormError
                                type='backstage'
                                errors={[this.props.serverError, this.state.clientError]}
                            />
                            <Link
                                className='btn btn-sm'
                                to={`/${this.props.team.name}/integrations/outgoing_webhooks`}
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
                                    id={footerToRender.id}
                                    defaultMessage={footerToRender.defaultMessage}
                                />
                            </SpinnerButton>
                            {renderExtra}
                        </div>
                    </form>
                </div>
            </div>
        );
    }
}
