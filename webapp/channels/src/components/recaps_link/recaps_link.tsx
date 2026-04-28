// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {defineMessage, FormattedMessage, useIntl} from 'react-intl';
import {shallowEqual, useSelector} from 'react-redux';
import {Link, useLocation, matchPath, useRouteMatch} from 'react-router-dom';

import {AlertOutlineIcon, CreationOutlineIcon} from '@mattermost/compass-icons/components';

import {getUnreadFinishedRecapsBadge} from 'mattermost-redux/selectors/entities/recaps';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import useGetFeatureFlagValue from 'components/common/hooks/useGetFeatureFlagValue';
import ChannelMentionBadge from 'components/sidebar/sidebar_channel/channel_mention_badge';
import WithTooltip from 'components/with_tooltip';

import './recaps_link.scss';

const failedTooltip = defineMessage({
    id: 'recaps.sidebarLink.failedTooltip',
    defaultMessage: 'One or more recaps failed',
});

const RecapsLink = () => {
    const {formatMessage} = useIntl();
    const {url} = useRouteMatch();
    const {pathname} = useLocation();
    const currentTeamId = useSelector(getCurrentTeamId);
    const currentUserId = useSelector(getCurrentUserId);
    const {count: unreadCount, hasFailed} = useSelector(getUnreadFinishedRecapsBadge, shallowEqual);
    const enableAIRecaps = useGetFeatureFlagValue('EnableAIRecaps');

    const inRecaps = matchPath(pathname, {path: '/:team/recaps/:recapId?'}) != null;

    if (!currentTeamId || !currentUserId || enableAIRecaps !== 'true') {
        return null;
    }

    const hasUnread = unreadCount > 0;

    return (
        <ul className='SidebarRecaps NavGroupContent nav nav-pills__container'>
            <li
                id={'sidebar-recaps-button'}
                className={classNames('SidebarChannel', {
                    active: inRecaps,
                    unread: hasUnread,
                })}
                tabIndex={-1}
            >
                <Link
                    to={`${url}/recaps`}
                    id='sidebarItem_recaps'
                    draggable='false'
                    className={classNames('SidebarLink sidebar-item', {
                        'unread-title': hasUnread,
                    })}
                    tabIndex={0}
                >
                    <span className='icon'>
                        <CreationOutlineIcon size={18}/>
                    </span>
                    <div className='SidebarChannelLinkLabel_wrapper'>
                        <span className='SidebarChannelLinkLabel sidebar-item__name'>
                            <FormattedMessage
                                id='recaps.sidebarLink'
                                defaultMessage='Recaps'
                            />
                        </span>
                    </div>
                    {hasUnread && (hasFailed ? (
                        <WithTooltip title={failedTooltip}>
                            <span
                                className='RecapsFailedIcon'
                                aria-label={formatMessage(failedTooltip)}
                            >
                                <AlertOutlineIcon size={14}/>
                            </span>
                        </WithTooltip>
                    ) : (
                        <ChannelMentionBadge unreadMentions={unreadCount}/>
                    ))}
                </Link>
            </li>
        </ul>
    );
};

export default RecapsLink;
