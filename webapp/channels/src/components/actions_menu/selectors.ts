// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AppBinding} from '@mattermost/types/apps';

import {AppBindingLocations} from 'mattermost-redux/constants/apps';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {makeAppBindingsSelector, makeRHSAppBindingSelector} from 'mattermost-redux/selectors/entities/apps';

import type {GlobalState} from 'types/store';
import {Locations} from 'utils/constants';

export function makeGetPostOptionBinding(): (state: GlobalState, location?: string) => AppBinding[] | null {
    const centerBindingsSelector = makeAppBindingsSelector(AppBindingLocations.POST_MENU_ITEM);
    const rhsBindingsSelector = makeRHSAppBindingSelector(AppBindingLocations.POST_MENU_ITEM);
    return createSelector(
        'postOptionsBindings',
        centerBindingsSelector,
        rhsBindingsSelector,
        (state: GlobalState, location?: string) => location,
        (centerBindings: AppBinding[], rhsBindings: AppBinding[], location?: string) => {
            switch (location) {
            case Locations.RHS_ROOT:
            case Locations.RHS_COMMENT:
                return rhsBindings;
            case Locations.SEARCH:
                return null;
            case Locations.CENTER:
            default:
                return centerBindings;
            }
        },
    );
}
