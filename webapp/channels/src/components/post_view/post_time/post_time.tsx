// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Link} from 'react-router-dom';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import {isMobile} from '@mattermost/shared/utils/user_agent';

import * as GlobalActions from 'actions/global_actions';

import EventTimestamp from 'components/event_timestamp';
import EventTimestampTooltip from 'components/event_timestamp/event_timestamp_tooltip';

import {Locations} from 'utils/constants';
import type {TimestampDisplayContext, TimestampDisplayTier} from 'utils/datetime_display_format';

type Props = {

    /*
     * If true, time will be rendered as a permalink to the post
     */
    isPermalink: boolean;

    /*
     * The time to display
     */
    eventTime: number;

    isMobileView: boolean;
    location: string;

    /*
     * The post id of posting being rendered
     */
    postId: string;
    teamUrl: string;
    context?: TimestampDisplayContext;
    tier?: TimestampDisplayTier;
    isConsecutivePost?: boolean;
    forceTimeOnly?: boolean;
};

export default class PostTime extends React.PureComponent<Props> {
    static defaultProps: Partial<Props> = {
        eventTime: 0,
        location: Locations.CENTER,
        context: 'post',
    };

    handleClick = () => {
        if (this.props.isMobileView) {
            GlobalActions.emitCloseRightHandSide();
        }
    };

    render() {
        const {
            eventTime,
            isPermalink,
            location,
            postId,
            teamUrl,
            context = 'post',
            tier,
            isConsecutivePost = false,
            forceTimeOnly = false,
        } = this.props;

        const postTime = (
            <EventTimestamp
                value={eventTime}
                className='post__time'
                showTooltip={false}
                displayContext={context}
                tier={tier}
                isConsecutivePost={isConsecutivePost}
                forceTimeOnly={forceTimeOnly}
            />
        );

        const content = isMobile() || !isPermalink ? (
            <div
                role='presentation'
                className='post__permalink post_permalink_mobile_view'
            >
                {postTime}
            </div>
        ) : (
            <Link
                id={`${location}_time_${postId}`}
                to={`${teamUrl}/pl/${postId}`}
                className='post__permalink'
                onClick={this.handleClick}
                aria-labelledby={eventTime.toString()}
            >
                {postTime}
            </Link>
        );

        return (
            <WithTooltip
                title={
                    <EventTimestampTooltip value={eventTime}/>
                }
            >
                {content}
            </WithTooltip>
        );
    }
}
