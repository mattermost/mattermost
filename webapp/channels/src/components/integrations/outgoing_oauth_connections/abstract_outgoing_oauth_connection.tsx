// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChangeEvent, FormEvent} from 'react';
import React, {useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';
import {useDispatch} from 'react-redux';
import {Link} from 'react-router-dom';

import {AlertOutlineIcon, CheckCircleOutlineIcon} from '@mattermost/compass-icons/components';
import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';
import type {Team} from '@mattermost/types/teams';

import {validateOutgoingOAuthConnection} from 'mattermost-redux/actions/integrations';

import BackstageHeader from 'components/backstage/components/backstage_header';
import ConfirmModal from 'components/confirm_modal';
import FormError from 'components/form_error';
import SpinnerButton from 'components/spinner_button';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

type Props = {
    team: Team;
    header: MessageDescriptor;
    footer: MessageDescriptor;
    loading: MessageDescriptor;
    renderExtra?: JSX.Element;
    serverError: string;

    initialConnection?: OutgoingOAuthConnection;

    submitAction: (connection: OutgoingOAuthConnection) => Promise<void>;
}

type State = {
    name: string;
    oauthTokenUrl: string;
    grantType: OutgoingOAuthConnection['grant_type'];
    clientId: string;
    clientSecret: string;
    audienceUrls: string;
};

enum ValidationStatus {
    INITIAL = 'initial',
    DIRTY = 'dirty',
    VALIDATING = 'validating',
    VALIDATED = 'validated',
    ERROR = 'error',
}

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

    const [storedError, setError] = useState<React.ReactNode>('');
    const [validationError, setValidationError] = useState<string>('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [validationStatus, setValidationStatus] = useState<ValidationStatus>(ValidationStatus.INITIAL);
    const [isEditingSecret, setIsEditingSecret] = useState(false);

    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);

    const intl = useIntl();
    const dispatch = useDispatch();

    const isNewConnection = !props.initialConnection;

    const parseForm = (requireAudienceUrl: boolean): OutgoingOAuthConnection | undefined => {
        if (!formState.name) {
            setIsSubmitting(false);
            setError(
                <FormattedMessage
                    id='add_outgoing_oauth_connection.name.required'
                    defaultMessage='Name for the OAuth connection is required.'
                />,
            );

            return undefined;
        }

        if (!formState.clientId) {
            setIsSubmitting(false);
            setError(
                <FormattedMessage
                    id='add_outgoing_oauth_connection.client_id.required'
                    defaultMessage='Client Id for the OAuth connection is required.'
                />,
            );

            return undefined;
        }

        if ((isNewConnection || isEditingSecret) && !formState.clientSecret) {
            setIsSubmitting(false);
            setError(
                <FormattedMessage
                    id='add_outgoing_oauth_connection.client_secret.required'
                    defaultMessage='Client Secret for the OAuth connection is required.'
                />,
            );

            return undefined;
        }

        if (!formState.grantType) {
            setIsSubmitting(false);
            setError(
                <FormattedMessage
                    id='add_outgoing_oauth_connection.grant_type.required'
                    defaultMessage='Grant Type for the OAuth connection is required.'
                />,
            );

            return undefined;
        }

        if (!formState.oauthTokenUrl) {
            setIsSubmitting(false);
            setError(
                <FormattedMessage
                    id='add_outgoing_oauth_connection.oauth_token_url.required'
                    defaultMessage='OAuth Token URL for the OAuth connection is required.'
                />,
            );

            return undefined;
        }

        const audienceUrls = [];
        for (let audienceUrl of formState.audienceUrls.split('\n')) {
            audienceUrl = audienceUrl.trim();

            if (audienceUrl.length > 0) {
                audienceUrls.push(audienceUrl);
            }
        }

        if (requireAudienceUrl && audienceUrls.length === 0) {
            setIsSubmitting(false);
            setError(
                <FormattedMessage
                    id='add_outgoing_oauth_connection.audienceUrls.required'
                    defaultMessage='One or more audience URLs are required.'
                />,
            );

            return undefined;
        }

        const connection = {
            name: formState.name,
            audiences: audienceUrls,
            client_id: formState.clientId,
            client_secret: formState.clientSecret,
            grant_type: formState.grantType,
            oauth_token_url: formState.oauthTokenUrl,
        } as OutgoingOAuthConnection;

        return connection;
    };

    const showSkipValidateModal = () => {
        setIsValidationModalOpen(true);
    };

    const hideSkipValidateModal = () => {
        setIsValidationModalOpen(false);
    };

    const handleSubmitFromButton = (e: FormEvent) => {
        e.preventDefault();
        handleSubmit();
    };

    const handleSubmit = () => {
        if (isSubmitting) {
            return;
        }

        const connection = parseForm(true);
        if (!connection) {
            return;
        }

        setError('');

        if (validationStatus !== ValidationStatus.VALIDATED && !(!isNewConnection && validationStatus === ValidationStatus.INITIAL)) {
            if (!isValidationModalOpen) {
                showSkipValidateModal();
                return;
            }
        }

        setIsSubmitting(true);

        const res = props.submitAction(connection);
        res.then(() => setIsSubmitting(false));
    };

    const handleValidate = async (e: FormEvent) => {
        e.preventDefault();

        if (validationStatus === ValidationStatus.VALIDATING) {
            return;
        }

        setError('');
        setValidationStatus(ValidationStatus.VALIDATING);

        const connection = parseForm(false);
        if (!connection) {
            // Defer to the form validation error
            setValidationStatus(ValidationStatus.INITIAL);
            return;
        }

        if (props.initialConnection?.id) {
            connection.id = props.initialConnection.id;
        }

        const {error} = await dispatch(validateOutgoingOAuthConnection(props.team.id, connection));

        if (error) {
            setValidationStatus(ValidationStatus.ERROR);
            setValidationError(error.message);
        } else {
            setValidationStatus(ValidationStatus.VALIDATED);
        }
    };

    const setUnvalidated = (e?: React.FormEvent) => {
        e?.preventDefault();

        if (validationStatus !== ValidationStatus.DIRTY) {
            setValidationStatus(ValidationStatus.DIRTY);
        }

        if (validationError) {
            setValidationError('');
        }
    };

    const updateName = (e: ChangeEvent<HTMLInputElement>) => {
        setFormState({
            name: e.target.value,
        });
    };

    const updateClientId = (e: ChangeEvent<HTMLInputElement>) => {
        setUnvalidated();

        setFormState({
            clientId: e.target.value,
        });
    };

    const updateClientSecret = (e: ChangeEvent<HTMLInputElement>) => {
        setUnvalidated();

        setFormState({
            clientSecret: e.target.value,
        });
    };

    const updateOAuthTokenURL = (e: ChangeEvent<HTMLInputElement>) => {
        setUnvalidated();

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

    let clientSecretSection = (
        <input
            id='client_secret'
            type='text'
            autoComplete='off'
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
                    autoComplete='off'
                    type='text'
                    className='form-control disabled'
                    value={'•'.repeat(40)}
                />
                <span
                    onClick={startEditingClientSecret}
                    className='outgoing-oauth-connections-edit-secret'
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
                                autoComplete='off'
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
                            <div className='outgoing-oauth-connection-validate-button-container'>
                                <ValidateButton
                                    onClick={handleValidate}
                                    setUnvalidated={setUnvalidated}
                                    status={validationStatus}
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
                                className='form-control'
                                value={formState.audienceUrls}
                                onChange={updateAudienceUrls}
                            />
                            <div className='form__help'>
                                <FormattedMessage
                                    id='add_outgoing_oauth_connection.audienceUrls.help'
                                    defaultMessage='The URLs which will receive requests with the OAuth token, e.g. your custom slash command handler endpoint. Must be a valid URL and start with http:// or https://.'
                                />
                            </div>
                        </div>
                    </div>
                    <div className='backstage-form__footer'>
                        <FormError
                            type='backstage'
                            errors={[props.serverError, storedError]}
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
                            spinning={isSubmitting}
                            spinningText={intl.formatMessage(props.loading)}
                            onClick={handleSubmitFromButton}
                            id='saveConnection'
                        >
                            <FormattedMessage
                                id={footerToRender.id}
                                defaultMessage={footerToRender.defaultMessage}
                            />
                        </SpinnerButton>
                        {props.renderExtra}
                    </div>
                </form>
            </div>
            <div className='outgoing-oauth-connections-docs-link'>
                <FormattedMessage
                    id={'add_outgoing_oauth_connection.documentation_link'}
                    defaultMessage={'Get help with <link>configuring outgoing OAuth connections</link>.'}
                    values={{
                        link: (text: string) => (
                            <a href='https://mattermost.com/pl/outgoing-oauth-connections'>{text}</a>
                        ),
                    }}
                />
            </div>
            <ConfirmModal
                show={isValidationModalOpen}
                message={intl.formatMessage({
                    id: 'add_outgoing_oauth_connection.save_without_validation_warning',
                    defaultMessage: 'This connection has not been validated, Do you want to save anyway?',
                })}
                title={intl.formatMessage({
                    id: 'add_outgoing_oauth_connection.confirm_save',
                    defaultMessage: 'Save Outgoing OAuth Connection',
                })}
                confirmButtonText={intl.formatMessage({
                    id: 'add_outgoing_oauth_connection.save_anyway',
                    defaultMessage: 'Save anyway',
                })}
                onExited={hideSkipValidateModal}
                onCancel={hideSkipValidateModal}
                onConfirm={handleSubmit}
            />
        </div>
    );
}

type ValidateButtonProps = {
    status: ValidationStatus;
    onClick: (e: FormEvent) => void;
    setUnvalidated: (e: FormEvent) => void;
}

const ValidateButton = ({status, onClick, setUnvalidated}: ValidateButtonProps) => {
    if (status === ValidationStatus.ERROR) {
        return (
            <span
                className='outgoing-oauth-connection-validation-message validation-error'
            >
                <AlertOutlineIcon size={20}/>
                <FormattedMessage
                    id={'add_outgoing_oauth_connection.validation_error'}
                    defaultMessage={'Connection not validated. Please check the server logs for details or <link>try again</link>.'}
                    values={{
                        link: (text: string) => <a onClick={setUnvalidated}>{text}</a>,
                    }}
                />
            </span>
        );
    }

    if (status === ValidationStatus.VALIDATED) {
        return (
            <span
                className='outgoing-oauth-connection-validation-message validation-success'
            >
                <CheckCircleOutlineIcon size={20}/>
                <FormattedMessage
                    id={'add_outgoing_oauth_connection.validated_connection'}
                    defaultMessage={'Validated connection'}
                />
            </span>
        );
    }

    if (status === ValidationStatus.VALIDATING) {
        return (
            <span
                className='outgoing-oauth-connection-validation-message'
            >
                <LoadingSpinner
                    text={(
                        <FormattedMessage
                            id={'add_outgoing_oauth_connection.validating'}
                            defaultMessage={'Validating...'}
                        />
                    )}
                />
            </span>
        );
    }

    const validateButton = (
        <button
            className='btn btn-tertiary btn-sm'
            type='button'
            onClick={onClick}
            id='validateConnection'
        >
            <FormattedMessage
                id={'add_outgoing_oauth_connection.validate'}
                defaultMessage={'Validate Connection'}
            />
        </button>
    );

    return validateButton;
};
