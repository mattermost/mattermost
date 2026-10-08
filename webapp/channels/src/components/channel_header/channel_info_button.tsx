// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {closeRightHandSide, showChannelInfo} from 'actions/views/rhs';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';

import {RHSStates} from 'utils/constants';

import type {RhsState} from 'types/store/rhs';

import HeaderIconWrapper from './components/header_icon_wrapper';

interface Props {
    channel: Channel;
}

const ChannelInfoButton = ({channel}: Props) => {
    const dispatch = useDispatch();
    const intl = useIntl();

    const rhsState: RhsState = useSelector(getRhsState);
    const isRhsOpen: boolean = useSelector(getIsRhsOpen);
    const isChannelInfo = rhsState === RHSStates.CHANNEL_INFO ||
        rhsState === RHSStates.CHANNEL_MEMBERS ||
        rhsState === RHSStates.CHANNEL_FILES ||
        rhsState === RHSStates.PIN;

    const buttonActive = isRhsOpen && isChannelInfo;
    const toggleRHS = useCallback(() => {
        if (buttonActive) {
            const action = isChannelInfo ? closeRightHandSide() : showChannelInfo(channel.id);
            dispatch(action);
        } else {
            dispatch(showChannelInfo(channel.id));
        }
    }, [buttonActive, channel.id, isChannelInfo, dispatch]);

    let tooltip;
    if (buttonActive) {
        tooltip = intl.formatMessage({id: 'channel_header.closeChannelInfo', defaultMessage: 'Close Info'});
    } else {
        tooltip = intl.formatMessage({id: 'channel_header.openChannelInfo', defaultMessage: 'View Info'});
    }

    let buttonClass = 'channel-header__icon channel-header__icon--small';
    if (buttonActive) {
        buttonClass += ' channel-header__icon--active-inverted';
    }

    return (
        <HeaderIconWrapper
            buttonClass={buttonClass}
            buttonId='channel-info-btn'
            onClick={toggleRHS}
            size='small'
            tooltip={tooltip}
        >
            <InformationOutlineIcon size={16}/>
        </HeaderIconWrapper>
    );
};

export default ChannelInfoButton;
