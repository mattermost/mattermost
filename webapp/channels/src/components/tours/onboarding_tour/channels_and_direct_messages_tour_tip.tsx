// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMeasurePunchouts} from '@mattermost/components';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getChannelsNameMapInCurrentTeam} from 'mattermost-redux/selectors/entities/channels';

import ChannelsImg from 'images/channels_and_direct_tour_tip.svg';
import {GlobalState} from 'types/store';
import Constants from 'utils/constants';

import OnboardingTourTip from './onboarding_tour_tip';

type Props = {
    firstChannelName?: string;
}

const FirstChannel = ({firstChannelName}: {firstChannelName: string}) => {
    return (
        <FormattedMessage
            id='onboardingTour.ChannelsAndDirectMessagesTour.firstChannel'
            defaultMessage='Hey look, there’s your **{firstChannelName}** channel! '
            values={{firstChannelName}}
        />
    );
};

export const ChannelsAndDirectMessagesTour = ({firstChannelName}: Props) => {
    const channelsByName = useSelector((state: GlobalState) => getChannelsNameMapInCurrentTeam(state));
    const townSquareDisplayName = channelsByName[Constants.DEFAULT_CHANNEL]?.display_name || Constants.DEFAULT_CHANNEL_UI_NAME;
    const offTopicDisplayName = channelsByName[Constants.OFFTOPIC_CHANNEL]?.display_name || Constants.OFFTOPIC_CHANNEL_UI_NAME;

    const title = (
        <FormattedMessage
            id='onboardingTour.ChannelsAndDirectMessagesTour.title'
            defaultMessage={'Channels and direct messages'}
        />
    );
    const screen = (
        <>
            <p>
                {firstChannelName && <FirstChannel firstChannelName={firstChannelName}/>}
                <FormattedMessage
                    id='onboardingTour.ChannelsAndDirectMessagesTour.channels'
                    defaultMessage={'Channels are where you can communicate with your team about a topic or project.'}
                />
            </p>
            <p>
                <FormattedMessage
                    id='onboardingTour.ChannelsAndDirectMessagesTour.townSquare'
                    defaultMessage='We’ve also added the <b>{townSquare}</b> and <b>{offTopic}</b> channels for everyone on your team.'
                    values={{townSquare: townSquareDisplayName, offTopic: offTopicDisplayName, b: (value: string) => <b>{value}</b>}}
                />
            </p>
            <p>
                <FormattedMessage
                    id='onboardingTour.ChannelsAndDirectMessagesTour.directMessages'
                    defaultMessage='<b>Direct messages</b> are for private conversations between individuals or small groups.'
                    values={{b: (value: string) => <b>{value}</b>}}
                />
            </p>
        </>
    );

    const overlayPunchOut = useMeasurePunchouts(['sidebar-droppable-categories'], []);

    return (
        <OnboardingTourTip
            title={title}
            screen={screen}
            imageURL={ChannelsImg}
            placement='right-start'
            pulsatingDotPlacement='right'
            width={352}
            overlayPunchOut={overlayPunchOut}
        />
    );
};

