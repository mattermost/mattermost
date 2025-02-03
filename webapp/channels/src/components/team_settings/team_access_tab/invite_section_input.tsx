// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState, useEffect} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {RefreshIcon} from '@mattermost/compass-icons/components';
import type {Team} from '@mattermost/types/teams';

import {Permissions} from 'mattermost-redux/constants';
import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import type {ActionResult} from 'mattermost-redux/types/actions';

import Input from 'components/widgets/inputs/input/input';
import type {BaseSettingItemProps} from 'components/widgets/modals/components/base_setting_item';
import BaseSettingItem from 'components/widgets/modals/components/base_setting_item';

import type {GlobalState} from 'types/store';

const translations = defineMessages({
    OpenInviteDescriptionError: {
        id: 'team_settings.openInviteDescription.error',
        defaultMessage: 'There was an error generating the invite code, please try again',
    },
});

type Props = {
    regenerateTeamInviteId: (teamId: string) => Promise<ActionResult>;
}

const InviteSectionInput = ({regenerateTeamInviteId}: Props) => {
    const team = useSelector((state: GlobalState) => getCurrentTeam(state));
    const canInviteTeamMembers = useSelector((state: GlobalState) => haveITeamPermission(state, team?.id || '', Permissions.INVITE_USER));
    const [inviteId, setInviteId] = useState<Team['invite_id']>(team?.invite_id ?? '');
    const [inviteIdError, setInviteIdError] = useState<BaseSettingItemProps['error'] | undefined>();
    const {formatMessage} = useIntl();

    useEffect(() => {
        setInviteId(team?.invite_id || '');
    }, [team?.invite_id]);

    const handleRegenerateInviteId = useCallback(async () => {
        const {data, error} = await regenerateTeamInviteId(team?.id || '');

        if (data?.invite_id) {
            setInviteId(data.invite_id);
            return;
        }

        if (error) {
            setInviteIdError(translations.OpenInviteDescriptionError);
        }
    }, [regenerateTeamInviteId, team?.id]);

    if (!canInviteTeamMembers) {
        return null;
    }
    const inviteSectionInput = (
        <div
            data-testid='teamInviteContainer'
            id='teamInviteContainer'
        >
            <Input
                id='teamInviteId'
                type='text'
                value={inviteId}
                maxLength={32}
            />
            <button
                data-testid='regenerateButton'
                id='regenerateButton'
                className='btn btn-tertiary'
                onClick={handleRegenerateInviteId}
            >
                <RefreshIcon/>
                {formatMessage({id: 'general_tab.regenerate', defaultMessage: 'Regenerate'})}
            </button>
        </div>
    );

    return (
        <BaseSettingItem
            className='access-invite-section'
            title={formatMessage({
                id: 'general_tab.codeTitle',
                defaultMessage: 'Invite Code',
            })}
            description={formatMessage({
                id: 'general_tab.codeLongDesc',
                defaultMessage: 'The Invite Code is part of the unique team invitation link which is sent to members you’re inviting to this team. Regenerating the code creates a new invitation link and invalidates the previous link.',

            })}
            content={inviteSectionInput}
            error={inviteIdError}
            descriptionAboveContent={true}
        />
    );
};

export default InviteSectionInput;
