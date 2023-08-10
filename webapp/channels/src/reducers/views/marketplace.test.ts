// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import marketplaceReducer from 'reducers/views/marketplace';
import {ActionTypes, ModalIdentifiers} from 'utils/constants';

import type {MarketplacePlugin} from '@mattermost/types/marketplace';
import type {GenericAction} from 'mattermost-redux/types/actions';

describe('marketplace', () => {
    test('initial state', () => {
        const currentState = {} as never;
        const action: GenericAction = {} as GenericAction;
        const expectedState = {
            plugins: [],
            apps: [],
            installing: {},
            errors: {},
            filter: '',
        };

        expect(marketplaceReducer(currentState, action)).toEqual(expectedState);
    });

    test(ActionTypes.RECEIVED_MARKETPLACE_PLUGINS, () => {
        const currentState = {
            plugins: [],
            apps: [],
            installing: {},
            errors: {},
            filter: '',
        };
        const action: GenericAction = {
            type: ActionTypes.RECEIVED_MARKETPLACE_PLUGINS,
            plugins: [{id: 'plugin1'}, {id: 'plugin2'}],
        };
        const expectedState = {
            plugins: [{id: 'plugin1'}, {id: 'plugin2'}],
            apps: [],
            installing: {},
            errors: {},
            filter: '',
        };

        expect(marketplaceReducer(currentState, action)).toEqual(expectedState);
    });

    describe(ActionTypes.INSTALLING_MARKETPLACE_ITEM, () => {
        const currentState = {
            plugins: [{manifest: {id: 'plugin1'}}, {manifest: {id: 'plugin2'}}] as MarketplacePlugin[],
            apps: [],
            installing: {plugin1: true},
            errors: {plugin3: 'An error occurred'},
            filter: 'existing',
        };

        it('should set installing for not already installing plugin', () => {
            const action: GenericAction = {
                type: ActionTypes.INSTALLING_MARKETPLACE_ITEM,
                id: 'plugin2',
            };
            const expectedState = {
                plugins: [{manifest: {id: 'plugin1'}}, {manifest: {id: 'plugin2'}}] as MarketplacePlugin[],
                apps: [],
                installing: {plugin1: true, plugin2: true},
                errors: {plugin3: 'An error occurred'},
                filter: 'existing',
            };

            expect(marketplaceReducer(currentState, action)).toEqual(expectedState);
        });

        it('should no-op for already installing plugin', () => {
            const action: GenericAction = {
                type: ActionTypes.INSTALLING_MARKETPLACE_ITEM,
                id: 'plugin1',
            };
            const expectedState = currentState;

            expect(marketplaceReducer(currentState, action)).toBe(expectedState);
        });

        it('should clear error for previously failed plugin', () => {
            const action: GenericAction = {
                type: ActionTypes.INSTALLING_MARKETPLACE_ITEM,
                id: 'plugin3',
            };
            const expectedState = {
                plugins: [{manifest: {id: 'plugin1'}}, {manifest: {id: 'plugin2'}}] as MarketplacePlugin[],
                apps: [],
                installing: {plugin1: true, plugin3: true},
                errors: {},
                filter: 'existing',
            };

            expect(marketplaceReducer(currentState, action)).toEqual(expectedState);
        });
    });

    describe(ActionTypes.INSTALLING_MARKETPLACE_ITEM_SUCCEEDED, () => {
        const currentState = {
            plugins: [{manifest: {id: 'plugin1'}}, {manifest: {id: 'plugin2'}}] as MarketplacePlugin[],
            apps: [],
            installing: {plugin1: true, plugin2: true},
            errors: {plugin3: 'An error occurred'},
            filter: 'existing',
        };

        it('should clear installing', () => {
            const action: GenericAction = {
                type: ActionTypes.INSTALLING_MARKETPLACE_ITEM_SUCCEEDED,
                id: 'plugin1',
            };
            const expectedState = {
                plugins: [{manifest: {id: 'plugin1'}}, {manifest: {id: 'plugin2'}}] as MarketplacePlugin[],
                apps: [],
                installing: {plugin2: true},
                errors: {plugin3: 'An error occurred'},
                filter: 'existing',
            };

            expect(marketplaceReducer(currentState, action)).toEqual(expectedState);
        });

        it('should clear error', () => {
            const action: GenericAction = {
                type: ActionTypes.INSTALLING_MARKETPLACE_ITEM_SUCCEEDED,
                id: 'plugin3',
            };
            const expectedState = {
                plugins: [{manifest: {id: 'plugin1'}}, {manifest: {id: 'plugin2'}}] as MarketplacePlugin[],
                apps: [],
                installing: {plugin1: true, plugin2: true},
                errors: {},
                filter: 'existing',
            };

            expect(marketplaceReducer(currentState, action)).toEqual(expectedState);
        });
    });

    describe(ActionTypes.INSTALLING_MARKETPLACE_ITEM_FAILED, () => {
        const currentState = {
            plugins: [{manifest: {id: 'plugin1'}}, {manifest: {id: 'plugin2'}}] as MarketplacePlugin[],
            apps: [],
            installing: {plugin1: true, plugin2: true},
            errors: {plugin3: 'An error occurred'},
            filter: 'existing',
        };

        it('should clear installing and set error', () => {
            const action: GenericAction = {
                type: ActionTypes.INSTALLING_MARKETPLACE_ITEM_FAILED,
                id: 'plugin1',
                error: 'Failed to intall',
            };
            const expectedState = {
                plugins: [{manifest: {id: 'plugin1'}}, {manifest: {id: 'plugin2'}}] as MarketplacePlugin[],
                apps: [],
                installing: {plugin2: true},
                errors: {plugin1: 'Failed to intall', plugin3: 'An error occurred'},
                filter: 'existing',
            };

            expect(marketplaceReducer(currentState, action)).toEqual(expectedState);
        });
    });

    describe(ActionTypes.FILTER_MARKETPLACE_LISTING, () => {
        const currentState = {
            plugins: [{manifest: {id: 'plugin1'}}, {manifest: {id: 'plugin2'}}] as MarketplacePlugin[],
            apps: [],
            installing: {plugin1: true, plugin2: true},
            errors: {plugin3: 'An error occurred'},
            filter: 'existing',
        };

        it('should set filter', () => {
            const action: GenericAction = {
                type: ActionTypes.FILTER_MARKETPLACE_LISTING,
                filter: 'new',
            };
            const expectedState = {
                plugins: [{manifest: {id: 'plugin1'}}, {manifest: {id: 'plugin2'}}] as MarketplacePlugin[],
                apps: [],
                installing: {plugin1: true, plugin2: true},
                errors: {plugin3: 'An error occurred'},
                filter: 'new',
            };

            expect(marketplaceReducer(currentState, action)).toEqual(expectedState);
        });
    });

    describe(ActionTypes.MODAL_CLOSE, () => {
        const currentState = {
            plugins: [{manifest: {id: 'plugin1'}}, {manifest: {id: 'plugin2'}}] as MarketplacePlugin[],
            apps: [],
            installing: {plugin1: true, plugin2: true},
            errors: {plugin3: 'An error occurred'},
            filter: 'existing',
        };

        it('should no-op for different modal', () => {
            const action: GenericAction = {
                type: ActionTypes.MODAL_CLOSE,
                modalId: ModalIdentifiers.DELETE_CHANNEL,
            };
            const expectedState = currentState;

            expect(marketplaceReducer(currentState, action)).toBe(expectedState);
        });

        it('should clear state for marketplace modal', () => {
            const action: GenericAction = {
                type: ActionTypes.MODAL_CLOSE,
                modalId: ModalIdentifiers.PLUGIN_MARKETPLACE,
            };
            const expectedState = {
                plugins: [],
                apps: [],
                installing: {},
                errors: {},
                filter: '',
            };

            expect(marketplaceReducer(currentState, action)).toEqual(expectedState);
        });
    });
});
