// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {GlobalState} from '@mattermost/types/store';

import {Condition} from 'src/types/conditions';
import {fetchPlaybookConditions} from 'src/actions';
import {getConditionsByPlaybookId} from 'src/selectors';
import {createPlaybookCondition} from 'src/client';

/**
 * Hook to fetch and manage playbook conditions using Redux
 */
export function usePlaybookConditions(playbookId: string) {
    const dispatch = useDispatch();
    const conditions = useSelector((state: GlobalState) => getConditionsByPlaybookId(state, playbookId));

    const refetch = useCallback(() => {
        if (playbookId) {
            dispatch(fetchPlaybookConditions(playbookId) as any);
        }
    }, [dispatch, playbookId]);

    const createCondition = useCallback(async (condition: Omit<Condition, 'id' | 'create_at' | 'update_at' | 'delete_at'>) => {
        return createPlaybookCondition(playbookId, condition);
    }, [playbookId]);

    useEffect(() => {
        if (playbookId) {
            refetch();
        }
    }, [playbookId, refetch]);

    return {
        conditions,
        refetch,
        createCondition,
    };
}