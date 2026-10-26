// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {Link, matchPath, useLocation} from 'react-router-dom';

import glyphMap, {FileTextOutlineIcon, HomeVariantOutlineIcon, MessageTextOutlineIcon, ProductBoardsIcon, ProductChannelsIcon} from '@mattermost/compass-icons/components';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';

import {getThreadCounts} from 'mattermost-redux/actions/threads';
import {getCurrentChannel, getRedirectChannelNameForTeam, getTeamsUnreadStatuses} from 'mattermost-redux/selectors/entities/channels';
import {isProductRailEnabled} from 'mattermost-redux/selectors/entities/general';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getThreadCountsInCurrentTeam} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {productRailPathsLoaded, productRailPathViewed, setProductRailSection} from 'actions/views/product_rail';
import {selectProducts} from 'selectors/products';
import {
    getBoardChannelIds,
    getFirstBoardInCurrentTeam,
    getProductRailLastPath,
    getProductRailLastPaths,
    getProductRailSection,
    getProductRailSectionUnreads,
    areProductRailLastPathsLoaded,
    isTeamSidebarHidden,
} from 'selectors/views/product_rail';

import {TEAM_NAME_PATH_PATTERN} from 'utils/path';
import {getProductSwitcherLinkURL, useCurrentProduct} from 'utils/products';

import type {GlobalState} from 'types/store';
import type {ProductComponent} from 'types/store/plugins';
import type {ProductRailTab} from 'types/store/views';

import ProductRailTeamMenu from './product_rail_team_menu';

import './product_rail.scss';

const messages = defineMessages({
    ariaLabel: {
        id: 'product_rail.ariaLabel',
        defaultMessage: 'Product navigation',
        description: 'Accessible name for the vertical navigation rail beside the team sidebar that switches between Channels, Threads and products such as Playbooks and Boards.',
    },
    home: {
        id: 'product_rail.home',
        defaultMessage: 'Home',
        description: 'Label under the Home icon in the product navigation rail. Clicking it shows the full left sidebar, with channels and boards together.',
    },
    channels: {
        id: 'product_rail.channels',
        defaultMessage: 'Channels',
        description: 'Label under the Channels icon in the product navigation rail. Clicking it shows only channels and direct messages in the left sidebar, leaving out boards.',
    },
    boards: {
        id: 'product_rail.boards',
        defaultMessage: 'Boards',
        description: 'Label under the Boards icon in the product navigation rail. Clicking it shows only boards in the left sidebar.',
    },
    docs: {
        id: 'product_rail.docs',
        defaultMessage: 'Docs',
        description: 'Label under the Docs icon in the product navigation rail. A placeholder for now: clicking it does nothing yet.',
    },
    threads: {
        id: 'product_rail.threads',
        defaultMessage: 'Threads',
        description: 'Label under the Threads icon in the product navigation rail. Clicking it opens the list of followed threads.',
    },
});

const channelRoutePath = `/:team(${TEAM_NAME_PATH_PATTERN})/:path(channels|messages)/:identifier`;
const threadsRoutePath = `/:team(${TEAM_NAME_PATH_PATTERN})/threads`;

const productTab = (product: ProductComponent): ProductRailTab => `product:${product.id}`;

// Where each rail item last was, saved per user so it outlasts a reload. Reading and writing are
// best-effort: without storage, the rail just starts from each item's default again.
const lastPathsStorageKey = (userId: string) => `product_rail_last_paths_${userId}`;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

function readSavedLastPaths(userId: string): Record<string, Record<string, string>> {
    try {
        const saved: unknown = JSON.parse(localStorage.getItem(lastPathsStorageKey(userId)) ?? '{}');
        if (!isPlainObject(saved)) {
            return {};
        }

        // Keep only well-formed entries: a tab mapping team ids to path strings.
        const lastPaths: Record<string, Record<string, string>> = {};
        for (const [tab, paths] of Object.entries(saved)) {
            if (isPlainObject(paths)) {
                lastPaths[tab] = Object.fromEntries(Object.entries(paths).filter(([, path]) => typeof path === 'string')) as Record<string, string>;
            }
        }
        return lastPaths;
    } catch {
        return {};
    }
}

function saveLastPaths(userId: string, lastPaths: Record<string, Record<string, string>>) {
    try {
        localStorage.setItem(lastPathsStorageKey(userId), JSON.stringify(lastPaths));
    } catch {
        // Storage is unavailable or full; the paths still last for this session.
    }
}

// The vertical navigation rail shown between the team sidebar and the LHS when the ProductRail
// feature flag is on. Each item swaps what the LHS and center show. Channels and Boards both live
// in the channels product, so they split the channel sidebar in two: boards (channels a plugin
// registers with registerChannelKind) in Boards, everything else in Channels. Threads opens the
// threads view, and each registered product (Playbooks, ...) brings its own LHS.
export default function ProductRail() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const {pathname} = useLocation();

    const enabled = useSelector(isProductRailEnabled);
    const products = useSelector(selectProducts);
    const currentTeam = useSelector(getCurrentTeam);
    const currentUserId = useSelector(getCurrentUserId);
    const currentChannel = useSelector(getCurrentChannel);
    const currentChannelId = currentChannel?.id ?? '';
    const currentProduct = useCurrentProduct();
    const threadsEnabled = useSelector(isCollapsedThreadsEnabled);
    const threadCounts = useSelector(getThreadCountsInCurrentTeam);
    const [unreadTeamsSet, mentionsInTeamMap, teamHasUrgentMap] = useSelector(getTeamsUnreadStatuses);

    // Set while a plugin registers boards, which splits Channels from Boards.
    const section = useSelector(getProductRailSection);
    const sectionUnreads = useSelector(getProductRailSectionUnreads);
    const currentChannelIsBoard = useSelector((state: GlobalState) => getBoardChannelIds(state).has(currentChannelId));
    const firstBoard = useSelector(getFirstBoardInCurrentTeam);
    const teamSidebarHidden = useSelector(isTeamSidebarHidden);

    const currentTeamId = currentTeam?.id ?? '';
    const lastPaths = useSelector(getProductRailLastPaths);
    const lastPathsLoaded = useSelector(areProductRailLastPathsLoaded);
    const lastHomePath = useSelector((state: GlobalState) => getProductRailLastPath(state, 'home', currentTeamId));
    const lastChannelPath = useSelector((state: GlobalState) => getProductRailLastPath(state, 'channels', currentTeamId));
    const lastBoardPath = useSelector((state: GlobalState) => getProductRailLastPath(state, 'boards', currentTeamId));
    const lastThreadsPath = useSelector((state: GlobalState) => getProductRailLastPath(state, 'threads', currentTeamId));
    const defaultChannelName = useSelector((state: GlobalState) => (currentTeamId ? getRedirectChannelNameForTeam(state, currentTeamId) : ''));

    const channelMatch = matchPath<{team: string; path: string; identifier: string}>(pathname, {path: channelRoutePath});
    const inThreads = matchPath(pathname, {path: threadsRoutePath}) !== null;

    // The rail item the user is under now, and the path to return them to. A channel is recorded
    // only once the open channel matches the URL: while switching, the URL moves first, and the
    // old channel's kind would file the new path under the wrong item. Its path drops any
    // permalinked post, so returning opens the channel rather than re-highlighting a post.
    let viewedTab: ProductRailTab | null = null;
    let viewedPath = pathname;
    if (channelMatch && currentChannel) {
        const {team, path, identifier} = channelMatch.params;
        const isDirect = currentChannel.type === 'D' || currentChannel.type === 'G';
        const urlMatchesChannel = path === 'messages' ? isDirect : identifier === currentChannel.name;
        if (urlMatchesChannel) {
            // Home holds channels and boards alike; elsewhere the channel's kind picks the item.
            if (section === 'home') {
                viewedTab = 'home';
            } else {
                viewedTab = section && currentChannelIsBoard ? 'boards' : 'channels';
            }
            viewedPath = `/${team}/${path}/${identifier}`;
        }
    } else if (inThreads) {
        viewedTab = 'threads';
    } else if (currentProduct) {
        viewedTab = productTab(currentProduct);
    }

    // The channel sidebar's Threads link is hidden while the rail is on, so the rail owns
    // loading the counts it used to fetch.
    useEffect(() => {
        if (enabled && threadsEnabled && currentUserId && currentTeamId) {
            dispatch(getThreadCounts(currentUserId, currentTeamId));
        }
    }, [dispatch, enabled, threadsEnabled, currentUserId, currentTeamId]);

    // Bring back where each item was in earlier sessions.
    useEffect(() => {
        if (enabled && currentUserId) {
            dispatch(productRailPathsLoaded(readSavedLastPaths(currentUserId)));
        }
    }, [dispatch, enabled, currentUserId]);

    // Remember where the user is under the current item, however they got there (the rail, the
    // sidebar, a link, the channel switcher). Outside Home, a channel or board also moves the
    // sidebar to its section; Home stays put, since it shows both.
    useEffect(() => {
        if (enabled && viewedTab && currentTeamId) {
            const viewedSection = viewedTab === 'boards' || viewedTab === 'channels' ? viewedTab : undefined;
            dispatch(productRailPathViewed(viewedTab, currentTeamId, viewedPath, section ? viewedSection : undefined));
        }
    }, [dispatch, enabled, viewedTab, currentTeamId, viewedPath, section !== null]);

    // Saved only once the earlier paths are restored, so they're never overwritten unseen.
    useEffect(() => {
        if (enabled && currentUserId && lastPathsLoaded) {
            saveLastPaths(currentUserId, lastPaths);
        }
    }, [enabled, currentUserId, lastPaths, lastPathsLoaded]);

    if (!enabled || !currentTeam) {
        return null;
    }

    const inChannelsProduct = !currentProduct && !inThreads;

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
                to={lastPaths[productTab(product)]?.[currentTeam.id] ?? link}
                icon={icon}
                label={product.switcherText}
                active={currentProduct?.id === product.id}
            />
        );
    });

    const threadsItem = threadsEnabled && (
        <ProductRailItem
            id='product-rail-item-threads'
            to={lastThreadsPath ?? `/${currentTeam.name}/threads`}
            icon={<MessageTextOutlineIcon size={20}/>}
            label={formatMessage(messages.threads)}
            active={inThreads}
            mentions={threadCounts?.total_unread_mentions ?? 0}
            hasUrgent={Boolean(threadCounts?.total_unread_urgent_mentions)}
            unread={Boolean(threadCounts?.total_unread_threads)}
        />
    );

    // A placeholder for Docs while the rail is explored: shown, but not wired to anything yet.
    const docsItem = (
        <ProductRailItem
            id='product-rail-item-docs'
            icon={<FileTextOutlineIcon size={20}/>}
            label={formatMessage(messages.docs)}
            active={false}
        />
    );

    const divider = <div className='ProductRail__divider'/>;

    // Without boards to split off, there's one channel sidebar, and Channels is the whole of it.
    if (!section) {
        return (
            <nav
                className='ProductRail'
                aria-label={formatMessage(messages.ariaLabel)}
            >
                {teamSidebarHidden && (
                    <>
                        <ProductRailTeamMenu/>
                        {divider}
                    </>
                )}
                <ProductRailItem
                    id='product-rail-item-channels'
                    to={lastChannelPath ?? `/${currentTeam.name}`}
                    icon={<ProductChannelsIcon size={20}/>}
                    label={formatMessage(messages.channels)}
                    active={inChannelsProduct}
                    mentions={mentionsInTeamMap.get(currentTeam.id) ?? 0}
                    hasUrgent={teamHasUrgentMap.get(currentTeam.id) ?? false}
                    unread={unreadTeamsSet.has(currentTeam.id)}
                />
                {threadsItem}
                {divider}
                {docsItem}
                {productItems}
            </nav>
        );
    }

    // Return to the last board, else open the first one. With none to open, Boards still
    // switches the sidebar so it can say there are none.
    let boardsPath = lastBoardPath;
    if (!boardsPath && firstBoard) {
        boardsPath = `/${currentTeam.name}/channels/${firstBoard.name}`;
    }

    // Home, the whole sidebar, and Threads lead; then the narrower views, Channels and Boards,
    // and the products.
    return (
        <nav
            className='ProductRail'
            aria-label={formatMessage(messages.ariaLabel)}
        >
            {teamSidebarHidden && (
                <>
                    <ProductRailTeamMenu/>
                    {divider}
                </>
            )}
            <ProductRailItem
                id='product-rail-item-home'
                to={lastHomePath ?? `/${currentTeam.name}`}
                onClick={() => dispatch(setProductRailSection('home'))}
                icon={<HomeVariantOutlineIcon size={20}/>}
                label={formatMessage(messages.home)}
                active={inChannelsProduct && section === 'home'}
                {...sectionUnreads.home}
            />
            {threadsItem}
            {divider}
            <ProductRailItem
                id='product-rail-item-channels'
                to={lastChannelPath ?? `/${currentTeam.name}/channels/${defaultChannelName}`}
                onClick={() => dispatch(setProductRailSection('channels'))}
                icon={<ProductChannelsIcon size={20}/>}
                label={formatMessage(messages.channels)}
                active={inChannelsProduct && section === 'channels'}
                {...sectionUnreads.channels}
            />
            <ProductRailItem
                id='product-rail-item-boards'
                to={boardsPath ?? pathname}
                onClick={() => dispatch(setProductRailSection('boards'))}
                icon={<ProductBoardsIcon size={20}/>}
                label={formatMessage(messages.boards)}
                active={inChannelsProduct && section === 'boards'}
                {...sectionUnreads.boards}
            />
            {docsItem}
            {productItems}
        </nav>
    );
}

type ProductRailItemProps = {
    id: string;

    // Where the item goes; without one it renders as a button that does nothing beyond onClick.
    to?: string;
    onClick?: () => void;
    icon: React.ReactNode;
    label: React.ReactNode;
    active: boolean;
    mentions?: number;
    hasUrgent?: boolean;
    unread?: boolean;
};

function ProductRailItem({id, to, onClick, icon, label, active, mentions = 0, hasUrgent = false, unread = false}: ProductRailItemProps) {
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

    const className = classNames('ProductRail__item', {
        'ProductRail__item--active': active,
        'ProductRail__item--unread': unread || mentions > 0,
    });
    const content = (
        <>
            <span className='ProductRail__icon'>
                {icon}
                {indicator}
            </span>
            <span className='ProductRail__label'>{label}</span>
        </>
    );

    if (!to) {
        return (
            <button
                id={id}
                type='button'
                onClick={onClick}
                className={className}
            >
                {content}
            </button>
        );
    }

    return (
        <Link
            id={id}
            to={to}
            onClick={onClick}
            className={className}
            aria-current={active ? 'page' : undefined}
            draggable={false}
        >
            {content}
        </Link>
    );
}
