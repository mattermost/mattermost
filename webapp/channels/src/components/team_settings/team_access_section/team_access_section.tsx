// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent, ReactNode} from 'react';
import {FormattedMessage, injectIntl, type WrappedComponentProps} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import SettingItemMax from 'components/setting_item_max';
import BaseSettingItem from 'components/widgets/modals/components/base_setting_item';
import ModalSection from 'components/widgets/modals/components/modal_section';

import {localizeMessage} from 'utils/utils';

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
            const inviteSectionInput = (
                <div id='teamInviteSetting'>
                    <label className='col-sm-5 control-label visible-xs-block'/>
                    <div className='col-sm-12'>
                        <input
                            id='teamInviteId'
                            autoFocus={true}
                            className='form-control'
                            type='text'
                            value={this.state.invite_id}
                            maxLength={32}
                            readOnly={true}
                        />
                    </div>
                </div>
            );

            // inviteSection = (
            //     <SettingItemMax
            //         submit={this.handleInviteIdSubmit}
            //         serverError={serverError}
            //         clientError={clientError}
            //         saveButtonText={localizeMessage('general_tab.regenerate', 'Regenerate')}
            //     />
            // );

            inviteSection = (
                <BaseSettingItem
                    title={{id: 'general_tab.codeTitle', defaultMessage: 'Invite Code'}}
                    description={{id: 'general_tab.codeLongDesc', defaultMessage: 'The Invite Code is part of the unique team invitation link which is sent to members you’re inviting to this team. Regenerating the code creates a new invitation link and invalidates the previous link.'}}
                    content={inviteSectionInput}
                />
            );
        }

        const allowedDomainsSectionInput = (
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
                        placeholder={this.props.intl.formatMessage({id: 'general_tab.AllowedDomainsExample', defaultMessage: 'corp.mattermost.com, mattermost.com'})}
                        aria-label={localizeMessage('general_tab.allowedDomains.ariaLabel', 'Allowed Domains')}
                    />
                </div>
            </div>
        );

        // const allowedDomainsSection = (
        //     <SettingItemMax
        //         submit={this.handleAllowedDomainsSubmit}
        //         serverError={serverError}
        //         clientError={clientError}
        //     />
        // );

        const allowedDomainsSection = (
            <BaseSettingItem
                title={{id: 'general_tab.allowedDomainsTitle', defaultMessage: 'Users with a specific email domain'}}
                description={{id: 'general_tab.allowedDomainsInfo', defaultMessage: 'When enabled, users can only join the team if their email matches a specific domain (e.g. "mattermost.org")'}}
                content={allowedDomainsSectionInput}
            />
        );

        // todo sinan: check title font size is same as figma
        return (
            <ModalSection
                content={
                    <div className='user-settings'>
                        {team?.group_constrained ? undefined : allowedDomainsSection}
                        <OpenInvite
                            teamId={this.props.team?.id}
                            isGroupConstrained={this.props.team?.group_constrained}
                            allowOpenInvite={this.props.team?.allow_open_invite}
                            patchTeam={this.props.actions.patchTeam}
                        />
                        {team?.group_constrained ? undefined : inviteSection}
                    </div>
                }
            />
        );
    }
}
export default injectIntl(AccessTab);
