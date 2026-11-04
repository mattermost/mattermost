// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {EntityCard} from '@mattermost/types/posts';

import {Client4} from 'mattermost-redux/client';

import {closeRightHandSide} from 'actions/views/rhs';
import {getSelectedEntity} from 'selectors/rhs';

import {entityLabel} from 'components/entity_mention/labels';

import EntityCardView, {type EntityOpenTarget} from './entity_card';

type EntityFrame = EntityOpenTarget & {
    postId?: string;
    occurrence?: string;
};

function isRich(card: EntityCard) {
    return Boolean(
        card.summary ||
        card.score ||
        card.severity ||
        card.exploited ||
        card.rows?.length ||
        card.vector?.length ||
        card.related?.length ||
        card.sections?.length ||
        card.blocks?.length ||
        card.map?.points?.length ||
        card.map?.geojson ||
        card.instant,
    );
}

export default function EntityRhs() {
    const dispatch = useDispatch();
    const entity = useSelector(getSelectedEntity);
    const [card, setCard] = useState<EntityCard | null | undefined>();
    const [deeper, setDeeper] = useState<EntityFrame[]>([]);
    const [reloadKey, setReloadKey] = useState(0);
    const entityKey = entity ? `${entity.typeId}\0${entity.value}\0${entity.postId}\0${entity.occurrence}` : '';
    const [seenEntityKey, setSeenEntityKey] = useState(entityKey);
    if (entityKey !== seenEntityKey) {
        setSeenEntityKey(entityKey);
        setDeeper([]);
    }
    const trail = entityKey === seenEntityKey ? deeper : [];

    const frame: EntityFrame | undefined = trail.length > 0 ? trail[trail.length - 1] : (entity && {
        typeId: entity.typeId,
        value: entity.value,
        label: entity.label,
        postId: entity.postId,
        occurrence: entity.occurrence,
    });

    const frameTypeId = frame?.typeId;
    const frameValue = frame?.value;
    const framePostId = frame?.postId;
    const frameOccurrence = frame?.occurrence;

    useEffect(() => {
        if (!frameTypeId || frameValue === undefined) {
            setCard(undefined);
            return undefined;
        }
        let cancel = false;
        setCard(undefined);
        Client4.getEntityCard(frameTypeId, frameValue, framePostId, frameOccurrence).then((next) => {
            if (!cancel) {
                setCard(next);
            }
        }).catch(() => {
            if (!cancel) {
                setCard(null);
            }
        });
        return () => {
            cancel = true;
        };
    }, [frameTypeId, frameValue, framePostId, frameOccurrence, reloadKey]);

    if (!entity) {
        return null;
    }

    const openEntity = (target: EntityOpenTarget) => {
        setDeeper((stack) => [...stack, target]);
    };

    const entityURL = trail.length === 0 && entity.url && (entity.url.startsWith('https://') || (entity.url.startsWith('/') && !entity.url.startsWith('//') && !entity.url.includes('..'))) ? entity.url : undefined;
    const url = (card?.url && (card.url.startsWith('https://') || (card.url.startsWith('/') && !card.url.startsWith('//') && !card.url.includes('..'))) ? card.url : undefined) || entityURL;

    return (
        <div
            className='sidebar-right__body'
            data-testid='entity-rhs'
        >
            <div className='sidebar--right__header'>
                <span className='sidebar--right__title'>
                    {trail.length > 0 && (
                        <button
                            type='button'
                            aria-label='Back'
                            onClick={() => setDeeper((stack) => stack.slice(0, -1))}
                            style={{background: 'none', border: 'none', padding: '0 8px 0 0', font: 'inherit', color: 'inherit', cursor: 'pointer'}}
                        >{'‹'}</button>
                    )}
                    <h2 id='rhsPanelTitle'>{frame?.label || entityLabel(frame?.typeId || entity.typeId)}</h2>
                </span>
                <button
                    id='rhsCloseButton'
                    type='button'
                    className='sidebar--right__close btn btn-icon btn-sm'
                    aria-label='Close'
                    onClick={() => dispatch(closeRightHandSide())}
                >
                    <i className='icon icon-close'/>
                </button>
            </div>
            <div style={{overflowY: 'auto', flex: 1, minHeight: 0, padding: '16px 20px 32px', color: 'var(--center-channel-color)'}}>
                {card && isRich(card) ? (
                    <EntityCardView
                        card={card}
                        onOpen={openEntity}
                        reload={() => setReloadKey((key) => key + 1)}
                    />
                ) : (
                    <>
                        <div style={{fontSize: 20, fontWeight: 600}}>{frame?.value || entity.value}</div>
                        {card === null && <p style={{marginTop: 12, opacity: 0.72}}>{'No additional information'}</p>}
                        {url && card !== undefined && (
                            <a
                                href={url}
                                target='_blank'
                                rel='noopener noreferrer'
                                data-testid='entity-rhs-link'
                            >
                                {url}
                            </a>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
