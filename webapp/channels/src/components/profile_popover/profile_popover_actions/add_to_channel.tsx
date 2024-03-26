// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {AccountPlusOutlineIcon} from '@mattermost/compass-icons/components';
import type {UserProfile} from '@mattermost/types/users';

import {canManageAnyChannelMembersInCurrentTeam as getCanManageAnyChannelMembersInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentTeam, getTeamMember} from 'mattermost-redux/selectors/entities/teams';

import AddUserToChannelModal from 'components/add_user_to_channel_modal';
import OverlayTrigger from 'components/overlay_trigger';
import ToggleModalButton from 'components/toggle_modal_button';
import Tooltip from 'components/tooltip';

import Constants, {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

type Props = {
    user: UserProfile;
    returnFocus: () => void;
    handleCloseModals: () => void;
    hide?: () => void;
};

function getIsInCurrentTeam(state: GlobalState, userId: string) {
    const team = getCurrentTeam(state);
    const teamMember = getTeamMember(state, team.id, userId);
    return Boolean(teamMember) && teamMember?.delete_at === 0;
}

const AddToChannel = ({
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
    const addToChannelMessage = formatMessage({
        id: 'user_profile.add_user_to_channel',
        defaultMessage: 'Add to a Channel',
    });

    return (
        <OverlayTrigger
            delayShow={Constants.OVERLAY_TIME_DELAY}
            placement='top'
            overlay={
                <Tooltip id='addToChannelTooltip'>
                    {addToChannelMessage}
                </Tooltip>
            }
        >
            <div>
                <ToggleModalButton
                    id='addToChannelButton'
                    className='btn icon-btn'
                    ariaLabel={addToChannelMessage}
                    modalId={ModalIdentifiers.ADD_USER_TO_CHANNEL}
                    dialogType={AddUserToChannelModal}
                    dialogProps={{user, onExited: returnFocus}}
                    onClick={handleAddToChannel}
                >
                    <AccountPlusOutlineIcon
                        size={18}
                        aria-label={formatMessage({
                            id: 'user_profile.add_user_to_channel.icon',
                            defaultMessage: 'Add User to Channel Icon',
                        })}
                    />
                </ToggleModalButton>
            </div>
        </OverlayTrigger>
    );
};

export default AddToChannel;
