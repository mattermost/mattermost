// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';
import {Link} from 'react-router-dom';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import {isMobile} from '@mattermost/shared/utils/user_agent';

import * as GlobalActions from 'actions/global_actions';

import Timestamp from 'components/timestamp';
import type {TimestampVariant} from 'components/timestamp';

import {Locations} from 'utils/constants';

const getTimeFormat: ComponentProps<typeof Timestamp>['useTime'] = (_, {hour, minute, second}) => ({hour, minute, second});
const getDateFormat: ComponentProps<typeof Timestamp>['useDate'] = {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'};

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

    /*
     * Which presentation of the viewer's preferred timestamp format to use.
     * `compact` collapses to the shortest form for compact display and consecutive posts.
     */
    variant?: TimestampVariant;
};

export default class PostTime extends React.PureComponent<Props> {
    static defaultProps: Partial<Props> = {
        eventTime: 0,
        location: Locations.CENTER,
        variant: 'post',
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
            variant = 'post',
        } = this.props;

        const postTime = (
            <Timestamp
                value={eventTime}
                className='post__time'
                usePreferredFormat={true}
                variant={variant}
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

                    // The tooltip is always the full, unambiguous date and time regardless
                    // of the viewer's preferred format.
                    <Timestamp
                        value={eventTime}
                        useSemanticOutput={false}
                        useDate={getDateFormat}
                        useTime={getTimeFormat}
                    />
                }
            >
                {content}
            </WithTooltip>
        );
    }
}
