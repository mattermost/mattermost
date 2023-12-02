// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import type {ChangeEvent} from 'react';
import {useIntl} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import BaseSettingItem from 'components/widgets/modals/components/base_setting_item';
import ModalSection from 'components/widgets/modals/components/modal_section';

import {localizeMessage} from 'utils/utils';

import OpenInvite from './open_invite';

import type {PropsFromRedux, OwnProps} from '.';

type Props = PropsFromRedux & OwnProps;

const AccessTab = (props: Props) => {
    const [inviteId, setInviteId] = useState<Team['invite_id']>(props.team?.invite_id ?? '');
    const [allowedDomains, setAllowedDomains] = useState<Team['allowed_domains']>(props.team?.allowed_domains ?? '');
    const [serverError, setServerError] = useState<string>('');
    const [clientError, setClientError] = useState<string>('');
    const {formatMessage} = useIntl();

    const handleAllowedDomainsSubmit = async () => {
        const {error} = await props.actions.patchTeam({
            id: props.team?.id,
            allowed_domains: allowedDomains,
        });
        if (error) {
            setServerError(error.message);
        }
    };

    const handleInviteIdSubmit = async () => {
        setClientError('');
        const {error} = await props.actions.regenerateTeamInviteId(props.team?.id || '');
        if (error) {
            setServerError(error.message);
        }
    };

    const updateAllowedDomains = (e: ChangeEvent<HTMLInputElement>) => setAllowedDomains(e.target.value);

    let inviteSection;
    if (props.canInviteTeamMembers) {
        const inviteSectionInput = (
            <div id='teamInviteSetting'>
                <label className='col-sm-5 control-label visible-xs-block'/>
                <div className='col-sm-12'>
                    <input
                        id='teamInviteId'
                        autoFocus={true}
                        className='form-control'
                        type='text'
                        value={inviteId}
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
                    onChange={updateAllowedDomains}
                    value={allowedDomains}
                    placeholder={formatMessage({id: 'general_tab.AllowedDomainsExample', defaultMessage: 'corp.mattermost.com, mattermost.com'})}
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
    // todo sinan: descriptions are placed above content. Waiting an input from Matt
    return (
        <ModalSection
            content={
                <div className='user-settings'>
                    {props.team?.group_constrained ? undefined : allowedDomainsSection}
                    <OpenInvite
                        teamId={props.team?.id}
                        isGroupConstrained={props.team?.group_constrained}
                        allowOpenInvite={props.team?.allow_open_invite}
                        patchTeam={props.actions.patchTeam}
                    />
                    {props.team?.group_constrained ? undefined : inviteSection}
                </div>
            }
        />
    );
};
export default AccessTab;
