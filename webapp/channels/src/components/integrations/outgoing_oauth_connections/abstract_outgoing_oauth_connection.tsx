// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChangeEvent, FormEvent} from 'react';
import React, {useMemo, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';
import {Link} from 'react-router-dom';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import {Permissions} from 'mattermost-redux/constants';

import BackstageHeader from 'components/backstage/components/backstage_header';
import FormError from 'components/form_error';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';
import SpinnerButton from 'components/spinner_button';

import {localizeMessage} from 'utils/utils';

type Props = {
    team: Team;
    header: MessageDescriptor;
    footer: MessageDescriptor;
    loading: MessageDescriptor;
    renderExtra?: JSX.Element;
    serverError: string;

    initialConnection?: OutgoingOAuthConnection;

    action: (connection: OutgoingOAuthConnection) => Promise<void>;
}

type State = {
    name: string;
    oauthTokenUrl: string;
    grantType: OutgoingOAuthConnection['grant_type'];
    clientId: string;
    clientSecret: string;
    audienceUrls: string;
    saving: boolean;
    clientError: JSX.Element | null | string;
};

const useOutgoingOAuthForm = (connection: OutgoingOAuthConnection): [State, (state: Partial<State>) => void] => {
    const initialState: State = {
        name: connection.name || '',
        audienceUrls: connection.audiences ? connection.audiences.join('\n') : '',
        oauthTokenUrl: connection.oauth_token_url || '',
        clientId: connection.client_id || '',
        clientSecret: connection.client_secret || '',
        grantType: 'client_credentials',
        saving: false,
        clientError: null,
    };

    const [state, setState] = useState(initialState);

    return useMemo(() => [state, (newState: Partial<State>) => {
        setState((oldState) => ({...oldState, ...newState}));
    }], [state]);
};

const initialState: OutgoingOAuthConnection = {
    id: '',
    name: 'some name',
    creator_id: '',
    create_at: 0,
    update_at: 0,
    client_id: 'some id',
    client_secret: 'some secret',
    oauth_token_url: 'https://tokenurl.com',
    grant_type: 'client_credentials',
    audiences: ['https://audience.com'],
};

export default function AbstractOutgoingOAuthConnection(props: Props) {
    const [state, setState] = useOutgoingOAuthForm(props.initialConnection || initialState as OutgoingOAuthConnection);
    const [isEditingSecret, setIsEditingSecret] = useState(false);

    const isNewConnection = !props.initialConnection;

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        if (state.saving) {
            return;
        }

        setState({
            saving: true,
            clientError: '',
        });

        if (!state.name) {
            setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_oauth_app.nameRequired'
                        defaultMessage='Name for the OAuth connection is required.'
                    />
                ),
            });

            return;
        }

        if (!state.clientId) {
            setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_oauth_app.client_id'
                        defaultMessage='Client Id for the OAuth connection is required.'
                    />
                ),
            });

            return;
        }

        if ((isNewConnection || isEditingSecret) && !state.clientSecret) {
            setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_outgoing_oauth_connection.client_secret'
                        defaultMessage='Client Secret for the OAuth connection is required.'
                    />
                ),
            });

            return;
        }

        if (!state.grantType) {
            setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_oauth_app.grant_type'
                        defaultMessage='Grant Type for the OAuth connection is required.'
                    />
                ),
            });

            return;
        }

        if (!state.oauthTokenUrl) {
            setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_oauth_app.oauth_token_url'
                        defaultMessage='OAuth Token URL for the OAuth connection is required.'
                    />
                ),
            });

            return;
        }

        const audienceUrls = [];
        for (let audienceUrl of state.audienceUrls.split('\n')) {
            audienceUrl = audienceUrl.trim();

            if (audienceUrl.length > 0) {
                audienceUrls.push(audienceUrl);
            }
        }

        if (audienceUrls.length === 0) {
            setState({
                saving: false,
                clientError: (
                    <FormattedMessage
                        id='add_oauth_app.callbackUrlsRequired'
                        defaultMessage='One or more audience URLs are required.'
                    />
                ),
            });

            return;
        }

        const connection = {
            name: state.name,
            audiences: audienceUrls,
            client_id: state.clientId,
            client_secret: state.clientSecret,
            grant_type: state.grantType,
            oauth_token_url: state.oauthTokenUrl,
        } as OutgoingOAuthConnection;

        props.action(connection).then(() => setState({saving: false}));
    };

    const updateName = (e: ChangeEvent<HTMLInputElement>) => {
        setState({
            name: e.target.value,
        });
    };

    const updateClientId = (e: ChangeEvent<HTMLInputElement>) => {
        setState({
            clientId: e.target.value,
        });
    };

    const updateClientSecret = (e: ChangeEvent<HTMLInputElement>) => {
        setState({
            clientSecret: e.target.value,
        });
    };

    const updateOAuthTokenURL = (e: ChangeEvent<HTMLInputElement>) => {
        setState({
            oauthTokenUrl: e.target.value,
        });
    };

    const updateAudienceUrls = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setState({
            audienceUrls: e.target.value,
        });
    };

    const startEditingClientSecret = () => {
        setIsEditingSecret(true);
    };

    const headerToRender = props.header;
    const footerToRender = props.footer;
    const renderExtra = props.renderExtra;

    let clientSecretSection = (
        <input
            id='name'
            type='text'
            className='form-control'
            value={state.clientSecret}
            onChange={updateClientSecret}
        />
    );

    if (!isNewConnection && !isEditingSecret) {
        clientSecretSection = (
            <>
                <input
                    id='name'
                    disabled={true}
                    type='text'
                    className='form-control disabled'
                    value={'*'.repeat(16)}
                />
                <span
                    onClick={startEditingClientSecret}
                    className='outgoing-oauth-connections-edit-secret'
                    style={{
                        position: 'absolute',
                        right: '16px',
                        top: '8px',
                        cursor: 'pointer',
                    }}
                >
                    <i className='icon icon-pencil-outline'/>
                </span>
            </>
        );
    }

    return (
        <div className='backstage-content'>
            <BackstageHeader>
                <Link to={`/${props.team.name}/integrations/outgoing-oauth2-connections`}>
                    <FormattedMessage
                        id='installed_outgoing_oauth_connections.header'
                        defaultMessage='Outgoing OAuth Connections'
                    />
                </Link>
                <FormattedMessage
                    id={headerToRender.id}
                    defaultMessage={headerToRender.defaultMessage}
                />
            </BackstageHeader>
            <div className='backstage-form'>
                <form className='form-horizontal'>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='name'
                        >
                            <FormattedMessage
                                id='installed_oauth_apps.name'
                                defaultMessage='Display Name'
                            />
                        </label>
                        <div className='col-md-5 col-sm-8'>
                            <input
                                id='name'
                                type='text'
                                maxLength={64}
                                className='form-control'
                                value={state.name}
                                onChange={updateName}
                            />
                            <div className='form__help'>
                                <FormattedMessage
                                    id='add_oauth_app.name.help'
                                    defaultMessage='Specify the display name for your OAuth connection.'
                                />
                            </div>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='client_id'
                        >
                            <FormattedMessage
                                id='installed_oauth_apps.client_id'
                                defaultMessage='Client ID'
                            />
                        </label>
                        <div className='col-md-5 col-sm-8'>
                            <input
                                id='name'
                                type='text'
                                maxLength={64}
                                className='form-control'
                                value={state.clientId}
                                onChange={updateClientId}
                            />
                            <div className='form__help'>
                                <FormattedMessage
                                    id='add_oauth_app.client_id.help'
                                    defaultMessage='Specify the Client ID for your OAuth connection.'
                                />
                            </div>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='client_secret'
                        >
                            <FormattedMessage
                                id='installed_oauth_apps.client_secret'
                                defaultMessage='Client Secret'
                            />
                        </label>
                        <div className='col-md-5 col-sm-8'>
                            {clientSecretSection}
                            <div className='form__help'>
                                <FormattedMessage
                                    id='add_oauth_app.client_secret.help'
                                    defaultMessage='Specify the Client Secret for your OAuth connection.'
                                />
                            </div>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='oauth_token_url'
                        >
                            <FormattedMessage
                                id='installed_oauth_apps.oauth_token_url'
                                defaultMessage='OAuth Token URL'
                            />
                        </label>
                        <div className='col-md-5 col-sm-8'>
                            <input
                                id='name'
                                type='text'
                                maxLength={64}
                                className='form-control'
                                value={state.oauthTokenUrl}
                                onChange={updateOAuthTokenURL}
                            />
                            <div className='form__help'>
                                <FormattedMessage
                                    id='add_oauth_app.oauth_token_url.help'
                                    defaultMessage='Specify the OAuth Token URL for your OAuth connection.'
                                />
                            </div>
                        </div>
                    </div>
                    <div className='form-group'>
                        <label
                            className='control-label col-sm-4'
                            htmlFor='audienceUrls'
                        >
                            <FormattedMessage
                                id='installed_oauth_apps.audienceUrls'
                                defaultMessage='Audience URLs (One Per Line)'
                            />
                        </label>
                        <div className='col-md-5 col-sm-8'>
                            <textarea
                                id='audienceUrls'
                                rows={3}
                                maxLength={1024}
                                className='form-control'
                                value={state.audienceUrls}
                                onChange={updateAudienceUrls}
                            />
                            <div className='form__help'>
                                <FormattedMessage
                                    id='add_oauth_app.audienceUrls.help'
                                    defaultMessage='The audience URIs which will receive requests with the OAuth token. Must be a valid URL and start with http:// or https://.'
                                />
                            </div>
                        </div>
                    </div>
                    <div className='backstage-form__footer'>
                        <FormError
                            type='backstage'
                            errors={[props.serverError, state.clientError]}
                        />
                        <Link
                            className='btn btn-tertiary'
                            to={`/${props.team.name}/integrations/outgoing-oauth2-connections`}
                        >
                            <FormattedMessage
                                id='installed_oauth_apps.cancel'
                                defaultMessage='Cancel'
                            />
                        </Link>
                        <SpinnerButton
                            className='btn btn-primary'
                            type='submit'
                            spinning={state.saving}
                            spinningText={localizeMessage(props.loading?.id || '', (props.loading?.defaultMessage || '') as string)}
                            onClick={handleSubmit}
                            id='saveOauthApp'
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
