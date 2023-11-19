// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent, ReactNode} from 'react';
import {FormattedMessage, injectIntl, type WrappedComponentProps} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import SettingItemMax from 'components/setting_item_max';

import {localizeMessage, moveCursorToEnd} from 'utils/utils';

import OpenInvite from './open_invite';

import type {PropsFromRedux, OwnProps} from '.';

type Props = PropsFromRedux & OwnProps & WrappedComponentProps;

type State = {
    invite_id?: Team['invite_id'];
    allowed_domains?: Team['allowed_domains'];
    serverError: ReactNode;
    clientError: ReactNode;
    isInitialState: boolean;
    shouldFetchTeam?: boolean;
}

export class AccessTab extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = this.setupInitialState(props);
    }

    setupInitialState(props: Props) {
        const team = props.team;

        return {
            name: team?.display_name,
            invite_id: team?.invite_id,
            allowed_domains: team?.allowed_domains,
            serverError: '',
            clientError: '',
            submitActive: false,
            isInitialState: true,
        };
    }

    static getDerivedStateFromProps(nextProps: Props, prevState: State) {
        const {team} = nextProps;
        if (!prevState.isInitialState) {
            return {
                name: team?.display_name,
                description: team?.description,
                allowed_domains: team?.allowed_domains,
                invite_id: team?.invite_id,
                isInitialState: false,
            };
        }
        return null;
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        if (!prevState.shouldFetchTeam && this.state.shouldFetchTeam) {
            this.fetchTeam();
        }
    }

    fetchTeam() {
        if (this.state.serverError) {
            return;
        }
        if (this.props.team) {
            this.props.actions.getTeam(this.props.team.id).then(({error}) => {
                const state = {
                    shouldFetchTeam: false,
                    serverError: '',
                };
                if (error) {
                    state.serverError = error.message;
                }
                this.setState(state);
            });
        }
    }

    handleAllowedDomainsSubmit = async () => {
        const state = {serverError: '', clientError: ''};

        const data = {
            id: this.props.team?.id,
            allowed_domains: this.state.allowed_domains,
        };
        const {error} = await this.props.actions.patchTeam(data);

        if (error) {
            state.serverError = error.message;
            this.setState(state);
        }
    };

    handleInviteIdSubmit = async () => {
        const state = {serverError: '', clientError: ''};
        this.setState(state);

        const {error} = await this.props.actions.regenerateTeamInviteId(this.props.team?.id || '');

        if (error) {
            state.serverError = error.message;
            this.setState(state);
        }
    };

    updateAllowedDomains = (e: ChangeEvent<HTMLInputElement>) => this.setState({allowed_domains: e.target.value});

    render() {
        const team = this.props.team;

        const clientError = this.state.clientError;
        const serverError = this.state.serverError ?? null;

        let inviteSection;
        if (this.props.canInviteTeamMembers) {
            const inviteSectionInputs = [];

            inviteSectionInputs.push(
                <div key='teamInviteSetting'>
                    <div className='row'>
                        <label className='col-sm-5 control-label visible-xs-block'/>
                        <div className='col-sm-12'>
                            <input
                                id='teamInviteId'
                                autoFocus={true}
                                className='form-control'
                                type='text'
                                value={this.state.invite_id}
                                maxLength={32}
                                onFocus={moveCursorToEnd}
                                readOnly={true}
                            />
                        </div>
                    </div>
                    <div className='setting-list__hint'>
                        <FormattedMessage
                            id='general_tab.codeLongDesc'
                            defaultMessage='The Invite Code is part of the unique team invitation link which is sent to members you’re inviting to this team. Regenerating the code creates a new invitation link and invalidates the previous link.'
                            values={{
                                getTeamInviteLink: (
                                    <strong>
                                        <FormattedMessage
                                            id='general_tab.getTeamInviteLink'
                                            defaultMessage='Get Team Invite Link'
                                        />
                                    </strong>
                                ),
                            }}
                        />
                    </div>
                </div>,
            );

            inviteSection = (
                <SettingItemMax
                    title={localizeMessage('general_tab.codeTitle', 'Invite Code')}
                    inputs={inviteSectionInputs}
                    submit={this.handleInviteIdSubmit}
                    serverError={serverError}
                    clientError={clientError}
                    saveButtonText={localizeMessage('general_tab.regenerate', 'Regenerate')}
                />
            );
        }

        const allowedDomainsSectionInputs = [];

        allowedDomainsSectionInputs.push(
            <div
                key='allowedDomainsSetting'
                className='form-group'
            >
                <div className='col-sm-12'>
                    <input
                        id='allowedDomains'
                        autoFocus={true}
                        className='form-control'
                        type='text'
                        onChange={this.updateAllowedDomains}
                        value={this.state.allowed_domains}
                        onFocus={moveCursorToEnd}
                        placeholder={this.props.intl.formatMessage({id: 'general_tab.AllowedDomainsExample', defaultMessage: 'corp.mattermost.com, mattermost.com'})}
                        aria-label={localizeMessage('general_tab.allowedDomains.ariaLabel', 'Allowed Domains')}
                    />
                </div>
            </div>,
        );

        const allowedDomainsInfo = <span>{localizeMessage('general_tab.AllowedDomainsInfo', 'Users can only join the team if their email matches a specific domain (e.g. "mattermost.com") or list of comma-separated domains (e.g. "corp.mattermost.com, mattermost.com").')}</span>;

        const allowedDomainsSection = (
            <SettingItemMax
                title={localizeMessage('general_tab.allowedDomains', 'Allow only users with a specific email domain to join this team')}
                inputs={allowedDomainsSectionInputs}
                submit={this.handleAllowedDomainsSubmit}
                serverError={serverError}
                clientError={clientError}
                extraInfo={allowedDomainsInfo}
            />
        );

        return (
            <div>
                <div className='modal-header'>
                    <button
                        id='closeButton'
                        type='button'
                        className='close'
                        data-dismiss='modal'
                        aria-label='Close'
                        onClick={this.props.closeModal}
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4 className='modal-title'>
                        <FormattedMessage
                            id='general_tab.title'
                            defaultMessage='General Settings'
                        />
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>
                        <FormattedMessage
                            id='general_tab.title'
                            defaultMessage='General Settings'
                        />
                    </h3>
                    {!team?.group_constrained &&
                        <>
                            <div className='divider-light'/>
                            {allowedDomainsSection}
                        </>
                    }
                    <div className='divider-light'/>
                    <OpenInvite
                        teamId={this.props.team?.id}
                        isGroupConstrained={this.props.team?.group_constrained}
                        allowOpenInvite={this.props.team?.allow_open_invite}
                        patchTeam={this.props.actions.patchTeam}
                    />
                    {!team?.group_constrained &&
                        <>
                            <div className='divider-light'/>
                            {inviteSection}
                        </>
                    }
                    <div className='divider-dark'/>
                </div>
            </div>
        );
    }
}
export default injectIntl(AccessTab);
