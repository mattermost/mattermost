// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl, type IntlShape} from 'react-intl';
import styled from 'styled-components';

import type {UserProfile} from '@mattermost/types/users';

import BrandedButton from 'components/custom_branding/branded_button';
import BrandedInput from 'components/custom_branding/branded_input';
import ExternalLink from 'components/external_link';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import Input, {SIZE} from 'components/widgets/inputs/input/input';

import logoImage from 'images/logo.png';
import * as Utils from 'utils/utils';

type MFAControllerState = {
    enforceMultifactorAuthentication: boolean;
};

const MfaSetupContainer = styled.div`
    display: flex;
    ol {
        list-style: none;
        counter-reset: item;
        position: relative;
        li {
            counter-increment: item;
            margin-left: 36px;
            margin-bottom: 24px;
        }
        li:before {
            content: counter(item);
            position: absolute;
            left: 20px;
            background: #f2f2f2;
            border-radius: 100%;
            width: 26px;
            height: 26px;
            display: flex;
            text-align: center;
            line-height: 26px;
            font-weight: 600;
            justify-content: center;
        }
    }
`;

const QRContainer = styled.div`
    width: 100%;
    border-radius: 8px;
    border: 1px solid #e7e7e7;
    background: white;
    align-items: center;
    display: flex;
    flex-direction: column;
    padding: 16px;
    justify-content: center;
    img {
        margin-bottom: 16px;
    }
`;

type Props = {

    /*
     * Object containing enforceMultifactorAuthentication
     */
    state: MFAControllerState;
    intl: IntlShape;

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
    error?: any | null;
    serverError?: string;
}

class Setup extends React.PureComponent<Props, State> {
    private input: React.RefObject<HTMLInputElement>;

    public constructor(props: Props) {
        super(props);

        this.state = {secret: '', qrCode: ''};

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
            this.setState({error: Utils.localizeMessage('mfa.setup.codeError', 'Please enter the code from Google Authenticator.')});
            return;
        }

        this.setState({error: null});

        this.props.actions.activateMfa(code).then(({error}) => {
            if (error) {
                if (error.server_error_id === 'ent.mfa.activate.authenticate.app_error') {
                    this.setState({
                        error: Utils.localizeMessage('mfa.setup.badCode', 'Invalid code. If this issue persists, contact your System Administrator.'),
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
                    <FormattedMarkdownMessage
                        id='mfa.setup.required'
                        defaultMessage='**Multi-factor authentication is required on {siteName}.**'
                        values={{
                            siteName: this.props.siteName,
                        }}
                    />
                </p>
            );
        }

        return (
            <div className='signup-team__container mfa'>
                <h1>
                    <FormattedMessage
                        id='mfa.setupTitle'
                        defaultMessage='Scan the QR Code in Authenticator app'
                    />
                </h1>
                <h3>
                    <FormattedMessage
                        id='mfa.setupSubTitle'
                        defaultMessage='Setup Multi-factor Authentication'
                    />
                </h3>
                <img
                    alt={'signup team logo'}
                    className='signup-team-logo'
                    src={logoImage}
                />
                <div id='mfa'>
                    <MfaSetupContainer>
                        <QRContainer>
                            <div>
                                <img
                                    alt={'qr code image'}
                                    style={style.qrCode}
                                    src={'data:image/png;base64,' + this.state.qrCode}
                                />
                            </div>
                            <div>
                                <FormattedMessage
                                    id='mfa.setup.secret'
                                    defaultMessage='Secret: {secret}'
                                    values={{
                                        secret: this.state.secret,
                                    }}
                                />
                            </div>
                        </QRContainer>
                        <form
                            onSubmit={this.submit}
                            className={formClass}
                        >
                            {mfaRequired}
                            <ol>
                                <li>
                                    <FormattedMessage
                                        id='mfa.setup.step1'
                                        defaultMessage='On your phone, download Google Authenticator from <linkiTunes>iTunes</linkiTunes> or <linkGooglePlay>Google Play</linkGooglePlay>'
                                        values={{
                                            strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
                                            linkiTunes: (msg: React.ReactNode) => (
                                                <ExternalLink
                                                    href='https://itunes.apple.com/us/app/google-authenticator/id388497605?mt=8'
                                                    location='mfa_setup'
                                                >
                                                    {msg}
                                                </ExternalLink>
                                            ),
                                            linkGooglePlay: (msg: React.ReactNode) => (
                                                <ExternalLink
                                                    href='https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2&hl=en'
                                                    location='mfa_setup'
                                                >
                                                    {msg}
                                                </ExternalLink>
                                            ),
                                        }}
                                    />
                                </li>
                                <li>
                                    <FormattedMarkdownMessage
                                        id='mfa.setup.step2'
                                        defaultMessage='Use Google Authenticator to scan this QR code, or manually type in the secret key'
                                    />
                                </li>
                                <li>
                                    <FormattedMarkdownMessage
                                        id='mfa.setup.step3'
                                        defaultMessage='Enter the code generated by Google Authenticator'
                                    />
                                </li>
                            </ol>
                            <div className='input-line'>
                                <BrandedInput>
                                    <Input
                                        ref={this.input}
                                        className='form-control'
                                        placeholder={this.props.intl.formatMessage({id: 'mfa.setup.code', defaultMessage: 'MFA Code'})}
                                        autoFocus={true}
                                        inputSize={SIZE.LARGE}
                                    />
                                </BrandedInput>
                                <BrandedButton>
                                    <button
                                        type='submit'
                                        className='btn btn-primary'
                                    >
                                        <FormattedMessage
                                            id='mfa.setup.save'
                                            defaultMessage='Save'
                                        />
                                    </button>
                                </BrandedButton>
                            </div>
                            {errorContent}
                        </form>
                    </MfaSetupContainer>
                </div>
            </div>
        );
    }
}

const style = {
    qrCode: {maxHeight: 170},
};

export default injectIntl(Setup);
