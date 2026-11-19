// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GeneralTypes, UserTypes} from 'mattermost-redux/action_types';
import reducer from 'mattermost-redux/reducers/entities/general';

type ReducerState = ReturnType<typeof reducer>;

describe('reducers.entities.general', () => {
    describe('firstAdminVisitMarketplaceStatus', () => {
        it('initial state', () => {
            const state = {};
            const action = {type: 'testinit'};
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
            const action = {type: 'testinit'};
            const expectedState = {};

            const actualState = reducer({firstAdminVisitMarketplaceStatus: state} as ReducerState, action);
            expect(actualState.firstAdminVisitMarketplaceStatus).toEqual(expectedState);
        });

        it('CUSTOM_PROFILE_ATTRIBUTE_FIELDS_RECEIVED, empty initial state', () => {
            const state = {};
            const testAttributeOne = {id: '123', name: 'test attribute', type: 'text'};
            const action = {
                type: GeneralTypes.CUSTOM_PROFILE_ATTRIBUTE_FIELDS_RECEIVED,
                data: [testAttributeOne],
            };
            const expectedState = {[testAttributeOne.id]: testAttributeOne} as ReducerState['customProfileAttributes'];
            const actualState = reducer({customProfileAttributes: state} as ReducerState, action);
            expect(actualState.customProfileAttributes).toEqual(expectedState);
        });

        it('CUSTOM_PROFILE_ATTRIBUTE_FIELDS_RECEIVED, attributes are completely replaced', () => {
            const testAttributeOne = {id: '123', name: 'test attribute', type: 'text'};
            const testAttributeTwo = {id: '456', name: 'test attribute two', type: 'text'};
            const state = {[testAttributeOne.id]: testAttributeOne, [testAttributeTwo.id]: testAttributeTwo};

            const updatedAttributeOne = {id: '123', name: 'new name value', type: 'text'};

            const action = {
                type: GeneralTypes.CUSTOM_PROFILE_ATTRIBUTE_FIELDS_RECEIVED,
                data: [updatedAttributeOne],
            };
            const expectedState = {[updatedAttributeOne.id]: updatedAttributeOne};

            const actualState = reducer({customProfileAttributes: state} as ReducerState, action);
            expect(actualState.customProfileAttributes).toEqual(expectedState);
        });

        it('CUSTOM_PROFILE_ATTRIBUTE_FIELD_CREATED', () => {
            const state = {};
            const testAttributeOne = {id: '123', name: 'test attribute', type: 'text'};
            const action = {
                type: GeneralTypes.CUSTOM_PROFILE_ATTRIBUTE_FIELD_CREATED,
                data: testAttributeOne,
            };
            const expectedState = {[testAttributeOne.id]: testAttributeOne} as ReducerState['customProfileAttributes'];
            const actualState = reducer({customProfileAttributes: state} as ReducerState, action);
            expect(actualState.customProfileAttributes).toEqual(expectedState);
        });

        it('CUSTOM_PROFILE_ATTRIBUTE_FIELD_PATCHED', () => {
            const testAttributeOne = {id: '123', name: 'test attribute', type: 'text'};
            const state = {[testAttributeOne.id]: testAttributeOne};

            const renamedAttributeOne = {...testAttributeOne, name: 'renamed attribute'};
            const action = {
                type: GeneralTypes.CUSTOM_PROFILE_ATTRIBUTE_FIELD_PATCHED,
                data: renamedAttributeOne,
            };
            const expectedState = {[testAttributeOne.id]: renamedAttributeOne} as ReducerState['customProfileAttributes'];
            const actualState = reducer({customProfileAttributes: state} as ReducerState, action);
            expect(actualState.customProfileAttributes).toEqual(expectedState);
        });

        it('CUSTOM_PROFILE_ATTRIBUTE_FIELD_DELETED', () => {
            const testAttributeOne = {id: '123', name: 'test attribute', type: 'text'};
            const state = {[testAttributeOne.id]: testAttributeOne};

            const action = {
                type: GeneralTypes.CUSTOM_PROFILE_ATTRIBUTE_FIELD_DELETED,
                data: testAttributeOne.id,
            };
            const expectedState = {} as ReducerState['customProfileAttributes'];
            const actualState = reducer({customProfileAttributes: state} as ReducerState, action);
            expect(actualState.customProfileAttributes).toEqual(expectedState);
        });
    });

    describe('clientConfigOverrides', () => {
        it('replaces overrides on CLIENT_CONFIG_OVERRIDES_RECEIVED and preserves across CLIENT_CONFIG_RECEIVED', () => {
            let actualState = reducer(undefined, {
                type: GeneralTypes.CLIENT_CONFIG_RECEIVED,
                data: {MobileEnableBiometrics: 'false', SiteName: 'Mattermost'},
            });
            actualState = reducer(actualState, {
                type: GeneralTypes.CLIENT_CONFIG_OVERRIDES_RECEIVED,
                data: {MobileEnableBiometrics: 'true'},
            });
            expect(actualState.clientConfigOverrides).toEqual({MobileEnableBiometrics: 'true'});

            actualState = reducer(actualState, {
                type: GeneralTypes.CLIENT_CONFIG_RECEIVED,
                data: {MobileEnableBiometrics: 'false', SiteName: 'Updated'},
            });
            expect(actualState.config).toEqual({MobileEnableBiometrics: 'false', SiteName: 'Updated'});
            expect(actualState.clientConfigOverrides).toEqual({MobileEnableBiometrics: 'true'});

            actualState = reducer(actualState, {
                type: GeneralTypes.CLIENT_CONFIG_OVERRIDES_RECEIVED,
                data: {},
            });
            expect(actualState.clientConfigOverrides).toEqual({});
        });

        it('keeps the existing overrides object when a push carries the same values', () => {
            const populated = reducer(undefined, {
                type: GeneralTypes.CLIENT_CONFIG_OVERRIDES_RECEIVED,
                data: {MobileEnableBiometrics: 'true'},
            });

            const repeated = reducer(populated, {
                type: GeneralTypes.CLIENT_CONFIG_OVERRIDES_RECEIVED,
                data: {MobileEnableBiometrics: 'true'},
            });
            expect(repeated.clientConfigOverrides).toBe(populated.clientConfigOverrides);

            const changed = reducer(repeated, {
                type: GeneralTypes.CLIENT_CONFIG_OVERRIDES_RECEIVED,
                data: {MobileEnableBiometrics: 'false'},
            });
            expect(changed.clientConfigOverrides).not.toBe(populated.clientConfigOverrides);
            expect(changed.clientConfigOverrides).toEqual({MobileEnableBiometrics: 'false'});
        });

        it('clears overrides on LOGOUT_SUCCESS and CLIENT_CONFIG_RESET', () => {
            const populated = reducer(undefined, {
                type: GeneralTypes.CLIENT_CONFIG_OVERRIDES_RECEIVED,
                data: {MobileEnableBiometrics: 'true'},
            });
            expect(reducer(populated, {type: UserTypes.LOGOUT_SUCCESS}).clientConfigOverrides).toEqual({});
            expect(reducer(populated, {type: GeneralTypes.CLIENT_CONFIG_RESET}).clientConfigOverrides).toEqual({});
        });
    });
});
