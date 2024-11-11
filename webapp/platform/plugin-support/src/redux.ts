// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector, useStore} from 'react-redux';
import type {Store} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

export function useWebAppSelector<TState extends GlobalState, TSelected>(
    selector: (state: TState) => TSelected,
    equalityFn?: (left: TSelected, right: TSelected) => boolean,
): TSelected {
    return useSelector(selector, equalityFn);
}

export function useWebAppStore<T extends GlobalState = GlobalState>(): Store<T> {
    return useStore<T>();
}
