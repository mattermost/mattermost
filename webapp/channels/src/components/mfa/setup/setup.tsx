// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

import LocalizedPlaceholderInput from 'components/localized_placeholder_input';

type MFAControllerState = {
    enforceMultifactorAuthentication: boolean;
};

type Props = {

    /*
     * Object containing enforceMultifactorAuthentication
     */
    state: MFAControllerState;

    /*
     * Function that updates parent component with state props
     */
    updateParent: (state: MFAControllerState) => void;

    currentUser: UserProfile;
    siteName?: string;
    enforceMultifactorAuthentication: boolean;
    actions: {
        activateMfa: (code: string) => Promise<{
            error?: {
                server_error_id: string;
                message: string;
            };
        }>;
        generateMfaSecret: () => Promise<{
            data: {
                secret: string;
                qr_code: string;
            };
            error?: {
                message: string;
            };
        }>;
    };
    history: {
        push(path: string): void;
    };
}

type State = {
    secret: string;
    qrCode: string;
    error: React.ReactNode;
    serverError?: string;
}

export default class Setup extends React.PureComponent<Props, State> {
    input: React.RefObject<HTMLInputElement>;

    public constructor(props: Props) {
        super(props);

        this.state = {
            error: undefined,
            secret: '',
            qrCode: '',
        };

        this.input = React.createRef();
    }

    public componentDidMount(): void {
        const user = this.props.currentUser;
        if (!user || user.mfa_active) {
            this.props.history.push('/');
            return;
        }

        this.props.actions.generateMfaSecret().then(({data, error}) => {
            if (error) {
                this.setState({
                    serverError: error.message,
                });
                return;
            }

            this.setState({
                secret: data.secret,
                qrCode: data.qr_code,
            });
        });
    }

    submit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        const code = this.input?.current?.value.replace(/\s/g, '');
        if (!code || code.length === 0) {
            this.setState({
                error: (
                    <FormattedMessage
                        id='mfa.setup.codeError'
                        defaultMessage='Please enter the code from Google Authenticator.'
                    />
                ),
            });
            return;
        }

        this.setState({error: null});

        this.props.actions.activateMfa(code).then(({error}) => {
            if (error) {
                if (error.server_error_id === 'ent.mfa.activate.authenticate.app_error') {
                    this.setState({
                        error: (
                            <FormattedMessage
                                id='mfa.setup.badCode'
                                defaultMessage='Invalid code. If this issue persists, contact your System Administrator.'
                            />
                        ),
                    });
                } else {
                    this.setState({
                        error: error.message,
                    });
                }
                return;
            }

            this.props.history.push('/mfa/confirm');
        });
    };

    public render(): JSX.Element {
        let formClass = 'form-group';
        let errorContent;
        if (this.state.error) {
            errorContent = <div className='form-group has-error'><label className='control-label'>{this.state.error}</label></div>;
            formClass += ' has-error';
        }

        let mfaRequired;
        if (this.props.enforceMultifactorAuthentication) {
            mfaRequired = (
                <p>
                    <FormattedMessage
                        id='mfa.setup.required_mfa'
                        defaultMessage='<strong>Multi-factor authentication is required on {siteName}.</strong>'
                        values={{
                            siteName: this.props.siteName,
                            strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                        }}
                    />
                </p>
            );
        }

        return (
            <div>
                <form
                    onSubmit={this.submit}
                    className={formClass}
                >
                    {mfaRequired}
                    <p>
                        <FormattedMessage
                            id='mfa.setup.step1'
                            defaultMessage='1. Scan the QR code below using an authenticator app of your choice, such as Google Authenticator, Microsoft Authenticator app, or 1Password.'
                        />
                    </p>
                    <p>
                        <FormattedMessage
                            id='mfa.setup.step2_secret'
                            defaultMessage='Alternatively, enter the secret key displayed below into the authenticator app manually.'
                        />
                    </p>
                    <div className='form-group'>
                        <div className='col-sm-12'>
                            <img
                                alt={'qr code image'}
                                style={style.qrCode}
                                src={'data:image/png;base64,' + this.state.qrCode}
                            />
                        </div>
                    </div>
                    <br/>
                    <div className='form-group'>
                        <p className='col-sm-12'>
                            <FormattedMessage
                                id='mfa.setup.secret'
                                defaultMessage='Secret: {secret}'
                                values={{
                                    secret: this.state.secret,
                                }}
                            />
                        </p>
                    </div>
                    <p>
                        <FormattedMessage
                            id='mfa.setup.step3_code'
                            defaultMessage='2. Enter the code generated by the authenticator app in the field below.'
                            values={{
                                strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                            }}
                        />
                    </p>
                    <p>
                        <LocalizedPlaceholderInput
                            ref={this.input}
                            className='form-control'
                            placeholder={defineMessage({id: 'mfa.setup.code', defaultMessage: 'MFA Code'})}
                            autoFocus={true}
                        />
                    </p>
                    {errorContent}
                    <button
                        type='submit'
                        className='btn btn-primary'
                    >
                        <FormattedMessage
                            id='mfa.setup.save'
                            defaultMessage='Save'
                        />
                    </button>
                </form>
            </div>
        );
    }
}

const style = {
    qrCode: {maxHeight: 170},
};
