// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {canManageAnyChannelMembersInCurrentTeam as getCanManageAnyChannelMembersInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam, getTeamMember} from 'mattermost-redux/selectors/entities/teams';

import AddUserToChannelModal from 'components/add_user_to_channel_modal';
import ToggleModalButton from 'components/toggle_modal_button';
import WithTooltip from 'components/with_tooltip';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

type Props = {
    user: UserProfile;
    returnFocus: () => void;
    handleCloseModals: () => void;
    hide?: () => void;
};

function getIsInCurrentTeam(state: GlobalState, userId: string) {
    const team = getCurrentTeam(state);
    const teamMember = team ? getTeamMember(state, team.id, userId) : undefined;
    return Boolean(teamMember) && teamMember?.delete_at === 0;
}

const ProfilePopoverAddToChannel = ({
    handleCloseModals,
    returnFocus,
    user,
    hide,
}: Props) => {
    const {formatMessage} = useIntl();

    const canManageAnyChannelMembersInCurrentTeam = useSelector((state: GlobalState) => getCanManageAnyChannelMembersInCurrentTeam(state));
    const isInCurrentTeam = useSelector((state: GlobalState) => getIsInCurrentTeam(state, user.id));

    const handleAddToChannel = useCallback(() => {
        hide?.();
        handleCloseModals();
    }, [hide, handleCloseModals]);

    if (!canManageAnyChannelMembersInCurrentTeam || !isInCurrentTeam) {
        return null;
    }

    return (
        <WithTooltip
            title={formatMessage({
                id: 'user_profile.add_user_to_channel',
                defaultMessage: 'Add to a Channel',
            })}
        >
            {/* This span is necessary as tooltip is not able to pass trigger props to a custom component */}
            <span>
                <ToggleModalButton
                    id='addToChannelButton'
                    className='btn btn-icon btn-sm'
                    ariaLabel={formatMessage({
                        id: 'user_profile.add_user_to_channel',
                        defaultMessage: 'Add to a Channel',
                    })}
                    modalId={ModalIdentifiers.ADD_USER_TO_CHANNEL}
                    dialogType={AddUserToChannelModal}
                    dialogProps={{user, onExited: returnFocus}}
                    onClick={handleAddToChannel}
                >
                    <i
                        className='icon icon-account-plus-outline'
                        aria-hidden='true'
                    />
                </ToggleModalButton>
            </span>
        </WithTooltip>
    );
};

export default ProfilePopoverAddToChannel;
