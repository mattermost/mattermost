// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import Constants from 'utils/constants';

import {Channel} from '@mattermost/types/channels';
import {UserProfile} from '@mattermost/types/users';

import {DMUser} from './channel_info_rhs';
import AboutAreaDM from './about_area_dm';
import AboutAreaGM from './about_area_gm';
import AboutAreaChannel from './about_area_channel';

const Container = styled.div`
    overflow-wrap: anywhere;
    padding: 24px;
    padding-bottom: 12px;

    font-size: 14px;
    line-height: 20px;

    & .status-wrapper {
        height: 50px;
    }

    & .text-empty {
        padding: 0px;
        background: transparent;
        border: 0px;
        color: rgba(var(--center-channel-color-rgb), 0.75);
    }
`;

interface Props {
    channel: Channel;
    dmUser?: DMUser;
    gmUsers?: UserProfile[];
    canEditChannelProperties: boolean;
    actions: {
        editChannelPurpose: () => void;
        editChannelHeader: () => void;
    };
}

const AboutArea = ({channel, dmUser, gmUsers, canEditChannelProperties, actions}: Props) => {
    return (
        <Container>
            {channel.type === Constants.DM_CHANNEL && dmUser && (
                <AboutAreaDM
                    channel={channel}
                    dmUser={dmUser}
                    actions={{editChannelHeader: actions.editChannelHeader}}
                />
            )}
            {channel.type === Constants.GM_CHANNEL && gmUsers && (
                <AboutAreaGM
                    channel={channel}
                    gmUsers={gmUsers!}
                    actions={{editChannelHeader: actions.editChannelHeader}}
                />
            )}
            {[Constants.OPEN_CHANNEL, Constants.PRIVATE_CHANNEL].includes(channel.type) && (
                <AboutAreaChannel
                    channel={channel}
                    canEditChannelProperties={canEditChannelProperties}
                    actions={actions}
                />
            )}
        </Container>
    );
};

export default AboutArea;
