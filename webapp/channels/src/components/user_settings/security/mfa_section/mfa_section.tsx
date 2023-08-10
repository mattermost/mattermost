// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import SettingItemMax from 'components/setting_item_max';
import SettingItemMin from 'components/setting_item_min';

import {getHistory} from 'utils/browser_history';

import type SettingItemMinComponent from 'components/setting_item_min/setting_item_min';
import type {RefObject} from 'react';

const SECTION_MFA = 'mfa';

type Props = {
    active: boolean;
    areAllSectionsInactive: boolean;

    // Whether or not the current user has MFA enabled
    mfaActive: boolean;

    // Whether or not the current user can enable MFA based on their authentication type and the server's settings
    mfaAvailable: boolean;

    // Whether or not this server enforces that all users have MFA
    mfaEnforced: boolean;

    updateSection: (section: string) => void;
    actions: {deactivateMfa: () => Promise<{error?: {message: string}}>};
}

type State = {
    serverError: string|null;
}

export default class MfaSection extends React.PureComponent<Props, State> {
    minRef: RefObject<SettingItemMinComponent>;

    public constructor(props: Props) {
        super(props);
        this.state = {
            serverError: null,
        };

        this.minRef = React.createRef();
    }

    focusEditButton(): void {
        this.minRef.current?.focus();
    }

    componentDidUpdate(prevProps: Props) {
        if (prevProps.active && !this.props.active && this.props.areAllSectionsInactive) {
            this.focusEditButton();
        }
    }

    public setupMfa = (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault();

        getHistory().push('/mfa/setup');
    };

    public removeMfa = async (e: React.MouseEvent<HTMLElement>) => {
        e.preventDefault();

        const {error} = await this.props.actions.deactivateMfa();

        if (error) {
            this.setState({
                serverError: error.message,
            });
            return;
        }

        if (this.props.mfaEnforced) {
            getHistory().push('/mfa/setup');
            return;
        }

        this.props.updateSection('');
        this.setState({
            serverError: null,
        });
    };

    private renderTitle = () => {
        return (
            <FormattedMessage
                id='user.settings.mfa.title'
                defaultMessage='Multi-factor Authentication'
            />
        );
    };

    private renderDescription = () => {
        if (this.props.mfaActive) {
            return (
                <FormattedMessage
                    id='user.settings.security.active'
                    defaultMessage='Active'
                />
            );
        }

        return (
            <FormattedMessage
                id='user.settings.security.inactive'
                defaultMessage='Inactive'
            />
        );
    };

    private renderContent = () => {
        let content;

        if (this.props.mfaActive) {
            let buttonText;

            if (this.props.mfaEnforced) {
                buttonText = (
                    <FormattedMessage
                        id='user.settings.mfa.reset'
                        defaultMessage='Reset MFA on Account'
                    />
                );
            } else {
                buttonText = (
                    <FormattedMessage
                        id='user.settings.mfa.remove'
                        defaultMessage='Remove MFA from Account'
                    />
                );
            }

            content = (
                <a
                    className='btn btn-primary'
                    href='#'
                    onClick={this.removeMfa}
                >
                    {buttonText}
                </a>
            );
        } else {
            content = (
                <a
                    className='btn btn-primary'
                    href='#'
                    onClick={this.setupMfa}
                >
                    <FormattedMessage
                        id='user.settings.mfa.add'
                        defaultMessage='Add MFA to Account'
                    />
                </a>
            );
        }

        return (
            <div className='pt-2'>
                {content}
                <br/>
            </div>
        );
    };

    private renderHelpText = () => {
        if (this.props.mfaActive) {
            if (this.props.mfaEnforced) {
                return (
                    <FormattedMessage
                        id='user.settings.mfa.requiredHelp'
                        defaultMessage='Multi-factor authentication is required on this server. Resetting is only recommended when you need to switch code generation to a new mobile device. You will be required to set it up again immediately.'
                    />
                );
            }

            return (
                <FormattedMessage
                    id='user.settings.mfa.removeHelp'
                    defaultMessage='Removing multi-factor authentication means you will no longer require a phone-based passcode to sign-in to your account.'
                />
            );
        }

        return (
            <FormattedMessage
                id='user.settings.mfa.addHelp'
                defaultMessage='Adding multi-factor authentication will make your account more secure by requiring a code from your mobile phone each time you sign in.'
            />
        );
    };

    public render() {
        const title = this.renderTitle();

        if (!this.props.mfaAvailable) {
            return null;
        }

        if (!this.props.active) {
            return (
                <SettingItemMin
                    title={title}
                    describe={this.renderDescription()}
                    section={SECTION_MFA}
                    updateSection={this.props.updateSection}
                    ref={this.minRef}
                />
            );
        }

        return (
            <SettingItemMax
                title={title}
                inputs={this.renderContent()}
                extraInfo={this.renderHelpText()}
                serverError={this.state.serverError}
                updateSection={this.props.updateSection}
                width='medium'
            />
        );
    }
}
