// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import AttributePluginSource from './attribute_plugin_source';

describe('AttributePluginSource', () => {
    const renderComponent = (
        props: Partial<React.ComponentProps<typeof AttributePluginSource>> = {},
        pluginDisplayName?: string,
    ) => {
        return renderWithContext(
            <AttributePluginSource
                pluginId='test-plugin'
                isOrphaned={false}
                {...props}
            />,
            pluginDisplayName ? {
                entities: {
                    admin: {
                        pluginStatuses: {
                            'test-plugin': {name: pluginDisplayName} as never,
                        },
                    },
                },
            } : undefined,
        );
    };

    it('renders the resolved plugin name and a settings link when not orphaned', () => {
        renderComponent({isOrphaned: false}, 'Test Plugin');

        expect(screen.getByTestId('attributePluginSourceManagedBy')).toHaveTextContent('Managed by Test Plugin');

        const link = screen.getByTestId('attributePluginSourceLink');
        expect(link).toHaveAttribute('href', '/admin_console/plugins/plugin_test-plugin');
        expect(link).toHaveTextContent('Plugin settings');
    });

    it('renders the orphaned copy with no settings link when orphaned', () => {
        renderComponent({isOrphaned: true}, 'Test Plugin');

        expect(screen.getByTestId('attributePluginSourceManagedBy')).toHaveTextContent('Managed by Test Plugin (no longer installed)');
        expect(screen.queryByTestId('attributePluginSourceLink')).not.toBeInTheDocument();
    });

    it('renders the read-only helper text regardless of orphan status', () => {
        renderComponent({isOrphaned: false});
        expect(screen.getByTestId('attributePluginSourceHelperText')).toHaveTextContent('Name, type, and values are owned by the plugin and are read-only here.');

        renderComponent({isOrphaned: true});
        expect(screen.getAllByTestId('attributePluginSourceHelperText')[1]).toHaveTextContent('Name, type, and values are owned by the plugin and are read-only here.');
    });

    it('falls back to the raw plugin id when the plugin name cannot be resolved', () => {
        renderComponent({pluginId: 'unresolved-plugin', isOrphaned: false});

        expect(screen.getByTestId('attributePluginSourceManagedBy')).toHaveTextContent('Managed by unresolved-plugin');
    });

    it('makes no Client4 or data-mutating dispatch calls', () => {
        const getPluginStatuses = jest.spyOn(Client4, 'getPluginStatuses');
        const deletePropertyField = jest.spyOn(Client4, 'deletePropertyField');
        const patchPropertyField = jest.spyOn(Client4, 'patchPropertyField');

        renderComponent({isOrphaned: false}, 'Test Plugin');
        renderComponent({isOrphaned: true}, 'Test Plugin');

        expect(getPluginStatuses).not.toHaveBeenCalled();
        expect(deletePropertyField).not.toHaveBeenCalled();
        expect(patchPropertyField).not.toHaveBeenCalled();
    });
});
