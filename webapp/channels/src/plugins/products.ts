// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Store} from 'redux';

import {Client4} from 'mattermost-redux/client';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {DispatchFunc, GetStateFunc} from 'mattermost-redux/types/actions';

import store from 'stores/redux_store';

import PluginRegistry from './registry';

export abstract class ProductPlugin {
    abstract initialize(registry: PluginRegistry, store: Store): void;
    abstract uninitialize(): void;
}

export function initializeProducts() {
    return (dispatch: DispatchFunc) => {
        return Promise.all([
            dispatch(loadRemoteModules()),
            dispatch(configureClient()),
        ]);
    };
}

function configureClient() {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const config = getConfig(getState());

        Client4.setUseBoardsProduct(config.FeatureFlagBoardsProduct === 'true');

        return Promise.resolve({data: true});
    };
}

function loadRemoteModules() {
    /* eslint-disable no-console */
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const config = getConfig(getState());

        /**
         * products contains a map of product IDs to a function that will load all of their parts. Calling that
         * function will return an object where each field is a Promise that will resolve to that module.
         *
         * Note that these import paths must be statically defined or else they won't be found at runtime. They
         * can't be constructed based on the name of a product at runtime.
         */
        let products = [
            {
                id: 'boards',
                load: () => ({
                    index: import('boards'),

                    // manifest: import('boards/manifest'),
                }),
            },
            {
                id: 'playbooks',
                load: () => ({
                    index: import('playbooks'),

                    // manifest: import('boards/manifest'),
                }),
            },
        ];
        if (config.EnablePlaybooks !== 'true') {
            products = products.filter((p) => p.id !== 'playbooks');
        }

        await Promise.all(products.map(async (product) => {
            if (!REMOTE_CONTAINERS[product.id]) {
                console.log(`Product ${product.id} not found. Not loading it.`);
                return;
            }

            console.log(`Loading product ${product.id}...`);

            // Start loading the product
            let imports;
            try {
                imports = product.load();
            } catch (e) {
                console.error(`Error loading ${product.id}`, e);
                return;
            }

            // Wait for the individual parts to load
            let index;
            try {
                index = await imports.index;
            } catch (e) {
                console.error(`Error loading index for ${product.id}`, e);
                return;
            }

            // let manifest;
            // try {
            //     manifest = await imports.manifest;
            // } catch (e) {
            //     console.error(`Error loading manifest for ${product.id}`, e);
            //     return;
            // }

            // Initialize the previously loaded data
            console.log(`Initializing product ${product.id}...`);

            try {
                initializeProduct(product.id, index.default);
            } catch (e) {
                console.error(`Error loading and initializing product ${product.id}`, e);
            }

            console.log(`Product ${product.id} initialized!`);
        }));

        return {data: true};
    };

    /* eslint-enable no-console */
}

function initializeProduct(id: string, Product: new () => ProductPlugin) {
    const plugin = new Product();
    const registry = new PluginRegistry(id);

    plugin.initialize(registry, store);
}
