// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import {getPluginIdFromEnableSettingId, PluginEnableButton} from './enable_plugin_button';

describe('components/admin_console/custom_plugin_settings/PluginEnableButton', () => {
    it('extracts plugin IDs from escaped plugin state setting paths', () => {
        expect(getPluginIdFromEnableSettingId('PluginSettings.PluginStates.com+mattermost+calls.Enable')).toBe('com.mattermost.calls');
        expect(getPluginIdFromEnableSettingId('invalid')).toBe('');
    });

    it('enables the plugin when clicked', async () => {
        const disablePlugin = jest.fn();
        const enablePlugin = jest.fn().mockResolvedValue({data: true});
        const removePlugin = jest.fn();

        renderWithContext(
            <PluginEnableButton
                id='PluginSettings.PluginStates.com+mattermost+calls.Enable'
                disabled={false}
                value={false}
                actions={{disablePlugin, enablePlugin, removePlugin}}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Enable plugin'}));

        expect(enablePlugin).toHaveBeenCalledWith('com.mattermost.calls');
        expect(disablePlugin).not.toHaveBeenCalled();
    });

    it('disables the plugin when clicked while enabled', async () => {
        const disablePlugin = jest.fn().mockResolvedValue({data: true});
        const enablePlugin = jest.fn();
        const removePlugin = jest.fn();

        renderWithContext(
            <PluginEnableButton
                id='PluginSettings.PluginStates.com+mattermost+calls.Enable'
                disabled={false}
                value={true}
                actions={{disablePlugin, enablePlugin, removePlugin}}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Disable plugin'}));

        expect(disablePlugin).toHaveBeenCalledWith('com.mattermost.calls');
        expect(enablePlugin).not.toHaveBeenCalled();
    });

    it('shows an error when enabling fails', async () => {
        const disablePlugin = jest.fn();
        const enablePlugin = jest.fn().mockResolvedValue({error: {message: 'Unable to enable plugin'}});
        const removePlugin = jest.fn();

        renderWithContext(
            <PluginEnableButton
                id='PluginSettings.PluginStates.com+mattermost+calls.Enable'
                disabled={false}
                value={false}
                actions={{disablePlugin, enablePlugin, removePlugin}}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Enable plugin'}));

        await waitFor(() => {
            expect(screen.getByText('Unable to enable plugin')).toBeInTheDocument();
        });
    });

    it('confirms before uninstalling the plugin', async () => {
        const disablePlugin = jest.fn();
        const enablePlugin = jest.fn();
        const removePlugin = jest.fn().mockResolvedValue({data: true});

        renderWithContext(
            <PluginEnableButton
                id='PluginSettings.PluginStates.com+mattermost+calls.Enable'
                disabled={false}
                value={false}
                actions={{disablePlugin, enablePlugin, removePlugin}}
            />,
        );

        await userEvent.click(screen.getByRole('button', {name: 'Uninstall plugin'}));

        expect(screen.getByText('Remove plugin?')).toBeInTheDocument();
        expect(screen.getByText('Are you sure you would like to remove the plugin?')).toBeInTheDocument();
        expect(removePlugin).not.toHaveBeenCalled();

        await userEvent.click(screen.getByRole('button', {name: 'Remove'}));

        expect(removePlugin).toHaveBeenCalledWith('com.mattermost.calls');
    });
});
