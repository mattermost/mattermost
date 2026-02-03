// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import RemoteUserHour from 'components/advanced_text_editor/remote_user_hour';
import ScheduledPostIndicator from 'components/advanced_text_editor/scheduled_post_indicator/scheduled_post_indicator';

import useTimePostBoxIndicator from '../use_post_box_indicator';

import './style.scss';

type Props = {
    channelId: string;
    teammateDisplayName: string;
    location: string;
    postId: string;
}

export default function PostBoxIndicator({channelId, teammateDisplayName, location, postId}: Props) {
    const {
        showRemoteUserHour,
        isScheduledPostEnabled,
        currentUserTimesStamp,
        teammateTimezone,
    } = useTimePostBoxIndicator(channelId);

    return (
        <div className='postBoxIndicator'>
            {
                showRemoteUserHour &&
                <RemoteUserHour
                    displayName={teammateDisplayName}
                    timestamp={currentUserTimesStamp}
                    teammateTimezone={teammateTimezone}
                />
            }

            {

                isScheduledPostEnabled &&
                <ScheduledPostIndicator
                    location={location}
                    channelId={channelId}
                    postId={postId}
                    remoteUserHourDisplayed={showRemoteUserHour}
                />
            }
        </div>
    );
}
