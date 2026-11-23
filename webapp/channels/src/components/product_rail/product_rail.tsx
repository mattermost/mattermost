// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DragDropContext, Draggable, Droppable} from '@hello-pangea/dnd';
import type {DropResult} from '@hello-pangea/dnd';
import classNames from 'classnames';
import React, {forwardRef, useEffect, useRef, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {Link, matchPath, useHistory, useLocation} from 'react-router-dom';

import glyphMap, {DockLeftIcon, DotsHorizontalIcon, PinOutlineIcon, ProductBoardsIcon, ProductChannelsIcon} from '@mattermost/compass-icons/components';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';
import {Icon} from '@mattermost/compass-ui/components/icon';
import {IconButton} from '@mattermost/compass-ui/components/icon-button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {selectTeam} from 'mattermost-redux/actions/teams';
import {getCurrentChannel, getRedirectChannelNameForTeam} from 'mattermost-redux/selectors/entities/channels';
import {isProductRailEnabled} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeam, getMyTeams} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {productRailPathsLoaded, productRailPathViewed, setProductRailItemHidden, setProductRailOrder, setProductRailSection, setTeamSidebarHidden} from 'actions/views/product_rail';
import {selectProducts} from 'selectors/products';
import {
    getBoardChannelIds,
    getFirstBoardInCurrentTeam,
    getProductRailHiddenItems,
    getProductRailItemOrder,
    getProductRailLastPath,
    getProductRailLastPaths,
    getProductRailSection,
    getProductRailSectionUnreads,
    getProductRailTeamIdToRestore,
    areBoardsShownInChannels,
    areProductRailLastPathsLoaded,
    isTeamSidebarHidden,
} from 'selectors/views/product_rail';

import * as Menu from 'components/menu';
import type {MenuButtonComponentProps} from 'components/menu';

import Pluggable from 'plugins/pluggable';
import {isBackstagePath, TEAM_NAME_PATH_PATTERN} from 'utils/path';
import {getProductSwitcherLinkURL, useCurrentProduct} from 'utils/products';

import type {GlobalState} from 'types/store';
import type {ProductComponent} from 'types/store/plugins';
import type {ProductRailSection, ProductRailTab} from 'types/store/views';

import ProductRailTeamMenu from './product_rail_team_menu';

import './product_rail.scss';

const messages = defineMessages({
    ariaLabel: {
        id: 'product_rail.ariaLabel',
        defaultMessage: 'Product navigation',
        description: 'Accessible name for the vertical navigation rail beside the team sidebar that switches between Channels and products such as Boards and Playbooks.',
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
    more: {
        id: 'product_rail.more',
        defaultMessage: 'More',
        description: 'Label under the three-dots item at the end of the product navigation rail. It opens a menu of the products the user unpinned from the rail.',
    },
    moreMenuLabel: {
        id: 'product_rail.moreMenu.label',
        defaultMessage: 'More products',
        description: 'Accessible name of the menu opened from the More item of the product navigation rail, listing the products the user unpinned from the rail.',
    },
    moreLabelWithMentions: {
        id: 'product_rail.moreMenu.labelWithMentions',
        defaultMessage: 'More products, {count, plural, one {# mention} other {# mentions}}',
        description: 'Accessible name of the More item at the end of the product navigation rail when its unpinned products have mentions. {count} is their total, shown in a badge on it.',
    },
    moreLabelWithUnreads: {
        id: 'product_rail.moreMenu.labelWithUnreads',
        defaultMessage: 'More products, unread activity',
        description: 'Accessible name of the More item at the end of the product navigation rail when its unpinned products have unread activity but no mentions, shown as a dot on it.',
    },
    itemMenuLabel: {
        id: 'product_rail.itemMenu.label',
        defaultMessage: 'Product options',
        description: 'Accessible name of the menu opened by right-clicking a product, such as Boards or Playbooks, in the product navigation rail.',
    },
    unpin: {
        id: 'product_rail.itemMenu.unpin',
        defaultMessage: 'Unpin',
        description: 'Item in the right-click menu of a product, such as Boards or Playbooks, in the product navigation rail. It takes the product off the rail and into the More menu at the end of it.',
    },
    pin: {
        id: 'product_rail.itemMenu.pin',
        defaultMessage: 'Pin',
        description: 'Item in the right-click menu of an unpinned product, shown in the product navigation rail only while it is open. It pins the product back on the rail, out of the More menu.',
    },
    showTeamSidebar: {
        id: 'product_rail.showTeamSidebar',
        defaultMessage: 'Show team sidebar',
        description: 'Tooltip and accessible name of the button at the bottom of the product navigation rail, shown while the team sidebar is hidden. It brings the team sidebar back.',
    },
    pinProduct: {
        id: 'product_rail.moreMenu.pin',
        defaultMessage: 'Pin {name}',
        description: 'Accessible name of the pin button at the end of a row in the More menu of the product navigation rail. {name} is the product, such as Playbooks. It pins the product back on the rail.',
    },
});

const channelRoutePath = `/:team(${TEAM_NAME_PATH_PATTERN})/:path(channels|messages)/:identifier`;
const threadsRoutePath = `/:team(${TEAM_NAME_PATH_PATTERN})/threads`;

const productTab = (product: ProductComponent): ProductRailTab => `product:${product.id}`;

// Channels and Boards never return to Threads (see where paths are recorded), but a build that did
// may have saved a Threads path for them; that's set aside.
const leavingThreads = (path: string | undefined) => (path && matchPath(path, {path: threadsRoutePath}) ? undefined : path);

// The products that follow Channels and Boards in the rail, in this order, by plugin id.
// Any other product a plugin registers comes right after them, in the order it registered.
const DEFAULT_PRODUCT_PLUGIN_IDS = ['mattermost-ai', 'playbooks'];
const defaultProductRank = (product: ProductComponent) => {
    const rank = DEFAULT_PRODUCT_PLUGIN_IDS.indexOf(product.pluginId || product.id);
    return rank === -1 ? DEFAULT_PRODUCT_PLUGIN_IDS.length : rank;
};

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
// registers with registerChannelKind) in Boards, everything else in Channels, where Threads is too
// (from the channel sidebar). Each registered product (Playbooks, ...) brings its own LHS.
export default function ProductRail() {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const {pathname} = useLocation();

    const enabled = useSelector(isProductRailEnabled);
    const products = useSelector(selectProducts);
    const currentTeam = useSelector(getCurrentTeam);

    // The team sidebar only shows for more than one team, so only then can it be brought back.
    const hasSeveralTeams = useSelector((state: GlobalState) => getMyTeams(state).length > 1);
    const currentUserId = useSelector(getCurrentUserId);
    const currentChannel = useSelector(getCurrentChannel);
    const currentChannelId = currentChannel?.id ?? '';
    const currentProduct = useCurrentProduct();

    // Set while a plugin registers boards, which splits Channels from Boards.
    const section = useSelector(getProductRailSection);
    const sectionUnreads = useSelector(getProductRailSectionUnreads);
    const currentChannelIsBoard = useSelector((state: GlobalState) => getBoardChannelIds(state).has(currentChannelId));
    const firstBoard = useSelector(getFirstBoardInCurrentTeam);
    const teamSidebarHidden = useSelector(isTeamSidebarHidden);
    const boardsShownInChannels = useSelector(areBoardsShownInChannels);
    const hiddenItems = useSelector(getProductRailHiddenItems);
    const itemOrder = useSelector(getProductRailItemOrder);
    const history = useHistory();

    const currentTeamId = currentTeam?.id ?? '';
    const lastPaths = useSelector(getProductRailLastPaths);
    const lastPathsLoaded = useSelector(areProductRailLastPathsLoaded);
    const lastChannelPath = leavingThreads(useSelector((state: GlobalState) => getProductRailLastPath(state, 'channels', currentTeamId)));
    const lastBoardPath = leavingThreads(useSelector((state: GlobalState) => getProductRailLastPath(state, 'boards', currentTeamId)));
    const defaultChannelName = useSelector((state: GlobalState) => (currentTeamId ? getRedirectChannelNameForTeam(state, currentTeamId) : ''));

    const channelMatch = matchPath<{team: string; path: string; identifier: string}>(pathname, {path: channelRoutePath});
    const inThreads = matchPath(pathname, {path: threadsRoutePath}) !== null;
    const urlChannelPath = channelMatch ? `/${channelMatch.params.team}/${channelMatch.params.path}/${channelMatch.params.identifier}` : null;

    // The rail item the user is under now, and the path to return them to. A channel is recorded
    // only once the open channel matches the URL: while switching, the URL moves first, and the
    // old channel's kind would file the new path under the wrong item. Its path drops any
    // permalinked post, so returning opens the channel rather than re-highlighting a post.
    let viewedTab: ProductRailTab | null = null;
    let viewedPath = pathname;
    let boardViewedInChannels = false;
    if (channelMatch && currentChannel) {
        const {team, path, identifier} = channelMatch.params;
        const isDirect = currentChannel.type === 'D' || currentChannel.type === 'G';
        const urlMatchesChannel = path === 'messages' ? isDirect : identifier === currentChannel.name;
        if (urlMatchesChannel) {
            // A board opened in Channels while it lists boards too stays under Channels.
            boardViewedInChannels = section === 'channels' && boardsShownInChannels && currentChannelIsBoard;
            viewedTab = section && currentChannelIsBoard && !boardViewedInChannels ? 'boards' : 'channels';
            viewedPath = `/${team}/${path}/${identifier}`;
        }
    } else if (inThreads) {
        // Threads is part of the channels product, and both Channels and Boards list it in their
        // sidebar: it stays under whichever the user opened it from (see the effect below).
        viewedTab = section ?? 'channels';
    } else if (currentProduct) {
        viewedTab = productTab(currentProduct);
    }

    // A global product's page names no team, so loading one leaves none selected; pick the user's
    // last, so the rail, the team sidebar and the team menu all have one.
    const teamIdToRestore = useSelector(getProductRailTeamIdToRestore);
    useEffect(() => {
        if (enabled && currentProduct && teamIdToRestore) {
            dispatch(selectTeam(teamIdToRestore));
        }
    }, [dispatch, enabled, currentProduct, teamIdToRestore]);

    // Bring back where each item was in earlier sessions.
    useEffect(() => {
        if (enabled && currentUserId) {
            dispatch(productRailPathsLoaded(readSavedLastPaths(currentUserId)));
        }
    }, [dispatch, enabled, currentUserId]);

    // Remember where the user is under the current item, however they got there (the rail, the
    // sidebar, a link, the channel switcher). A channel or board also moves the sidebar to its
    // section. Turning Show boards on or off only changes what Channels lists: it doesn't move the
    // user, even when the open channel is a board.
    const lastBoardsShownInChannels = useRef(boardsShownInChannels);

    // Boards with no board to open, clicked from outside the channels product, lands in the channel
    // Channels would open, to show the empty Boards sidebar. Opening that channel mustn't move the
    // sidebar back to Channels, as opening a channel otherwise does.
    const keepBoardsSectionAt = useRef<string | null>(null);

    // The team's boards may not be known yet on landing there (they load with the channels, and a
    // product page loaded directly doesn't have them). Once they are, open the first one instead.
    const awaitingBoardAt = useRef<string | null>(null);

    // A rail item to focus once it's back on the rail, after it was pinned from the last row of More.
    const focusAfterPin = useRef<string | null>(null);
    useEffect(() => {
        const element = focusAfterPin.current ? document.getElementById(focusAfterPin.current) : null;
        if (element) {
            focusAfterPin.current = null;
            element.focus();
        }
    });
    useEffect(() => {
        const boardsShownChanged = lastBoardsShownInChannels.current !== boardsShownInChannels;
        lastBoardsShownInChannels.current = boardsShownInChannels;
        if (boardsShownChanged) {
            return;
        }

        // Threads keeps the item it was opened from active, but isn't where that item returns: from
        // Threads, Channels and Boards always lead out of it, to a channel or board. (Leading back to
        // Threads would make them look stuck there.)
        if (enabled && viewedTab && currentTeamId && !inThreads) {
            const keepBoards = viewedTab === 'channels' && keepBoardsSectionAt.current === viewedPath;
            if (viewedTab === 'channels' || viewedTab === 'boards') {
                keepBoardsSectionAt.current = null;
            }

            // A channel or board moves the sidebar to its section.
            const followsKind = (viewedTab === 'boards' || viewedTab === 'channels') && !boardViewedInChannels && !keepBoards;
            dispatch(productRailPathViewed(viewedTab, currentTeamId, viewedPath, section && followsKind ? viewedTab as ProductRailSection : undefined));
        }
    }, [dispatch, enabled, viewedTab, currentTeamId, viewedPath, section !== null, boardViewedInChannels, boardsShownInChannels, inThreads]);

    useEffect(() => {
        const awaitedPath = awaitingBoardAt.current;
        if (!awaitedPath) {
            return;
        }

        // While the channel loads (the URL is there before the open channel catches up), keep
        // waiting; leaving for a page outside the rail's items, such as Integrations, stops it.
        if (!viewedTab) {
            if (urlChannelPath !== awaitedPath) {
                awaitingBoardAt.current = null;
                keepBoardsSectionAt.current = null;
            }
            return;
        }

        // Leaving the channel, or the Boards sidebar, stops waiting, and a later visit to that channel
        // is an ordinary one, which moves the sidebar to Channels.
        if (viewedPath !== awaitedPath || section !== 'boards' || currentChannelIsBoard) {
            awaitingBoardAt.current = null;
            keepBoardsSectionAt.current = null;
            return;
        }

        if (firstBoard && currentTeam) {
            awaitingBoardAt.current = null;
            history.replace(`/${currentTeam.name}/channels/${firstBoard.name}`);
        }
    }, [viewedTab, viewedPath, urlChannelPath, section, currentChannelIsBoard, firstBoard, currentTeam, history]);

    // Saved only once the earlier paths are restored, so they're never overwritten unseen.
    useEffect(() => {
        if (enabled && currentUserId && lastPathsLoaded) {
            saveLastPaths(currentUserId, lastPaths);
        }
    }, [enabled, currentUserId, lastPaths, lastPathsLoaded]);

    // Backstage pages (Integrations, Custom Emoji) take the whole page, with their own way back.
    if (!enabled || !currentTeam || isBackstagePath(pathname)) {
        return null;
    }

    const inChannelsProduct = !currentProduct;

    const productEntry = (product: ProductComponent): RailEntry | null => {
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

        // The order and pinned preferences name a product by its plugin and base URL: its id changes
        // with every page load, and this stays the same as the plugin's other products come and go.
        // A bare plugin id, as earlier builds saved, still names all of that plugin's products.
        const pluginId = product.pluginId || product.id;
        const itemId = `${pluginId}:${product.baseURL}`;
        return {
            itemId,
            aliases: [pluginId],
            elementId: `product-rail-item-${productsPerPlugin.get(pluginId)! > 1 ? itemId : pluginId}`,
            to: lastPaths[productTab(product)]?.[currentTeam.id] ?? link,
            icon,
            label: product.switcherText,
            active: currentProduct?.id === product.id,
            hideable: true,
        };
    };

    // How many products each plugin has, so a plugin's only product keeps its plugin id in the DOM.
    const productsPerPlugin = new Map<string, number>();
    for (const product of products) {
        const pluginId = product.pluginId || product.id;
        productsPerPlugin.set(pluginId, (productsPerPlugin.get(pluginId) ?? 0) + 1);
    }

    // A stable sort, so products with no rank keep their registration order after the ranked ones.
    const sortedProducts = [...products].sort((a, b) => defaultProductRank(a) - defaultProductRank(b));

    const entries: RailEntry[] = [];

    // With boards split off, Channels shows the rest of the sidebar; without, it's all of it.
    if (section) {
        // While Channels lists boards too, its badge counts them as well.
        const channelsUnreads = boardsShownInChannels ? {
            mentions: sectionUnreads.channels.mentions + sectionUnreads.boards.mentions,
            hasUrgent: sectionUnreads.channels.hasUrgent || sectionUnreads.boards.hasUrgent,
            unread: sectionUnreads.channels.unread || sectionUnreads.boards.unread,
        } : sectionUnreads.channels;
        const channelsPath = lastChannelPath ?? `/${currentTeam.name}/channels/${defaultChannelName}`;

        // Return to the last board, else open the first one. With none to open, Boards still
        // switches the sidebar so it can say there are none: in place in the channels product,
        // and from anywhere else in the channel Channels would open.
        let boardsPath = lastBoardPath;
        if (!boardsPath && firstBoard) {
            boardsPath = `/${currentTeam.name}/channels/${firstBoard.name}`;
        }
        const opensChannelForNoBoards = !boardsPath && !inChannelsProduct;
        if (!boardsPath) {
            boardsPath = inChannelsProduct ? pathname : channelsPath;
        }
        const boardsTo = boardsPath;

        entries.push({
            itemId: 'channels',
            elementId: 'product-rail-item-channels',
            to: channelsPath,
            onClick: () => dispatch(setProductRailSection('channels')),
            icon: <ProductChannelsIcon size={20}/>,
            label: formatMessage(messages.channels),
            active: inChannelsProduct && section === 'channels',
            ...channelsUnreads,
        });
        entries.push({
            itemId: 'boards',
            elementId: 'product-rail-item-boards',
            to: boardsTo,
            onClick: () => {
                keepBoardsSectionAt.current = opensChannelForNoBoards ? boardsTo : null;
                awaitingBoardAt.current = opensChannelForNoBoards ? boardsTo : null;
                dispatch(setProductRailSection('boards'));
            },
            icon: <ProductBoardsIcon size={20}/>,
            label: formatMessage(messages.boards),
            active: inChannelsProduct && section === 'boards',
            hideable: true,
            ...sectionUnreads.boards,
        });
    } else {
        entries.push({
            itemId: 'channels',
            elementId: 'product-rail-item-channels',

            // Not the team's root, which can redirect to Threads if that's where the user last was in
            // the team, making Channels lead back into Threads.
            to: lastChannelPath ?? `/${currentTeam.name}/channels/${defaultChannelName}`,
            icon: <ProductChannelsIcon size={20}/>,
            label: formatMessage(messages.channels),
            active: inChannelsProduct,

            // With no boards split off, the channels section counts everything, direct and group messages included.
            ...sectionUnreads.channels,
        });
    }

    for (const product of sortedProducts) {
        const entry = productEntry(product);
        if (entry) {
            entries.push(entry);
        }
    }

    // A bare plugin id names all of the plugin's products, so changing one's pinned state needs the others'.
    for (const entry of entries) {
        if (entry.aliases?.length) {
            entry.aliasPeers = entries.filter((other) => other !== entry && other.aliases?.some((alias) => entry.aliases!.includes(alias))).map((other) => other.itemId);
        }
    }

    // The user's order goes first; items it doesn't name yet (a newly installed product, say)
    // follow in their default order.
    const orderIndex = new Map(itemOrder.map((itemId, index) => [itemId, index]));
    const orderedEntries = entries.
        map((entry, defaultIndex) => ({entry, rank: [entry.itemId, ...entry.aliases ?? []].map((id) => orderIndex.get(id)).find((index) => index !== undefined) ?? itemOrder.length + defaultIndex})).
        sort((a, b) => a.rank - b.rank).
        map(({entry}) => entry);

    // Boards and products can be unpinned; an unpinned one stays in the rail while it's open, so the
    // user can see where they are, and is otherwise listed in the More menu at the end.
    const hiddenItemIds = new Set(hiddenItems);
    const isUnpinned = (entry: RailEntry) => [entry.itemId, ...entry.aliases ?? []].some((id) => hiddenItemIds.has(id));
    const isInMore = (entry: RailEntry) => entry.hideable === true && isUnpinned(entry) && !entry.active;
    const railItems = orderedEntries.filter((entry) => !isInMore(entry));
    const moreItems = orderedEntries.filter(isInMore);

    // The More button's badge, or dot, is read out with its name.
    const moreMentions = moreItems.reduce((total, entry) => total + (entry.mentions ?? 0), 0);
    const moreUnread = moreItems.some((entry) => entry.unread);
    let moreButtonLabel = formatMessage(messages.moreMenuLabel);
    if (moreMentions > 0) {
        moreButtonLabel = formatMessage(messages.moreLabelWithMentions, {count: moreMentions});
    } else if (moreUnread) {
        moreButtonLabel = formatMessage(messages.moreLabelWithUnreads);
    }

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) {
            return;
        }

        // The order can change mid-drag (a failed save puts the last one back), leaving another item
        // where the dragged one started; drop the move then, rather than move the wrong item.
        const railIds = railItems.map((entry) => entry.itemId);
        if (railIds[result.source.index] !== result.draggableId) {
            return;
        }
        const order = moveRailItem(
            orderedEntries.map((entry) => entry.itemId),
            railIds,
            result.source.index,
            result.destination.index,
        );
        if (order) {
            dispatch(setProductRailOrder(order));
        }
    };

    return (
        <nav
            className='ProductRail'
            aria-label={formatMessage(messages.ariaLabel)}
        >
            <div className='ProductRail__scroll'>
                {teamSidebarHidden && <ProductRailTeamMenu/>}
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId='product-rail'>
                        {(droppableProvided) => (
                            <div
                                ref={droppableProvided.innerRef}
                                className='ProductRail__items'
                                {...droppableProvided.droppableProps}
                            >
                                {railItems.map((entry, index) => (
                                    <RailItemContainer
                                        key={entry.itemId}
                                        entry={entry}
                                        index={index}
                                        hidden={isUnpinned(entry)}
                                    />
                                ))}
                                {droppableProvided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
                {moreItems.length > 0 && (
                    <Menu.Container
                        menuButton={{
                            id: 'product-rail-item-more',
                            class: 'ProductRail__item',
                            'aria-label': moreButtonLabel,
                            children: (
                                <>
                                    <span className='ProductRail__icon'>
                                        <DotsHorizontalIcon size={20}/>
                                        {renderIndicator(moreMentions, moreItems.some((entry) => entry.hasUrgent), moreUnread)}
                                    </span>
                                    <span className='ProductRail__label'>{formatMessage(messages.more)}</span>
                                </>
                            ),
                        }}
                        menu={{
                            id: 'productRailMoreMenu',
                            className: 'ProductRail__moreMenu',
                            width: '248px',
                            'aria-label': formatMessage(messages.moreMenuLabel),

                            // Right Arrow on a row moves to its pin button.
                            onKeyDown: (event) => {
                                const row = event.target as HTMLElement;
                                const pinButton = row.getAttribute('role') === 'menuitem' ? row.querySelector<HTMLElement>('.ProductRail__pinButton') : null;
                                if (event.key === 'ArrowRight' && pinButton) {
                                    event.preventDefault();
                                    pinButton.focus();
                                }
                            },
                        }}
                        anchorOrigin={{vertical: 'top', horizontal: 'right'}}
                        transformOrigin={{vertical: 'top', horizontal: 'left'}}
                    >
                        {moreItems.map((entry) => (
                            <Menu.Item
                                key={entry.itemId}
                                id={`productRailMoreMenu-${entry.itemId}`}
                                leadingElement={<span className='ProductRail__menuIcon'>{entry.icon}</span>}
                                labels={<span>{entry.label}</span>}
                                trailingElements={(
                                    <>
                                        {renderMenuIndicator(entry)}
                                        <IconButton
                                            size='x-small'
                                            className='ProductRail__pinButton'
                                            icon={<Icon glyph={<PinOutlineIcon/>}/>}
                                            aria-label={typeof entry.label === 'string' ? formatMessage(messages.pinProduct, {name: entry.label}) : formatMessage(messages.pin)}
                                            onClick={(event) => {
                                            // Pins without opening the product, and leaves the menu open.
                                                event.stopPropagation();

                                                // The row goes once pinned, so keyboard focus moves to a neighbour, or,
                                                // pinning the last one (when More goes too), to the item on the rail.
                                                const row = event.currentTarget.closest<HTMLElement>('[role="menuitem"]');
                                                if (row?.contains(document.activeElement)) {
                                                    const neighbour = (row.nextElementSibling ?? row.previousElementSibling) as HTMLElement | null;
                                                    if (neighbour) {
                                                        neighbour.focus();
                                                    } else {
                                                        focusAfterPin.current = entry.elementId;
                                                    }
                                                }
                                                dispatch(setProductRailItemHidden(entry.itemId, false, entry.aliases, entry.aliasPeers));
                                            }}
                                            onKeyDown={(event) => {
                                                const row = event.currentTarget.closest<HTMLElement>('[role="menuitem"]');
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                // The button's own click pins; the row mustn't open the product too.
                                                    event.stopPropagation();
                                                } else if (event.key === 'ArrowLeft') {
                                                    event.preventDefault();
                                                    row?.focus();
                                                } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                                                // Back on the row, the menu moves on from it as usual.
                                                    row?.focus();
                                                }
                                            }}
                                            onKeyUp={(event) => {
                                                if (event.key === ' ') {
                                                    event.stopPropagation();
                                                }
                                            }}
                                        />
                                    </>
                                )}
                                onClick={() => {
                                    entry.onClick?.();
                                    history.push(entry.to);
                                }}
                            />
                        ))}
                    </Menu.Container>
                )}
            </div>
            {teamSidebarHidden && (
                <div className='ProductRail__bottom'>
                    {/* With the team sidebar hidden, its plugins' icons move here, as there only in Channels. */}
                    {!currentProduct && (
                        <div className='ProductRail__plugins'>
                            <Pluggable pluggableName='BottomTeamSidebar'/>
                        </div>
                    )}
                    {hasSeveralTeams && <WithTooltip title={formatMessage(messages.showTeamSidebar)}>
                        <button
                            type='button'
                            className='ProductRail__showTeamSidebar'
                            aria-label={formatMessage(messages.showTeamSidebar)}
                            onClick={() => dispatch(setTeamSidebarHidden(false))}
                        >
                            <DockLeftIcon size={20}/>
                        </button>
                    </WithTooltip>}
                </div>
            )}
        </nav>
    );
}

// An item in the rail: Channels, Boards, or a product.
type RailEntry = {

    // What the user's order and hidden items preferences name it by: 'channels', 'boards', or a
    // product's plugin id and base URL.
    itemId: string;

    // Other names the preferences may use for it: a product's bare plugin id, from earlier builds,
    // which also names the plugin's other products (aliasPeers).
    aliases?: string[];
    aliasPeers?: string[];
    elementId: string;
    to: string;
    onClick?: () => void;
    icon: React.ReactNode;
    label: React.ReactNode;
    active: boolean;

    // Boards and products can be unpinned into the More menu; Channels always shows.
    hideable?: boolean;
    mentions?: number;
    hasUrgent?: boolean;
    unread?: boolean;
};

// The right-click menu has no button of its own: it opens on the item, from this stand-in.
const ItemMenuAnchor = forwardRef<HTMLButtonElement, MenuButtonComponentProps>((_props, ref) => (
    <span
        ref={ref as unknown as React.Ref<HTMLSpanElement>}
        className='ProductRail__itemMenuAnchor'
        aria-hidden='true'
    />
));
ItemMenuAnchor.displayName = 'ItemMenuAnchor';

type RailItemContainerProps = {
    entry: RailEntry;
    index: number;
    hidden: boolean;
};

// A rail item the user can drag to reorder. Boards and products also have a right-click (or
// context menu key) menu to unpin them into the More menu, or to pin an unpinned one shown while
// it's open back on the rail.
function RailItemContainer({entry, index, hidden}: RailItemContainerProps) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [open, setOpen] = useState(false);
    const {itemId} = entry;

    return (
        <Draggable
            draggableId={itemId}
            index={index}
        >
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    aria-describedby={undefined}

                    // The link inside takes keyboard focus.
                    tabIndex={-1}
                    role={undefined}
                    className={classNames('ProductRail__itemWrapper', {'ProductRail__itemWrapper--dragging': snapshot.isDragging})}
                    onContextMenu={entry.hideable ? (event) => {
                        event.preventDefault();
                        setOpen(true);
                    } : undefined}
                >
                    <ProductRailItem
                        id={entry.elementId}
                        to={entry.to}

                        // The link takes focus, so it carries the drag handle's instructions.
                        describedBy={provided.dragHandleProps?.['aria-describedby']}
                        onClick={entry.onClick}
                        icon={entry.icon}
                        label={entry.label}
                        active={entry.active}
                        mentions={entry.mentions}
                        hasUrgent={entry.hasUrgent}
                        unread={entry.unread}
                    />
                    {entry.hideable && (
                        <Menu.Container
                            menuButton={{
                                id: `product-rail-item-menu-anchor-${itemId}`,
                                as: ItemMenuAnchor,
                            }}
                            menu={{
                                id: `productRailItemMenu-${itemId}`,
                                'aria-label': formatMessage(messages.itemMenuLabel),
                                isMenuOpen: open,
                                onToggle: (isOpen) => {
                                    if (!isOpen) {
                                        setOpen(false);
                                    }
                                },
                            }}
                            anchorOrigin={{vertical: 'top', horizontal: 'right'}}
                            transformOrigin={{vertical: 'top', horizontal: 'left'}}
                        >
                            <Menu.Item
                                id={`productRailItemMenu-${itemId}-${hidden ? 'pin' : 'unpin'}`}
                                leadingElement={<PinOutlineIcon size={18}/>}
                                labels={<span>{formatMessage(hidden ? messages.pin : messages.unpin)}</span>}
                                onClick={() => dispatch(setProductRailItemHidden(itemId, !hidden, entry.aliases, entry.aliasPeers))}
                            />
                        </Menu.Container>
                    )}
                </div>
            )}
        </Draggable>
    );
}

/**
 * The rail's full order after dragging the item at fromIndex among those on the rail (railIds) to
 * toIndex, or null if it doesn't move. Items in the More menu, which orderedIds includes but the
 * rail doesn't, keep their places relative to the rest.
 */
export function moveRailItem(orderedIds: string[], railIds: string[], fromIndex: number, toIndex: number): string[] | null {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= railIds.length) {
        return null;
    }
    const nextRailIds = [...railIds];
    const [movedId] = nextRailIds.splice(fromIndex, 1);
    nextRailIds.splice(toIndex, 0, movedId);

    const order = orderedIds.filter((itemId) => itemId !== movedId);
    const nextId = nextRailIds[toIndex + 1];
    const insertAt = nextId ? order.indexOf(nextId) : order.indexOf(nextRailIds[toIndex - 1]) + 1;
    order.splice(insertAt, 0, movedId);
    return order;
}

const formatMentionCount = (mentions: number) => (mentions > 99 ? '99+' : String(mentions));

// A mention count badge, or else a dot for unread activity, on a rail item's icon.
function renderIndicator(mentions: number, hasUrgent: boolean, unread: boolean) {
    if (mentions > 0) {
        return (
            <span className={classNames('ProductRail__badge', {'ProductRail__badge--urgent': hasUrgent})}>
                {formatMentionCount(mentions)}
            </span>
        );
    }
    if (unread) {
        return <span className='ProductRail__dot'/>;
    }
    return null;
}

// The same, at the end of a row in the More menu.
function renderMenuIndicator({mentions = 0, hasUrgent = false, unread = false}: RailEntry) {
    if (mentions > 0) {
        return (
            <span className={classNames('ProductRail__menuBadge', {'ProductRail__menuBadge--urgent': hasUrgent})}>
                {formatMentionCount(mentions)}
            </span>
        );
    }
    if (unread) {
        return <span className='ProductRail__menuDot'/>;
    }
    return undefined;
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

    // An element describing the item further, such as how to drag it.
    describedBy?: string;
};

function ProductRailItem({id, to, onClick, icon, label, active, mentions = 0, hasUrgent = false, unread = false, describedBy}: ProductRailItemProps) {
    // The item's side effects (such as switching the sidebar's section) are for following the link
    // here, not for opening it elsewhere with a modifier key or another button.
    const handleLinkClick = onClick && ((event: React.MouseEvent<HTMLAnchorElement>) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }
        onClick();
    });

    const indicator = renderIndicator(mentions, hasUrgent, unread);

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
            onClick={handleLinkClick}
            className={className}
            aria-current={active ? 'page' : undefined}
            aria-describedby={describedBy}
            draggable={false}
        >
            {content}
        </Link>
    );
}
