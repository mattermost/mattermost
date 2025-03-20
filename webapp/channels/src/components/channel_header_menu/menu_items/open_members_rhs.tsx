// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {AccountOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {showChannelMembers} from 'actions/views/rhs';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';

import * as Menu from 'components/menu';

import {RHSStates} from 'utils/constants';

type Props = {
    channel: Channel;
    id: string;
    editMembers?: boolean;
    text: React.ReactElement;
};

const OpenMembersRHS = ({
    id,
    channel,
    text,
    editMembers = false,
}: Props) => {
    const dispatch = useDispatch();
    let rhsOpen = useSelector(getIsRhsOpen);
    const rhsState = useSelector(getRhsState);
    if (rhsState !== RHSStates.CHANNEL_MEMBERS) {
        rhsOpen = false;
    }
    const openRHSIfNotOpen = () => {
        if (rhsOpen) {
            return;
        }
        dispatch(showChannelMembers(channel.id, editMembers));
    };

    return (
        <Menu.Item
            leadingElement={<AccountOutlineIcon size={16}/>}
            id={id}
            onClick={openRHSIfNotOpen}
            labels={text}
        />
    );
};

export default OpenMembersRHS;
