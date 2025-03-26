// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {closeRightHandSide, showChannelInfo} from 'actions/views/rhs';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';

import * as Menu from 'components/menu';

import {RHSStates} from 'utils/constants';

interface Props extends Menu.FirstMenuItemProps {
    channel: Channel;
}

const ToggleInfo = ({channel, ...rest}: Props) => {
    const dispatch = useDispatch();
    let rhsOpen = useSelector(getIsRhsOpen);
    const rhsState = useSelector(getRhsState);
    if (rhsState !== RHSStates.CHANNEL_INFO) {
        rhsOpen = false;
    }

    const toggleRHS = () => {
        if (rhsOpen) {
            dispatch(closeRightHandSide());
            return;
        }
        dispatch(showChannelInfo(channel.id));
    };

    let text;
    if (rhsOpen) {
        text = (
            <FormattedMessage
                id='channelHeader.hideInfo'
                defaultMessage='Close Info'
            />);
    } else {
        text = (
            <FormattedMessage
                id='channelHeader.viewInfo'
                defaultMessage='View Info'
            />);
    }

    return (
        <>
            <Menu.Item
                leadingElement={<InformationOutlineIcon size='18px'/>}
                onClick={toggleRHS}
                labels={text}
                {...rest}
            />
        </>
    );
};

export default ToggleInfo;
