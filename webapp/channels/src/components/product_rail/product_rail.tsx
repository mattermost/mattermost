// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {Link, matchPath, useLocation} from 'react-router-dom';

import glyphMap, {MessageTextOutlineIcon, ProductChannelsIcon} from '@mattermost/compass-icons/components';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';

import {getThreadCounts} from 'mattermost-redux/actions/threads';
import {getTeamsUnreadStatuses} from 'mattermost-redux/selectors/entities/channels';
import {isProductRailEnabled} from 'mattermost-redux/selectors/entities/general';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getThreadCountsInCurrentTeam} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {selectProducts} from 'selectors/products';

import {TEAM_NAME_PATH_PATTERN} from 'utils/path';
import {getProductSwitcherLinkURL, useCurrentProduct} from 'utils/products';

import './product_rail.scss';

const messages = defineMessages({
    ariaLabel: {
        id: 'product_rail.ariaLabel',
        defaultMessage: 'Product navigation',
        description: 'Accessible name for the vertical navigation rail beside the team sidebar that switches between Channels, Threads and products such as Playbooks and Boards.',
    },
    channels: {
        id: 'product_rail.channels',
        defaultMessage: 'Channels',
        description: 'Label under the Channels icon in the product navigation rail. Clicking it shows the channel sidebar.',
    },
    threads: {
        id: 'product_rail.threads',
        defaultMessage: 'Threads',
        description: 'Label under the Threads icon in the product navigation rail. Clicking it opens the list of followed threads.',
    },
});

// The vertical navigation rail shown between the team sidebar and the LHS when the ProductRail
// feature flag is on. Each item swaps what the LHS and center show: Channels and Threads stay
// within the channels product, and each registered product (Playbooks, Boards, ...) brings its
// own LHS when its route is active.
export default function ProductRail() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const {pathname} = useLocation();

    const enabled = useSelector(isProductRailEnabled);
    const products = useSelector(selectProducts);
    const currentTeam = useSelector(getCurrentTeam);
    const currentUserId = useSelector(getCurrentUserId);
    const currentProduct = useCurrentProduct();
    const threadsEnabled = useSelector(isCollapsedThreadsEnabled);
    const threadCounts = useSelector(getThreadCountsInCurrentTeam);
    const [unreadTeamsSet, mentionsInTeamMap, teamHasUrgentMap] = useSelector(getTeamsUnreadStatuses);

    const currentTeamId = currentTeam?.id;

    // The channel sidebar's Threads link is hidden while the rail is on, so the rail owns
    // loading the counts it used to fetch.
    useEffect(() => {
        if (enabled && threadsEnabled && currentUserId && currentTeamId) {
            dispatch(getThreadCounts(currentUserId, currentTeamId));
        }
    }, [dispatch, enabled, threadsEnabled, currentUserId, currentTeamId]);

    if (!enabled || !currentTeam) {
        return null;
    }

    const inThreads = matchPath(pathname, {path: `/:team(${TEAM_NAME_PATH_PATTERN})/threads`}) !== null;

    const productItems = products.map((product) => {
        const link = getProductSwitcherLinkURL(product, currentTeam.name);
        if (link === null) {
            return null;
        }

        // A glyph name that isn't in the compass set renders no icon rather than its raw text.
        let icon: React.ReactNode = product.switcherIcon;
        if (typeof product.switcherIcon === 'string') {
            const Icon = glyphMap[product.switcherIcon as IconGlyphTypes];
            icon = Icon ? <Icon size={20}/> : null;
        }

        return (
            <ProductRailItem
                key={product.id}
                id={`product-rail-item-${product.pluginId || product.id}`}
                to={link}
                icon={icon}
                label={product.switcherText}
                active={currentProduct?.id === product.id}
            />
        );
    });

    return (
        <nav
            className='ProductRail'
            aria-label={formatMessage(messages.ariaLabel)}
        >
            <ProductRailItem
                id='product-rail-item-channels'
                to={`/${currentTeam.name}`}
                icon={<ProductChannelsIcon size={20}/>}
                label={formatMessage(messages.channels)}
                active={!currentProduct && !inThreads}
                mentions={mentionsInTeamMap.get(currentTeam.id) ?? 0}
                hasUrgent={teamHasUrgentMap.get(currentTeam.id) ?? false}
                unread={unreadTeamsSet.has(currentTeam.id)}
            />
            {threadsEnabled && (
                <ProductRailItem
                    id='product-rail-item-threads'
                    to={`/${currentTeam.name}/threads`}
                    icon={<MessageTextOutlineIcon size={20}/>}
                    label={formatMessage(messages.threads)}
                    active={inThreads}
                    mentions={threadCounts?.total_unread_mentions ?? 0}
                    hasUrgent={Boolean(threadCounts?.total_unread_urgent_mentions)}
                    unread={Boolean(threadCounts?.total_unread_threads)}
                />
            )}
            {productItems.some(Boolean) && <div className='ProductRail__divider'/>}
            {productItems}
        </nav>
    );
}

type ProductRailItemProps = {
    id: string;
    to: string;
    icon: React.ReactNode;
    label: React.ReactNode;
    active: boolean;
    mentions?: number;
    hasUrgent?: boolean;
    unread?: boolean;
};

function ProductRailItem({id, to, icon, label, active, mentions = 0, hasUrgent = false, unread = false}: ProductRailItemProps) {
    let indicator = null;
    if (mentions > 0) {
        const mentionCount = mentions > 99 ? '99+' : String(mentions);
        indicator = (
            <span className={classNames('ProductRail__badge', {'ProductRail__badge--urgent': hasUrgent})}>
                {mentionCount}
            </span>
        );
    } else if (unread) {
        indicator = <span className='ProductRail__dot'/>;
    }

    return (
        <Link
            id={id}
            to={to}
            className={classNames('ProductRail__item', {
                'ProductRail__item--active': active,
                'ProductRail__item--unread': unread || mentions > 0,
            })}
            aria-current={active ? 'page' : undefined}
            draggable={false}
        >
            <span className='ProductRail__icon'>
                {icon}
                {indicator}
            </span>
            <span className='ProductRail__label'>{label}</span>
        </Link>
    );
}
