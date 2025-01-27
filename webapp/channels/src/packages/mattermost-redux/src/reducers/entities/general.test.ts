// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GeneralTypes} from 'mattermost-redux/action_types';
import reducer from 'mattermost-redux/reducers/entities/general';

type ReducerState = ReturnType<typeof reducer>

describe('reducers.entities.general', () => {
    describe('firstAdminVisitMarketplaceStatus', () => {
        it('initial state', () => {
            const state = {};
            const action = {type: undefined};
            const expectedState = {};

            const actualState = reducer({firstAdminVisitMarketplaceStatus: state} as ReducerState, action);
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

    describe('customProfileAttributes', () => {
        it('initial state', () => {
            const state = {};
            const action = {type: undefined};
            const expectedState = {};

            const actualState = reducer({firstAdminVisitMarketplaceStatus: state} as ReducerState, action);
            expect(actualState.firstAdminVisitMarketplaceStatus).toEqual(expectedState);
        });

        it('CUSTOM_PROFILE_ATTRIBUTES_RECEIVED, empty initial state', () => {
            const state = {};
            const testAttributeOne = {id: '123', name: 'test attribute', type: 'text'};
            const action = {
                type: GeneralTypes.CUSTOM_PROFILE_ATTRIBUTES_RECEIVED,
                data: [testAttributeOne],
            };
            const expectedState = {[testAttributeOne.id]: testAttributeOne} as ReducerState['customProfileAttributes'];
            const actualState = reducer({customProfileAttributes: state} as ReducerState, action);
            expect(actualState.customProfileAttributes).toEqual(expectedState);
        });

        it('CUSTOM_PROFILE_ATTRIBUTES_RECEIVED, attributes are completely replaced', () => {
            const testAttributeOne = {id: '123', name: 'test attribute', type: 'text'};
            const testAttributeTwo = {id: '456', name: 'test attribute two', type: 'text'};
            const state = {[testAttributeOne.id]: testAttributeOne, [testAttributeTwo.id]: testAttributeTwo};

            const updatedAttributeOne = {id: '123', name: 'new name value', type: 'text'};

            const action = {
                type: GeneralTypes.CUSTOM_PROFILE_ATTRIBUTES_RECEIVED,
                data: [updatedAttributeOne],
            };
            const expectedState = {[updatedAttributeOne.id]: updatedAttributeOne};

            const actualState = reducer({customProfileAttributes: state} as ReducerState, action);
            expect(actualState.customProfileAttributes).toEqual(expectedState);
        });
    });
});
