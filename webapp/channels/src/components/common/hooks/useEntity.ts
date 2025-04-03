// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import type {Action} from 'redux';
import type {ThunkAction} from 'redux-thunk';

import type {GlobalState} from 'types/store';

export type UseDataOptions<Entity, Identifier = string, State = GlobalState> = {
    name: string;

    fetch: (identifier: Identifier) => Action | ThunkAction<unknown, State, unknown, Action>;
    selector: (state: State, identifier: Identifier) => Entity | undefined;
}

export function makeUseEntity<Entity, Identifier = string, State = GlobalState>(options: UseDataOptions<Entity, Identifier, State>) {
    function useEntity(identifier: Identifier): Entity | undefined {
        const dispatch = useDispatch();

        const entity = useSelector((state: State) => {
            return identifier ? options.selector(state, identifier) : undefined;
        });

        const entityLoaded = Boolean(entity);
        useEffect(() => {
            if (!entityLoaded && identifier) {
                dispatch(options.fetch(identifier));
            }
        }, [dispatch, entityLoaded, identifier]);

        return entity;
    }

    Object.defineProperty(useEntity, 'name', {value: options.name, writable: false});

    return useEntity;
}
