// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {forwardRef, useEffect, useRef, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {Link, matchPath, useHistory, useLocation} from 'react-router-dom';

import glyphMap, {DotsHorizontalIcon, EyeOffOutlineIcon, EyeOutlineIcon, MessageTextOutlineIcon, ProductBoardsIcon, ProductChannelsIcon} from '@mattermost/compass-icons/components';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';

import {selectTeam} from 'mattermost-redux/actions/teams';
import {getThreadCounts} from 'mattermost-redux/actions/threads';
import {getCurrentChannel, getRedirectChannelNameForTeam, getTeamsUnreadStatuses} from 'mattermost-redux/selectors/entities/channels';
import {isProductRailEnabled} from 'mattermost-redux/selectors/entities/general';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {getThreadCountsInCurrentTeam} from 'mattermost-redux/selectors/entities/threads';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {productRailPathsLoaded, productRailPathViewed, setProductRailItemHidden, setProductRailSection} from 'actions/views/product_rail';
import {selectProducts} from 'selectors/products';
import {
    getBoardChannelIds,
    getFirstBoardInCurrentTeam,
    getProductRailHiddenItems,
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
        description: 'Accessible name for the vertical navigation rail beside the team sidebar that switches between Channels, Threads and products such as Playbooks and Boards.',
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
    threads: {
        id: 'product_rail.threads',
        defaultMessage: 'Threads',
        description: 'Label under the Threads icon in the product navigation rail. Clicking it opens the list of followed threads.',
    },
    more: {
        id: 'product_rail.more',
        defaultMessage: 'More',
        description: 'Label under the three-dots item at the end of the product navigation rail. It opens a menu of the products the user hid from the rail.',
    },
    moreMenuLabel: {
        id: 'product_rail.moreMenu.label',
        defaultMessage: 'More products',
        description: 'Accessible name of the menu opened from the More item of the product navigation rail, listing the products the user hid from the rail.',
    },
    itemMenuLabel: {
        id: 'product_rail.itemMenu.label',
        defaultMessage: 'Product options',
        description: 'Accessible name of the menu opened by right-clicking a product, such as Boards or Playbooks, in the product navigation rail.',
    },
    hide: {
        id: 'product_rail.itemMenu.hide',
        defaultMessage: 'Hide',
        description: 'Item in the right-click menu of a product in the product navigation rail. It moves the product into the More menu at the end of the rail.',
    },
    alwaysShow: {
        id: 'product_rail.itemMenu.alwaysShow',
        defaultMessage: 'Always show',
        description: 'Item in the right-click menu of a hidden product, shown in the product navigation rail only while it is open. It puts the product back in the rail for good, out of the More menu.',
    },
});

const channelRoutePath = `/:team(${TEAM_NAME_PATH_PATTERN})/:path(channels|messages)/:identifier`;
const threadsRoutePath = `/:team(${TEAM_NAME_PATH_PATTERN})/threads`;

const productTab = (product: ProductComponent): ProductRailTab => `product:${product.id}`;

// The products that follow Threads, Channels and Boards in the rail, in this order, by plugin id.
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
    const boardsShownInChannels = useSelector(areBoardsShownInChannels);
    const hiddenItems = useSelector(getProductRailHiddenItems);
    const history = useHistory();

    const currentTeamId = currentTeam?.id ?? '';
    const lastPaths = useSelector(getProductRailLastPaths);
    const lastPathsLoaded = useSelector(areProductRailLastPathsLoaded);
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
    useEffect(() => {
        const boardsShownChanged = lastBoardsShownInChannels.current !== boardsShownInChannels;
        lastBoardsShownInChannels.current = boardsShownInChannels;
        if (boardsShownChanged) {
            return;
        }

        if (enabled && viewedTab && currentTeamId) {
            const keepBoards = viewedTab === 'channels' && keepBoardsSectionAt.current === viewedPath;
            if (viewedTab === 'channels' || viewedTab === 'boards') {
                keepBoardsSectionAt.current = null;
            }

            const followsKind = (viewedTab === 'boards' || viewedTab === 'channels') && !boardViewedInChannels && !keepBoards;
            dispatch(productRailPathViewed(viewedTab, currentTeamId, viewedPath, section && followsKind ? viewedTab as ProductRailSection : undefined));
        }
    }, [dispatch, enabled, viewedTab, currentTeamId, viewedPath, section !== null, boardViewedInChannels, boardsShownInChannels]);

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

    const inChannelsProduct = !currentProduct && !inThreads;

    // Boards and products can be hidden; a hidden one stays in the rail while it's open, so the
    // user can see where they are, and is otherwise listed in the More menu at the end.
    const hideableItems: RailEntry[] = [];

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

        const itemId = product.pluginId || product.id;
        return {
            itemId,
            elementId: `product-rail-item-${itemId}`,
            to: lastPaths[productTab(product)]?.[currentTeam.id] ?? link,
            icon,
            label: product.switcherText,
            active: currentProduct?.id === product.id,
        };
    };

    // A stable sort, so products with no rank keep their registration order after the ranked ones.
    const sortedProducts = [...products].sort((a, b) => defaultProductRank(a) - defaultProductRank(b));

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

    // With boards split off, Channels shows the rest of the sidebar; without, it's all of it.
    let channelsItem;
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

        channelsItem = (
            <ProductRailItem
                id='product-rail-item-channels'
                to={channelsPath}
                onClick={() => dispatch(setProductRailSection('channels'))}
                icon={<ProductChannelsIcon size={20}/>}
                label={formatMessage(messages.channels)}
                active={inChannelsProduct && section === 'channels'}
                {...channelsUnreads}
            />
        );
        hideableItems.push({
            itemId: 'boards',
            elementId: 'product-rail-item-boards',
            to: boardsTo,
            onClick: () => {
                keepBoardsSectionAt.current = opensChannelForNoBoards ? boardsTo : null;
                dispatch(setProductRailSection('boards'));
            },
            icon: <ProductBoardsIcon size={20}/>,
            label: formatMessage(messages.boards),
            active: inChannelsProduct && section === 'boards',
            ...sectionUnreads.boards,
        });
    } else {
        channelsItem = (
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
        );
    }

    for (const product of sortedProducts) {
        const entry = productEntry(product);
        if (entry) {
            hideableItems.push(entry);
        }
    }

    const hiddenItemIds = new Set(hiddenItems);
    const railItems = hideableItems.filter((entry) => !hiddenItemIds.has(entry.itemId) || entry.active);
    const moreItems = hideableItems.filter((entry) => hiddenItemIds.has(entry.itemId) && !entry.active);

    return (
        <nav
            className='ProductRail'
            aria-label={formatMessage(messages.ariaLabel)}
        >
            {teamSidebarHidden && <ProductRailTeamMenu/>}
            {threadsItem}
            {channelsItem}
            {railItems.map((entry) => (
                <HideableRailItem
                    key={entry.itemId}
                    itemId={entry.itemId}
                    hidden={hiddenItemIds.has(entry.itemId)}
                >
                    <ProductRailItem
                        id={entry.elementId}
                        to={entry.to}
                        onClick={entry.onClick}
                        icon={entry.icon}
                        label={entry.label}
                        active={entry.active}
                        mentions={entry.mentions}
                        hasUrgent={entry.hasUrgent}
                        unread={entry.unread}
                    />
                </HideableRailItem>
            ))}
            {moreItems.length > 0 && (
                <Menu.Container
                    menuButton={{
                        id: 'product-rail-item-more',
                        class: 'ProductRail__item',
                        'aria-label': formatMessage(messages.moreMenuLabel),
                        children: (
                            <>
                                <span className='ProductRail__icon'>
                                    <DotsHorizontalIcon size={20}/>
                                    {renderIndicator(
                                        moreItems.reduce((total, entry) => total + (entry.mentions ?? 0), 0),
                                        moreItems.some((entry) => entry.hasUrgent),
                                        moreItems.some((entry) => entry.unread),
                                    )}
                                </span>
                                <span className='ProductRail__label'>{formatMessage(messages.more)}</span>
                            </>
                        ),
                    }}
                    menu={{
                        id: 'productRailMoreMenu',
                        'aria-label': formatMessage(messages.moreMenuLabel),
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
                            trailingElements={renderMenuIndicator(entry)}
                            onClick={() => {
                                entry.onClick?.();
                                history.push(entry.to);
                            }}
                        />
                    ))}
                </Menu.Container>
            )}
        </nav>
    );
}

// A rail item that can be hidden: Boards, or a product.
type RailEntry = {

    // What the user's hidden items preference names it by: 'boards', or the product's plugin id.
    itemId: string;
    elementId: string;
    to: string;
    onClick?: () => void;
    icon: React.ReactNode;
    label: React.ReactNode;
    active: boolean;
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

// Wraps a hideable rail item with a right-click (or context menu key) menu to hide it, or, for a
// hidden one shown while open, to put it back in the rail for good.
function HideableRailItem({itemId, hidden, children}: {itemId: string; hidden: boolean; children: React.ReactNode}) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [open, setOpen] = useState(false);

    return (
        <div
            className='ProductRail__itemWrapper'
            onContextMenu={(event) => {
                event.preventDefault();
                setOpen(true);
            }}
        >
            {children}
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
                    id={`productRailItemMenu-${itemId}-${hidden ? 'show' : 'hide'}`}
                    leadingElement={hidden ? <EyeOutlineIcon size={18}/> : <EyeOffOutlineIcon size={18}/>}
                    labels={<span>{formatMessage(hidden ? messages.alwaysShow : messages.hide)}</span>}
                    onClick={() => dispatch(setProductRailItemHidden(itemId, !hidden))}
                />
            </Menu.Container>
        </div>
    );
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
};

function ProductRailItem({id, to, onClick, icon, label, active, mentions = 0, hasUrgent = false, unread = false}: ProductRailItemProps) {
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
            onClick={onClick}
            className={className}
            aria-current={active ? 'page' : undefined}
            draggable={false}
        >
            {content}
        </Link>
    );
}
