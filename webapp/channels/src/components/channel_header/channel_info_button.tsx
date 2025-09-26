// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {InformationOutlineIcon} from '@mattermost/compass-icons/components';
import type {Channel} from '@mattermost/types/channels';

import {closeRightHandSide, showChannelInfo} from 'actions/views/rhs';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';

import IconButton from 'components/design_system/icon_button';

import {RHSStates} from 'utils/constants';

import type {RhsState} from 'types/store/rhs';

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

    const tooltip = buttonActive ? intl.formatMessage({id: 'channel_header.closeChannelInfo', defaultMessage: 'Close info'}) : intl.formatMessage({id: 'channel_header.openChannelInfo', defaultMessage: 'View Info'});

    return (
        <IconButton
            id='channel-info-btn'
            icon={<InformationOutlineIcon/>}
            onClick={toggleRHS}
            title={tooltip}
            aria-label={tooltip}
            toggled={buttonActive}
            size='sm'
            padding='default'
        />
    );
};

export default ChannelInfoButton;
