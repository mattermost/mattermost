// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyFieldOwner} from '@mattermost/types/properties_user';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import AttributeOwnersSource from './attribute_owners_source';

describe('AttributeOwnersSource', () => {
    const plugin: PropertyFieldOwner = {id: 'com.mattermost.scim', type: 'plugin', scopes: []};
    const service: PropertyFieldOwner = {id: 'svc-sync', type: 'service', scopes: []};

    const renderComponent = (
        owners: PropertyFieldOwner[],
        {installed = true, pluginInventoryLoaded = true} = {},
    ) => {
        return renderWithContext(
            <AttributeOwnersSource
                owners={owners}
                pluginInventoryLoaded={pluginInventoryLoaded}
            />,
            installed ? {
                entities: {
                    admin: {
                        pluginStatuses: {
                            [plugin.id]: {name: 'SCIM'} as never,
                        },
                    },
                },
            } : undefined,
        );
    };

    it('names an installed plugin owner and links to its settings', () => {
        renderComponent([plugin]);

        expect(screen.getByTestId('attributeOwnersSourceManagedBy')).toHaveTextContent('Managed by SCIM');
        const link = screen.getByTestId(`attributeOwnersSourceLink-${plugin.id}`);
        expect(link).toHaveAttribute('href', `/admin_console/plugins/plugin_${plugin.id}`);
        expect(link).toHaveTextContent('SCIM settings');
    });

    it('falls back to the plugin ID with no link when the plugin is not installed', () => {
        renderComponent([plugin], {installed: false});

        expect(screen.getByTestId('attributeOwnersSourceManagedBy')).toHaveTextContent(`Managed by ${plugin.id}`);
        expect(screen.queryByTestId(`attributeOwnersSourceLink-${plugin.id}`)).not.toBeInTheDocument();
    });

    it('shows no link until the plugin inventory has loaded', () => {
        renderComponent([plugin], {pluginInventoryLoaded: false});

        expect(screen.queryByTestId(`attributeOwnersSourceLink-${plugin.id}`)).not.toBeInTheDocument();
    });

    it('names a service owner by its ID with no link', () => {
        renderComponent([service]);

        expect(screen.getByTestId('attributeOwnersSourceManagedBy')).toHaveTextContent('Managed by svc-sync');
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('names every owner in order and links only the installed plugin', () => {
        renderComponent([plugin, service]);

        expect(screen.getByTestId('attributeOwnersSourceManagedBy')).toHaveTextContent('Managed by SCIM and svc-sync');
        expect(screen.getAllByRole('link')).toHaveLength(1);
    });

    it('shows owner scopes on the Managed by line but not in the helper text', () => {
        renderComponent([{...plugin, scopes: ['local']}]);

        expect(screen.getByTestId('attributeOwnersSourceManagedBy')).toHaveTextContent('Managed by SCIM: local');
        expect(screen.getByTestId('attributeOwnersSourceHelperText')).toHaveTextContent('Values for users are set by SCIM.');
    });

    it('names the owners in helper text that differs from the plugin-created text', () => {
        renderComponent([plugin]);

        const helperText = screen.getByTestId('attributeOwnersSourceHelperText');
        expect(helperText).toHaveTextContent('Values for users are set by SCIM.');
        expect(helperText).not.toHaveTextContent('read-only');
    });

    it('makes no Client4 calls', () => {
        const getPluginStatuses = jest.spyOn(Client4, 'getPluginStatuses');
        const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField');

        renderComponent([plugin]);

        expect(getPluginStatuses).not.toHaveBeenCalled();
        expect(patchPropertyField).not.toHaveBeenCalled();
    });
});
