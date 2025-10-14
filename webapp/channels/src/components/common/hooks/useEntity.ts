// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import type {Action} from 'redux';
import type {ThunkAction} from 'redux-thunk';

import type {GlobalState} from 'types/store';

export type UseDataOptions<Entity, Identifier = string, State = GlobalState> = {
    name: string;

    fetch: (identifier: Identifier, ...fetchArgs: unknown[]) => Action | ThunkAction<unknown, State, unknown, Action>;
    selector: (state: State, identifier: Identifier) => Entity | undefined;
}

export function makeUseEntity<Entity, Identifier = string, State = GlobalState>(options: UseDataOptions<Entity, Identifier, State>) {
    function useEntity(identifier: Identifier, ...fetchArgs: unknown[]): Entity | undefined {
        const dispatch = useDispatch();
        const fetchArgsRef = useRef(fetchArgs);

        const entity = useSelector((state: State) => {
            return identifier ? options.selector(state, identifier) : undefined;
        });

        const entityLoaded = Boolean(entity);
        useEffect(() => {
            if (!entityLoaded && identifier) {
                dispatch(options.fetch(identifier, ...fetchArgsRef.current));
            }
        }, [dispatch, entityLoaded, identifier]);

        return entity;
    }

    Object.defineProperty(useEntity, 'name', {value: options.name, writable: false});

    return useEntity;
}
