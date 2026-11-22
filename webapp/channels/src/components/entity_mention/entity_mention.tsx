// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {EntityCard} from '@mattermost/types/posts';

import {Client4} from 'mattermost-redux/client';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import {showEntity} from 'actions/views/rhs';
import {isUseMilitaryTime} from 'selectors/preferences';

import {entityLabel} from './labels';

type Props = {
    typeId: string;
    value: string;
    url?: string;
    label?: string;
    title?: string;
    hasCard?: boolean;
    postId?: string;
    occurrence?: string;
    children?: React.ReactNode;
};

type CardCacheEntry = {
    card: EntityCard;
    until: number;
};

const CARD_CACHE_TTL_MS = 5 * 60 * 1000;
const CARD_CACHE_MAX = 200;
const timeCardCache = new Map<string, CardCacheEntry>();

function readCardCache(key: string): EntityCard | undefined {
    const entry = timeCardCache.get(key);
    if (!entry) {
        return undefined;
    }
    if (entry.until <= Date.now()) {
        timeCardCache.delete(key);
        return undefined;
    }
    return entry.card;
}

function writeCardCache(key: string, card: EntityCard) {
    if (timeCardCache.size >= CARD_CACHE_MAX) {
        const oldest = timeCardCache.keys().next().value;
        if (oldest !== undefined) {
            timeCardCache.delete(oldest);
        }
    }
    timeCardCache.set(key, {card, until: Date.now() + CARD_CACHE_TTL_MS});
}

function entityHref(url?: string): string | undefined {
    if (!url || (/[\s\\]/).test(url) || url.includes('..')) {
        return undefined;
    }
    if (url.startsWith('https://') || url.startsWith('http://')) {
        return url;
    }
    if (url.startsWith('/') && !url.startsWith('//')) {
        return url;
    }
    return undefined;
}

function formatInstant(instant: number, timeZone: string | undefined, military: boolean, intl: ReturnType<typeof useIntl>) {
    const date = new Date(instant);
    const zone = timeZone || undefined;
    const time = intl.formatTime(date, {
        timeZone: zone,
        hour: 'numeric',
        minute: '2-digit',
        hourCycle: military ? 'h23' : 'h12',
        timeZoneName: 'short',
    });
    const day = intl.formatDate(date, {
        timeZone: zone,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });
    return `${day}, ${time}`;
}

const HOVER_OPEN_MS = 400;
const HOVER_CLOSE_MS = 120;

const mention: React.CSSProperties = {
    display: 'inline',
    margin: 0,
    padding: 0,
    border: 'none',
    background: 'none',
    font: 'inherit',
    color: 'inherit',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textUnderlineOffset: '0.18em',
    cursor: 'pointer',
};

const card: React.CSSProperties = {
    position: 'fixed',
    zIndex: 1200,
    minWidth: 180,
    maxWidth: 280,
    padding: '8px 10px',
    background: 'var(--center-channel-bg)',
    color: 'var(--center-channel-color)',
    border: '1px solid rgba(var(--center-channel-color-rgb), 0.16)',
    borderRadius: 4,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
    whiteSpace: 'normal',
    textAlign: 'left',
    fontSize: 13,
    lineHeight: '18px',
};

function placeCard(anchor: DOMRect, cardBox: DOMRect) {
    const margin = 8;
    const composer = document.getElementById('post-create')?.getBoundingClientRect();
    const height = Math.max(cardBox.height, 56);
    const bottomLimit = Math.min(window.innerHeight, composer ? composer.top : window.innerHeight) - margin;
    const below = anchor.bottom + margin;
    const above = anchor.top - height - margin;
    const fitsBelow = below + height <= bottomLimit;
    const top = fitsBelow ? below : Math.max(margin, above);
    let left = anchor.left;
    if (left + cardBox.width > window.innerWidth - margin) {
        left = window.innerWidth - cardBox.width - margin;
    }
    return {top, left: Math.max(margin, left)};
}

export default function EntityMention({typeId, value, url, label: labelProp, title, hasCard, postId, occurrence, children}: Props) {
    const dispatch = useDispatch();
    const intl = useIntl();
    const timezone = useSelector(getCurrentTimezone);
    const military = useSelector(isUseMilitaryTime);
    const currentUserId = useSelector(getCurrentUserId);
    const anchorRef = useRef<HTMLElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const openTimer = useRef<number | undefined>(undefined);
    const closeTimer = useRef<number | undefined>(undefined);
    const [open, setOpen] = useState(false);
    const [placed, setPlaced] = useState(false);
    const [position, setPosition] = useState({top: 0, left: 0});
    const [hoverCardState, setHoverCardState] = useState<{key: string; card: EntityCard} | null>(null);
    const safeURL = entityHref(url);
    const label = labelProp || entityLabel(typeId, intl.formatMessage);
    const cacheKey = `${currentUserId}\0${typeId}\0${value}\0${postId || ''}\0${occurrence || ''}`;
    const hoverCard = hoverCardState?.key === cacheKey ? hoverCardState.card : null;

    const clearTimers = () => {
        if (openTimer.current !== undefined) {
            window.clearTimeout(openTimer.current);
        }
        if (closeTimer.current !== undefined) {
            window.clearTimeout(closeTimer.current);
        }
    };

    const scheduleOpen = () => {
        clearTimers();
        openTimer.current = window.setTimeout(() => setOpen(true), HOVER_OPEN_MS);
    };

    const scheduleClose = () => {
        clearTimers();
        closeTimer.current = window.setTimeout(() => setOpen(false), HOVER_CLOSE_MS);
    };

    useEffect(() => clearTimers, []);

    useEffect(() => {
        if (!open || !hasCard) {
            return undefined;
        }
        const cached = readCardCache(cacheKey);
        if (cached) {
            setHoverCardState({key: cacheKey, card: cached});
            return undefined;
        }
        let cancel = false;
        Client4.getEntityCard(typeId, value, postId, occurrence).then((next) => {
            if (cancel) {
                return;
            }
            writeCardCache(cacheKey, next);
            setHoverCardState({key: cacheKey, card: next});
        }).catch(() => {
            if (!cancel) {
                setHoverCardState(null);
            }
        });
        return () => {
            cancel = true;
        };
    }, [open, hasCard, cacheKey, typeId, value, postId, occurrence]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }
        const update = () => {
            if (!anchorRef.current || !cardRef.current) {
                return;
            }
            setPosition(placeCard(anchorRef.current.getBoundingClientRect(), cardRef.current.getBoundingClientRect()));
        };
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [open, hoverCard]);

    useLayoutEffect(() => {
        if (!open || !anchorRef.current || !cardRef.current) {
            setPlaced(false);
            return;
        }
        const next = placeCard(anchorRef.current.getBoundingClientRect(), cardRef.current.getBoundingClientRect());
        setPosition(next);
        setPlaced(true);
    }, [open, hoverCard]);

    const openSidebar = (event: React.SyntheticEvent) => {
        event.preventDefault();
        event.stopPropagation();
        clearTimers();
        setOpen(false);
        dispatch(showEntity({typeId, value, url: safeURL, label, postId, occurrence}));
    };

    const localTime = hoverCard?.instant ? formatInstant(hoverCard.instant, timezone, military, intl) : '';
    const primary = localTime || (title && title !== value ? title : value);

    const tip = open ? createPortal(
        <div
            ref={cardRef}
            role='tooltip'
            data-testid='entity-mention-card'
            style={{...card, top: position.top, left: position.left, visibility: placed ? 'visible' : 'hidden'}}
            onMouseEnter={scheduleOpen}
            onMouseLeave={scheduleClose}
            onClick={openSidebar}
        >
            <span style={{display: 'block', fontWeight: 600}}>{label}</span>
            <span
                style={{display: 'block'}}
                data-testid='entity-mention-card-primary'
            >{primary}</span>
            {localTime && value !== localTime && (
                <span style={{display: 'block', marginTop: 4, opacity: 0.64, fontSize: 12}}>{value}</span>
            )}
            {safeURL && (
                <a
                    href={safeURL}
                    style={{display: 'inline-block', marginTop: 6}}
                    onClick={(event) => event.stopPropagation()}
                >
                    <FormattedMessage
                        id='entity_mention.open'
                        defaultMessage='Open'
                    />
                </a>
            )}
        </div>,
        document.getElementById('root-portal') ?? document.body,
    ) : null;

    if (!hasCard && safeURL) {
        const showTitle = Boolean(title && title !== value);
        return (
            <a
                ref={anchorRef as React.RefObject<HTMLAnchorElement>}
                href={safeURL}
                className='entity-mention'
                data-testid='entity-mention'
                style={{...mention, textDecorationStyle: 'solid', color: 'var(--link-color)'}}
                onMouseEnter={showTitle ? scheduleOpen : undefined}
                onMouseLeave={showTitle ? scheduleClose : undefined}
            >
                {children}
                {showTitle ? tip : null}
            </a>
        );
    }

    return (
        <button
            ref={anchorRef as React.RefObject<HTMLButtonElement>}
            type='button'
            className='entity-mention'
            data-testid='entity-mention'
            style={mention}
            onMouseEnter={scheduleOpen}
            onMouseLeave={scheduleClose}
            onFocus={() => setOpen(true)}
            onBlur={scheduleClose}
            onClick={openSidebar}
        >
            {children}
            {tip}
        </button>
    );
}
