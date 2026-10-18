// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import type {MfaSecret} from '@mattermost/types/mfa';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import Input from 'components/widgets/inputs/input/input';

type Props = {
    currentUser: UserProfile;
    siteName?: string;
    enforceMultifactorAuthentication: boolean;
    actions: {
        activateMfa: (code: string) => Promise<ActionResult<unknown, {
            server_error_id: string;
            message: string;
        }>>;
        generateMfaSecret: () => Promise<ActionResult<MfaSecret>>;
    };
    history: {
        push(path: string): void;
    };
};

type State = {
    code: string;
    secret: string;
    qrCode: string;
    error: React.ReactNode;
    serverError?: string;
};

export default class Setup extends React.PureComponent<Props, State> {
    input: React.RefObject<HTMLInputElement | null>;

    public constructor(props: Props) {
        super(props);

        this.state = {
            code: '',
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
                secret: data!.secret,
                qrCode: data!.qr_code,
            });
        });
    }

    handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({
            code: e.target.value,
            error: null,
        });
    };

    submit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        const code = this.state.code.replace(/\s/g, '');
        if (!code || code.length === 0) {
            this.setState({
                error: (
                    <FormattedMessage
                        id='mfa.setup.codeError'
                        defaultMessage='Please enter the code from your authenticator app.'
                    />
                ),
            });
            this.input?.current?.focus();
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
                this.input?.current?.focus();
                return;
            }

            this.props.history.push('/mfa/confirm');
        });
    };

    public render(): JSX.Element {
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

        const codeErrorMessage = this.state.error ? {
            type: 'error' as const,
            value: this.state.error,
        } : null;

        return (
            <div>
                <form onSubmit={this.submit}>
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
                        />
                    </p>
                    <Input
                        ref={this.input}
                        id='mfaSetupCode'
                        name='code'
                        type='text'
                        containerClassName='mfa-setup-code'
                        label={defineMessage({id: 'mfa.setup.code', defaultMessage: 'MFA Code'})}
                        placeholder={defineMessage({id: 'mfa.setup.code', defaultMessage: 'MFA Code'})}
                        value={this.state.code}
                        onChange={this.handleCodeChange}
                        autoFocus={true}
                        required={true}
                        hasError={Boolean(this.state.error)}
                        customMessage={codeErrorMessage}
                        autoComplete='one-time-code'
                        inputMode='numeric'
                    />
                    <Button
                        type='submit'
                        emphasis='primary'
                    >
                        <FormattedMessage
                            id='mfa.setup.save'
                            defaultMessage='Save'
                        />
                    </Button>
                </form>
            </div>
        );
    }
}

const style = {
    qrCode: {maxHeight: 170},
};
