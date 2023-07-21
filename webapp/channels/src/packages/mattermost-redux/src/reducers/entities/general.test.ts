// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GeneralTypes} from 'mattermost-redux/action_types';
import reducer from 'mattermost-redux/reducers/entities/general';
import {GenericAction} from 'mattermost-redux/types/actions';

type ReducerState = ReturnType<typeof reducer>

describe('reducers.entities.general', () => {
    describe('firstAdminVisitMarketplaceStatus', () => {
        it('initial state', () => {
            const state = {};
            const action = {};
            const expectedState = {};

            const actualState = reducer({firstAdminVisitMarketplaceStatus: state} as ReducerState, action as GenericAction);
            expect(actualState.firstAdminVisitMarketplaceStatus).toEqual(expectedState);
        });

        it('FIRST_ADMIN_VISIT_MARKETPLACE_STATUS_RECEIVED, empty initial state', () => {
            const state = {};
            const action = {
                type: GeneralTypes.FIRST_ADMIN_VISIT_MARKETPLACE_STATUS_RECEIVED,
                data: true,
            };
            const expectedState = true;

            const actualState = reducer({firstAdminVisitMarketplaceStatus: state} as ReducerState, action);
            expect(actualState.firstAdminVisitMarketplaceStatus).toEqual(expectedState);
        });

        it('FIRST_ADMIN_VISIT_MARKETPLACE_STATUS_RECEIVED, previously populated state', () => {
            const state = true;
            const action = {
                type: GeneralTypes.FIRST_ADMIN_VISIT_MARKETPLACE_STATUS_RECEIVED,
                data: true,
            };
            const expectedState = true;

            const actualState = reducer({firstAdminVisitMarketplaceStatus: state} as ReducerState, action);
            expect(actualState.firstAdminVisitMarketplaceStatus).toEqual(expectedState);
        });
    });
});
