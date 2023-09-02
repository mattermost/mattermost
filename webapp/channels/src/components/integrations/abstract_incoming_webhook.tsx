// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ChangeEventHandler, FormEvent, MouseEvent, PureComponent} from 'react';
import {FormattedMessage, MessageDescriptor} from 'react-intl';
import {Link} from 'react-router-dom';

import BackstageHeader from 'components/backstage/components/backstage_header';
import ChannelSelect from 'components/channel_select';
import FormError from 'components/form_error';
import SpinnerButton from 'components/spinner_button';
import {Team} from '@mattermost/types/teams';
import {localizeMessage} from 'utils/utils';
import {IncomingWebhook} from '@mattermost/types/integrations';

interface State {
    displayName: string;
    description: string;
    channelId: string;
    channelLocked: boolean;
    username: string;
    iconURL: string;
    saving: boolean;
    serverError: string;
    clientError: JSX.Element | null;
}

interface Props {

    /**
    * The current team
    */
    team: Team;

    /**
    * The header text to render, has id and defaultMessage
    */
    header: MessageDescriptor;

    /**
    * The footer text to render, has id and defaultMessage
    */
    footer: MessageDescriptor;

    /**
    * The spinner loading text to render, has id and defaultMessage
    */
    loading: MessageDescriptor;

    /**
    * The server error text after a failed action
    */
    serverError: string;

    /**
    * The hook used to set the initial state
    */
    initialHook?: IncomingWebhook;

    /**
    * Whether to allow configuration of the default post username.
    */
    enablePostUsernameOverride: boolean;

    /**
    * Whether to allow configuration of the default post icon.
    */
    enablePostIconOverride: boolean;

    /**
    * The async function to run when the action button is pressed
    */
    action: (hook: IncomingWebhook) => Promise<void>;
}

export default class AbstractIncomingWebhook extends PureComponent<Props, State> {
    constructor(props: Props | Readonly<Props>) {
        super(props);

        this.state = this.getStateFromHook(this.props.initialHook);
    }

    getStateFromHook = (hook?: IncomingWebhook) => {
        return {
            displayName: hook?.display_name || '',
            description: hook?.description || '',
            channelId: hook?.channel_id || '',
            channelLocked: hook?.channel_locked || false,
            username: hook?.username || '',
            iconURL: hook?.icon_url || '',
            saving: false,
            serverError: '',
            clientError: null,
        };
    };

    handleSubmit = (e: MouseEvent<HTMLElement> | FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (this.state.saving) {
            return;
        }

        this.setState({
            saving: true,
            serverError: '',
            clientError: null,
        });

        if (!this.state.channelId) {
            this.setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_incoming_webhook.channelRequired'
                        defaultMessage='A valid channel is required'
                    />
                ),
            });

            return;
        }

        const hook = {
            channel_id: this.state.channelId,
            channel_locked: this.state.channelLocked,
            display_name: this.state.displayName,
            description: this.state.description,
            username: this.state.username,
            icon_url: this.state.iconURL,
            id: this.props.initialHook?.id || '',
            create_at: this.props.initialHook?.create_at || 0,
            update_at: this.props.initialHook?.update_at || 0,
            delete_at: this.props.initialHook?.delete_at || 0,
            team_id: this.props.initialHook?.team_id || '',
            user_id: this.props.initialHook?.user_id || '',
        };

        this.props.action(hook).then(() => this.setState({saving: false}));
    };

    updateDisplayName: ChangeEventHandler<HTMLInputElement> = (e) => {
        this.setState({
            displayName: e.target.value,
        });
    };

    updateDescription: ChangeEventHandler<HTMLInputElement> = (e) => {
        this.setState({
            description: e.target.value,
        });
    };

    updateChannelId: ChangeEventHandler<HTMLSelectElement> = (e) => {
        this.setState({
            channelId: e.target.value,
        });
    };

    updateChannelLocked: ChangeEventHandler<HTMLInputElement> = (e) => {
        this.setState({
            channelLocked: e.target.checked,
        });
    };

    updateUsername: ChangeEventHandler<HTMLInputElement> = (e) => {
        this.setState({
            username: e.target.value,
        });
    };

    updateIconURL: ChangeEventHandler<HTMLInputElement> = (e) => {
        this.setState({
            iconURL: e.target.value,
        });
    };

    render() {
        const headerToRender = this.props.header;
        const footerToRender = this.props.footer;

        return (
            <div className='backstage-content'>
                <BackstageHeader>
                    <Link to={`/${this.props.team.name}/integrations/incoming_webhooks`}>
                        <FormattedMessage
                            id='incoming_webhooks.header'
                            defaultMessage='Incoming Webhooks'
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
                        onSubmit={(e) => this.handleSubmit(e)}
                    >
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='displayName'
                            >
                                <FormattedMessage
                                    id='add_incoming_webhook.displayName'
                                    defaultMessage='Title'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <input
                                    id='displayName'
                                    type='text'
                                    maxLength={64}
                                    className='form-control'
                                    value={this.state.displayName}
                                    onChange={this.updateDisplayName}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_incoming_webhook.displayName.help'
                                        defaultMessage='Specify a title, of up to 64 characters, for the webhook settings page.'
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
                                    id='add_incoming_webhook.description'
                                    defaultMessage='Description'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <input
                                    id='description'
                                    type='text'
                                    maxLength={500}
                                    className='form-control'
                                    value={this.state.description}
                                    onChange={this.updateDescription}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_incoming_webhook.description.help'
                                        defaultMessage='Describe your incoming webhook.'
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
                                    id='add_incoming_webhook.channel'
                                    defaultMessage='Channel'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8'>
                                <ChannelSelect
                                    value={this.state.channelId}
                                    onChange={this.updateChannelId}
                                    selectOpen={true}
                                    selectPrivate={true}
                                    selectDm={false}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_incoming_webhook.channel.help'
                                        defaultMessage='This is the default public or private channel that receives the webhook payloads. When setting up the webhook, you must belong to the private channel.'
                                    />
                                </div>
                            </div>
                        </div>
                        <div className='form-group'>
                            <label
                                className='control-label col-sm-4'
                                htmlFor='channelLocked'
                            >
                                <FormattedMessage
                                    id='add_incoming_webhook.channelLocked'
                                    defaultMessage='Lock to this channel'
                                />
                            </label>
                            <div className='col-md-5 col-sm-8 checkbox'>
                                <input
                                    id='channelLocked'
                                    type='checkbox'
                                    checked={this.state.channelLocked}
                                    onChange={this.updateChannelLocked}
                                />
                                <div className='form__help'>
                                    <FormattedMessage
                                        id='add_incoming_webhook.channelLocked.help'
                                        defaultMessage='If set, the incoming webhook can post only to the selected channel.'
                                    />
                                </div>
                            </div>
                        </div>
                        { this.props.enablePostUsernameOverride &&
                            <div className='form-group'>
                                <label
                                    className='control-label col-sm-4'
                                    htmlFor='username'
                                >
                                    <FormattedMessage
                                        id='add_incoming_webhook.username'
                                        defaultMessage='Username'
                                    />
                                </label>
                                <div className='col-md-5 col-sm-8'>
                                    <input
                                        id='username'
                                        type='text'
                                        maxLength={22}
                                        className='form-control'
                                        value={this.state.username}
                                        onChange={this.updateUsername}
                                    />
                                    <div className='form__help'>
                                        <FormattedMessage
                                            id='add_incoming_webhook.username.help'
                                            defaultMessage='Specify the username this integration will post as. Usernames can be up to 22 characters, and can contain lowercase letters, numbers and the symbols \"-\", \"_\", and \".\". If left blank, the name specified by the webhook creator is used.'
                                        />
                                    </div>
                                </div>
                            </div>
                        }
                        { this.props.enablePostIconOverride &&
                            <div className='form-group'>
                                <label
                                    className='control-label col-sm-4'
                                    htmlFor='iconURL'
                                >
                                    <FormattedMessage
                                        id='add_incoming_webhook.icon_url'
                                        defaultMessage='Profile Picture'
                                    />
                                </label>
                                <div className='col-md-5 col-sm-8'>
                                    <input
                                        id='iconURL'
                                        type='text'
                                        maxLength={1024}
                                        className='form-control'
                                        value={this.state.iconURL}
                                        onChange={this.updateIconURL}
                                    />
                                    <div className='form__help'>
                                        <FormattedMessage
                                            id='add_incoming_webhook.icon_url.help'
                                            defaultMessage='Enter the URL of a .png or .jpg file for the profile picture of this integration when posting. The file should be at least 128 pixels by 128 pixels. If left blank, the profile picture specified by the webhook creator is used.'
                                        />
                                    </div>
                                </div>
                            </div>
                        }
                        <div className='backstage-form__footer'>
                            <FormError
                                type='backstage'
                                errors={[this.props.serverError, this.state.clientError]}
                            />
                            <Link
                                className='btn btn-tertiary'
                                to={`/${this.props.team.name}/integrations/incoming_webhooks`}
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
                                spinningText={localizeMessage(this.props.loading.id as string, this.props.loading.defaultMessage as string)}
                                onClick={(e) => this.handleSubmit(e)}
                                id='saveWebhook'
                            >
                                <FormattedMessage
                                    id={footerToRender.id}
                                    defaultMessage={footerToRender.defaultMessage}
                                />
                            </SpinnerButton>
                        </div>
                    </form>
                </div>
            </div>
        );
    }
}
