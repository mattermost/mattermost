// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Recap} from '@mattermost/types/recaps';

import {getRecap} from 'mattermost-redux/actions/recaps';

import RecapItem from './recap_item';

type Props = {
    recaps: Recap[];
};

const RecapsList = ({recaps}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [expandedRecapIds, setExpandedRecapIds] = useState<Set<string>>(new Set());

    // Poll for processing recaps
    useEffect(() => {
        const processingRecaps = recaps.filter((recap) =>
            recap.status === 'pending' || recap.status === 'processing',
        );

        if (processingRecaps.length === 0) {
            return;
        }

        const pollInterval = setInterval(() => {
            processingRecaps.forEach((recap) => {
                dispatch(getRecap(recap.id));
            });
        }, 3000);

        return () => clearInterval(pollInterval);
    }, [recaps, dispatch]);

    const toggleRecap = (recapId: string) => {
        const newExpanded = new Set(expandedRecapIds);
        if (newExpanded.has(recapId)) {
            newExpanded.delete(recapId);
        } else {
            newExpanded.add(recapId);
            // Fetch full recap with channels if not already loaded
            dispatch(getRecap(recapId));
        }
        setExpandedRecapIds(newExpanded);
    };

    if (recaps.length === 0) {
        return (
            <div className='recaps-empty-state'>
                <div className='empty-state-icon'>
                    <i className='icon icon-check-circle'/>
                </div>
                <h2 className='empty-state-title'>
                    {formatMessage({id: 'recaps.emptyState.title', defaultMessage: "You're all caught up"})}
                </h2>
                <p className='empty-state-description'>
                    {formatMessage({id: 'recaps.emptyState.description', defaultMessage: "You don't have any recaps yet. Create one to get started."})}
                </p>
            </div>
        );
    }

    return (
        <div className='recaps-list'>
            {recaps.map((recap) => (
                <RecapItem
                    key={recap.id}
                    recap={recap}
                    isExpanded={expandedRecapIds.has(recap.id)}
                    onToggle={() => toggleRecap(recap.id)}
                />
            ))}

            <div className='recap-all-caught-up'>
                <i className='icon icon-check-circle'/>
                <span>{formatMessage({id: 'recaps.allCaughtUp', defaultMessage: "You're all caught up"})}</span>
            </div>
        </div>
    );
};

export default RecapsList;

