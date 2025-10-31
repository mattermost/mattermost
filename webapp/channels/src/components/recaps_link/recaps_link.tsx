// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {Link, useLocation, matchPath, useRouteMatch} from 'react-router-dom';

import {CreationOutlineIcon} from '@mattermost/compass-icons/components';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import useGetFeatureFlagValue from 'components/common/hooks/useGetFeatureFlagValue';

import './recaps_link.scss';

const RecapsLink = () => {
    const {url} = useRouteMatch();
    const {pathname} = useLocation();
    const currentTeamId = useSelector(getCurrentTeamId);
    const currentUserId = useSelector(getCurrentUserId);
    const enableAIRecaps = useGetFeatureFlagValue('EnableAIRecaps');

    const inRecaps = matchPath(pathname, {path: '/:team/recaps/:recapId?'}) != null;

    if (!currentTeamId || !currentUserId || enableAIRecaps !== 'true') {
        return null;
    }

    return (
        <ul className='SidebarRecaps NavGroupContent nav nav-pills__container'>
            <li
                id={'sidebar-recaps-button'}
                className={classNames('SidebarChannel', {
                    active: inRecaps,
                })}
                tabIndex={-1}
            >
                <Link
                    to={`${url}/recaps`}
                    id='sidebarItem_recaps'
                    draggable='false'
                    className='SidebarLink sidebar-item'
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
                </Link>
            </li>
        </ul>
    );
};

export default RecapsLink;

