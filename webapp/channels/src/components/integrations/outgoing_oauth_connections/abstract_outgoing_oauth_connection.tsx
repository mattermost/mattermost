// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChangeEvent, FormEvent} from 'react';
import React, {useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';
import {Link} from 'react-router-dom';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import BackstageHeader from 'components/backstage/components/backstage_header';
import FormError from 'components/form_error';
import SpinnerButton from 'components/spinner_button';

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
};

const useOutgoingOAuthForm = (connection: OutgoingOAuthConnection): [State, (state: Partial<State>) => void] => {
    const initialState: State = {
        name: connection.name || '',
        audienceUrls: connection.audiences ? connection.audiences.join('\n') : '',
        oauthTokenUrl: connection.oauth_token_url || '',
        clientId: connection.client_id || '',
        clientSecret: connection.client_secret || '',
        grantType: 'client_credentials',
    };

    const [state, setState] = useState(initialState);

    return useMemo(() => [state, (newState: Partial<State>) => {
        setState((oldState) => ({...oldState, ...newState}));
    }], [state]);
};

const initialState: OutgoingOAuthConnection = {
    id: '',
    name: '',
    creator_id: '',
    create_at: 0,
    update_at: 0,
    client_id: '',
    client_secret: '',
    oauth_token_url: '',
    grant_type: 'client_credentials',
    audiences: [],
};

export default function AbstractOutgoingOAuthConnection(props: Props) {
    const [formState, setFormState] = useOutgoingOAuthForm(props.initialConnection || initialState);
    const [submissionStatus, setSubmissionStatus] = useState<{error: string | React.ReactNode; saving: boolean}>({saving: false, error: ''});
    const [isEditingSecret, setIsEditingSecret] = useState(false);

    const intl = useIntl();

    const isNewConnection = !props.initialConnection;

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        if (submissionStatus.saving) {
            return;
        }

        setSubmissionStatus({
            saving: true,
            error: '',
        });

        if (!formState.name) {
            setSubmissionStatus({
                saving: false,
                error: (
                    <FormattedMessage
                        id='add_outgoing_oauth_connection.name.required'
                        defaultMessage='Name for the OAuth connection is required.'
                    />
                ),
            });

            return;
        }

        if (!formState.clientId) {
            setSubmissionStatus({
                saving: false,
                error: (
                    <FormattedMessage
                        id='add_outgoing_oauth_connection.client_id.required'
                        defaultMessage='Client Id for the OAuth connection is required.'
                    />
                ),
            });

            return;
        }

        if ((isNewConnection || isEditingSecret) && !formState.clientSecret) {
            setSubmissionStatus({
                saving: false,
                error: (
                    <FormattedMessage
                        id='add_outgoing_oauth_connection.client_secret.required'
                        defaultMessage='Client Secret for the OAuth connection is required.'
                    />
                ),
            });

            return;
        }

        if (!formState.grantType) {
            setSubmissionStatus({
                saving: false,
                error: (
                    <FormattedMessage
                        id='add_outgoing_oauth_connection.grant_type.required'
                        defaultMessage='Grant Type for the OAuth connection is required.'
                    />
                ),
            });

            return;
        }

        if (!formState.oauthTokenUrl) {
            setSubmissionStatus({
                saving: false,
                error: (
                    <FormattedMessage
                        id='add_outgoing_oauth_connection.oauth_token_url.required'
                        defaultMessage='OAuth Token URL for the OAuth connection is required.'
                    />
                ),
            });

            return;
        }

        const audienceUrls = [];
        for (let audienceUrl of formState.audienceUrls.split('\n')) {
            audienceUrl = audienceUrl.trim();

            if (audienceUrl.length > 0) {
                audienceUrls.push(audienceUrl);
            }
        }

        if (audienceUrls.length === 0) {
            setSubmissionStatus({
                saving: false,
                error: (
                    <FormattedMessage
                        id='add_outgoing_oauth_connection.audienceUrls.required'
                        defaultMessage='One or more audience URLs are required.'
                    />
                ),
            });

            return;
        }

        const connection = {
            name: formState.name,
            audiences: audienceUrls,
            client_id: formState.clientId,
            client_secret: formState.clientSecret,
            grant_type: formState.grantType,
            oauth_token_url: formState.oauthTokenUrl,
        } as OutgoingOAuthConnection;

        props.action(connection).then(() => setSubmissionStatus({saving: false, error: ''}));
    };

    const updateName = (e: ChangeEvent<HTMLInputElement>) => {
        setFormState({
            name: e.target.value,
        });
    };

    const updateClientId = (e: ChangeEvent<HTMLInputElement>) => {
        setFormState({
            clientId: e.target.value,
        });
    };

    const updateClientSecret = (e: ChangeEvent<HTMLInputElement>) => {
        setFormState({
            clientSecret: e.target.value,
        });
    };

    const updateOAuthTokenURL = (e: ChangeEvent<HTMLInputElement>) => {
        setFormState({
            oauthTokenUrl: e.target.value,
        });
    };

    const updateAudienceUrls = (e: ChangeEvent<HTMLTextAreaElement>) => {
        setFormState({
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
            id='client_secret'
            type='text'
            className='form-control'
            value={formState.clientSecret}
            onChange={updateClientSecret}
        />
    );

    if (!isNewConnection && !isEditingSecret) {
        clientSecretSection = (
            <>
                <input
                    id='client_secret'
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
                        id='add_outgoing_oauth_connection.header'
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
                                id='add_outgoing_oauth_connection.name.label'
                                defaultMessage='Name'
                            />
                        </label>
                        <div className='col-md-5 col-sm-8'>
                            <input
                                id='name'
                                type='text'
                                maxLength={64}
                                className='form-control'
                                value={formState.name}
                                onChange={updateName}
                            />
                            <div className='form__help'>
                                <FormattedMessage
                                    id='add_outgoing_oauth_connection.name.help'
                                    defaultMessage='Specify the name for your OAuth connection.'
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
                                id='add_outgoing_oauth_connection.client_id.label'
                                defaultMessage='Client ID'
                            />
                        </label>
                        <div className='col-md-5 col-sm-8'>
                            <input
                                id='client_id'
                                type='text'
                                maxLength={64}
                                className='form-control'
                                value={formState.clientId}
                                onChange={updateClientId}
                            />
                            <div className='form__help'>
                                <FormattedMessage
                                    id='add_outgoing_oauth_connection.client_id.help'
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
                                id='add_outgoing_oauth_connection.client_secret.label'
                                defaultMessage='Client Secret'
                            />
                        </label>
                        <div className='col-md-5 col-sm-8'>
                            {clientSecretSection}
                            <div className='form__help'>
                                <FormattedMessage
                                    id='add_outgoing_oauth_connection.client_secret.help'
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
                                id='add_outgoing_oauth_connection.oauth_token_url.label'
                                defaultMessage='OAuth Token URL'
                            />
                        </label>
                        <div className='col-md-5 col-sm-8'>
                            <input
                                id='token_url'
                                type='text'
                                maxLength={64}
                                className='form-control'
                                value={formState.oauthTokenUrl}
                                onChange={updateOAuthTokenURL}
                            />
                            <div className='form__help'>
                                <FormattedMessage
                                    id='add_outgoing_oauth_connection.oauth_token_url.help'
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
                                id='add_outgoing_oauth_connection.audienceUrls.label'
                                defaultMessage='Audience URLs (One Per Line)'
                            />
                        </label>
                        <div className='col-md-5 col-sm-8'>
                            <textarea
                                id='audienceUrls'
                                rows={3}
                                maxLength={1024}
                                className='form-control'
                                value={formState.audienceUrls}
                                onChange={updateAudienceUrls}
                            />
                            <div className='form__help'>
                                <FormattedMessage
                                    id='add_outgoing_oauth_connection.audienceUrls.help'
                                    defaultMessage='The audience URIs which will receive requests with the OAuth token. Must be a valid URL and start with http:// or https://.'
                                />
                            </div>
                        </div>
                    </div>
                    <div className='backstage-form__footer'>
                        <FormError
                            type='backstage'
                            errors={[props.serverError, submissionStatus.error]}
                        />
                        <Link
                            className='btn btn-tertiary'
                            to={`/${props.team.name}/integrations/outgoing-oauth2-connections`}
                        >
                            <FormattedMessage
                                id='add_outgoing_oauth_connection.cancel'
                                defaultMessage='Cancel'
                            />
                        </Link>
                        <SpinnerButton
                            className='btn btn-primary'
                            type='submit'
                            spinning={submissionStatus.saving}
                            spinningText={intl.formatMessage(props.loading)}
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
