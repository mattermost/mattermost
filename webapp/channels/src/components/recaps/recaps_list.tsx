// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {EmptyState} from '@mattermost/compass-ui/components/empty-state';
import AICopilotIntroIllustration from '@mattermost/compass-ui/illustrations/ai-copilot-intro';
import type {Recap} from '@mattermost/types/recaps';
import {RecapStatus} from '@mattermost/types/recaps';

import {getRecap} from 'mattermost-redux/actions/recaps';

import RecapItem from './recap_item';

type Props = {
    recaps: Recap[];
};

const RecapsList = ({recaps}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [expandedRecapIds, setExpandedRecapIds] = useState<Set<string>>(new Set());
    const previousRecapStatuses = useRef<Map<string, string>>(new Map());

    // Auto-expand recaps when they finish processing
    useEffect(() => {
        const newExpanded = new Set(expandedRecapIds);
        let hasChanges = false;

        recaps.forEach((recap) => {
            const previousStatus = previousRecapStatuses.current.get(recap.id);
            const isProcessing = previousStatus === RecapStatus.PENDING || previousStatus === RecapStatus.PROCESSING;
            const isCompleted = recap.status === RecapStatus.COMPLETED;

            // If recap just finished processing, expand it and fetch details
            if (isProcessing && isCompleted && !expandedRecapIds.has(recap.id)) {
                newExpanded.add(recap.id);
                hasChanges = true;
                dispatch(getRecap(recap.id));
            }

            // Update the previous status
            previousRecapStatuses.current.set(recap.id, recap.status);
        });

        if (hasChanges) {
            setExpandedRecapIds(newExpanded);
        }
    }, [recaps, expandedRecapIds, dispatch]);

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
            <EmptyState
                className='recaps-empty-state'
                illustration={{
                    'aria-label': '',
                    children: <AICopilotIntroIllustration/>,
                }}
                title={formatMessage({id: 'recaps.emptyState.title', defaultMessage: "You're all caught up"})}
                description={formatMessage({id: 'recaps.emptyState.description', defaultMessage: "You don't have any recaps yet. Create one to get started."})}
            />
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
        </div>
    );
};

export default RecapsList;

