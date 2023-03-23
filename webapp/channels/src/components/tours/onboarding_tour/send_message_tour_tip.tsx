// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import PrewrittenChips from 'components/advanced_create_post/prewritten_chips';

import {Channel} from '@mattermost/types/channels';

import {useMeasurePunchouts} from '@mattermost/components';

import OnboardingTourTip from './onboarding_tour_tip';

type Props = {
    prefillMessage: (msg: string, shouldFocus: boolean) => void;
    currentChannel: Channel;
    currentUserId: string;
    currentChannelTeammateUsername?: string;
}

const translate = {x: -6, y: -6};

export const SendMessageTour = ({
    prefillMessage,
    currentChannel,
    currentUserId,
    currentChannelTeammateUsername,
}: Props) => {
    const chips = (
        <PrewrittenChips
            prefillMessage={prefillMessage}
            currentChannel={currentChannel}
            currentUserId={currentUserId}
            currentChannelTeammateUsername={currentChannelTeammateUsername}
        />
    );

    const title = (
        <FormattedMessage
            id='onboardingTour.sendMessage.title'
            defaultMessage={'Send messages'}
        />
    );

    const screen = (
        <>
            <p>
                <FormattedMessage
                    id='onboardingTour.sendMessage.Description'
                    defaultMessage={'Start collaborating with others by typing or selecting one of the messages below. You can also drag and drop attachments into the text field or upload them using the paperclip icon.'}
                />
            </p>
            <div>
                {chips}
            </div>
        </>
    );
    const overlayPunchOut = useMeasurePunchouts(['post-create'], [], {y: -11, height: 11, x: 0, width: 0});

    return (
        <OnboardingTourTip
            title={title}
            screen={screen}
            placement='top-start'
            pulsatingDotPlacement='top-start'
            pulsatingDotTranslate={translate}
            width={400}
            overlayPunchOut={overlayPunchOut}
        />
    );
};

