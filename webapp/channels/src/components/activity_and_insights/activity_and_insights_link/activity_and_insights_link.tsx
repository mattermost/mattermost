// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChartLineIcon} from '@mattermost/compass-icons/components';
import classNames from 'classnames';
import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {Link, useRouteMatch, useLocation, matchPath} from 'react-router-dom';

import {trackEvent} from 'actions/telemetry_actions';
import {closeRightHandSide} from 'actions/views/rhs';
import {insightsAreEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';

import {RHSStates} from 'utils/constants';
import {t} from 'utils/i18n';

import InsightsTourTip from './insights_tour_tip/insights_tour_tip';

import './activity_and_insights_link.scss';

const ActivityAndInsightsLink = () => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const insightsEnabled = useSelector(insightsAreEnabled);
    const rhsOpen = useSelector(getIsRhsOpen);
    const rhsState = useSelector(getRhsState);

    const {url} = useRouteMatch();
    const {pathname} = useLocation();
    const inInsights = matchPath(pathname, {path: '/:team/activity-and-insights'}) != null;

    const openInsights = useCallback((e) => {
        e.stopPropagation();
        trackEvent('insights', 'sidebar_open_insights');
        if (rhsOpen && rhsState === RHSStates.EDIT_HISTORY) {
            dispatch(closeRightHandSide());
        }
    }, [rhsOpen, rhsState]);

    if (!insightsEnabled) {
        return null;
    }

    return (
        <ul className='SidebarInsights NavGroupContent nav nav-pills__container'>
            <li
                id={'sidebar-insights-button'}
                className={classNames('SidebarChannel', {
                    active: inInsights,
                })}
                tabIndex={-1}
            >
                <Link
                    onClick={openInsights}
                    to={`${url}/activity-and-insights`}
                    id='sidebarItem_insights'
                    draggable='false'
                    className={'SidebarLink sidebar-item'}
                    tabIndex={0}
                >
                    <span className='icon'>
                        <ChartLineIcon size={14}/>
                    </span>
                    <div className='SidebarChannelLinkLabel_wrapper'>
                        <span className='SidebarChannelLinkLabel sidebar-item__name'>
                            {formatMessage({id: t('activityAndInsights.sidebarLink'), defaultMessage: 'Insights'})}
                        </span>
                    </div>
                </Link>
                <InsightsTourTip/>
            </li>
        </ul>
    );
};

export default ActivityAndInsightsLink;
