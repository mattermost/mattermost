// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {act, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {ChannelSettingsSchema, ChannelSettingsTabHandlers} from 'types/plugins/channel_settings';

import ChannelSettingsPluginSchemaTab from './channel_settings_plugin_schema_tab';

describe('ChannelSettingsPluginSchemaTab', () => {
    const channel = TestHelper.getChannelMock({id: 'channel-1'});

    function makeSchema(onSave: jest.Mock): ChannelSettingsSchema {
        return {
            uiName: 'Schema Tab',
            sections: [
                {
                    title: 'Appearance',
                    settings: [
                        {
                            name: 'color',
                            title: 'Color',
                            type: 'radio',
                            default: 'red',
                            options: [
                                {value: 'red', text: 'Red'},
                                {value: 'blue', text: 'Blue'},
                            ],
                        },
                    ],
                },
            ],
            onSave,
        };
    }

    function setup() {
        const onSave = jest.fn(async () => {});
        const setUnsaved = jest.fn();
        let handlers: ChannelSettingsTabHandlers | null = null;
        const registerHandlers = jest.fn((h: ChannelSettingsTabHandlers | null) => {
            handlers = h;
        });

        renderWithContext(
            <ChannelSettingsPluginSchemaTab
                schema={makeSchema(onSave)}
                pluginId='plugin-a'
                channel={channel}
                setUnsaved={setUnsaved}
                registerHandlers={registerHandlers}
            />,
        );

        return {onSave, setUnsaved, registerHandlers, getHandlers: () => handlers};
    }

    it('renders the section title and radio options with the default selected', () => {
        setup();

        expect(screen.getByText('Appearance')).toBeInTheDocument();
        expect(screen.getByRole('radio', {name: 'Red'})).toBeChecked();
        expect(screen.getByRole('radio', {name: 'Blue'})).not.toBeChecked();
    });

    it('registers handlers and reports unsaved changes when a value changes', async () => {
        const {setUnsaved, registerHandlers} = setup();

        expect(registerHandlers).toHaveBeenCalled();
        expect(setUnsaved).toHaveBeenLastCalledWith(false);

        await userEvent.click(screen.getByRole('radio', {name: 'Blue'}));

        await waitFor(() => {
            expect(setUnsaved).toHaveBeenLastCalledWith(true);
        });
    });

    it('collects the current values and passes them to onSave', async () => {
        const {onSave, getHandlers} = setup();

        await userEvent.click(screen.getByRole('radio', {name: 'Blue'}));

        await act(async () => {
            await getHandlers()?.save();
        });

        expect(onSave).toHaveBeenCalledWith({color: 'blue'}, channel);
    });

    it('restores the baseline values on reset', async () => {
        const {getHandlers} = setup();

        await userEvent.click(screen.getByRole('radio', {name: 'Blue'}));
        expect(screen.getByRole('radio', {name: 'Blue'})).toBeChecked();

        act(() => {
            getHandlers()?.reset();
        });

        await waitFor(() => {
            expect(screen.getByRole('radio', {name: 'Red'})).toBeChecked();
        });
    });

    function setupWithLoadValues(loadValues: ChannelSettingsSchema['loadValues']) {
        const onSave = jest.fn(async () => {});
        const setUnsaved = jest.fn();
        let handlers: ChannelSettingsTabHandlers | null = null;
        const registerHandlers = jest.fn((h: ChannelSettingsTabHandlers | null) => {
            handlers = h;
        });

        renderWithContext(
            <ChannelSettingsPluginSchemaTab
                schema={{...makeSchema(onSave), loadValues}}
                pluginId='plugin-a'
                channel={channel}
                setUnsaved={setUnsaved}
                registerHandlers={registerHandlers}
            />,
        );

        return {onSave, setUnsaved, registerHandlers, getHandlers: () => handlers};
    }

    it('hydrates the initial selection from loadValues', async () => {
        const loadValues = jest.fn(async () => ({color: 'blue'}));
        const {setUnsaved} = setupWithLoadValues(loadValues);

        await waitFor(() => {
            expect(screen.getByRole('radio', {name: 'Blue'})).toBeChecked();
        });

        expect(loadValues).toHaveBeenCalledWith(channel);

        // The hydrated values are the clean baseline, so the tab is not dirty.
        expect(setUnsaved).toHaveBeenLastCalledWith(false);
    });

    it('resets to the hydrated baseline rather than the schema default', async () => {
        const loadValues = jest.fn(async () => ({color: 'blue'}));
        const {getHandlers} = setupWithLoadValues(loadValues);

        await waitFor(() => {
            expect(screen.getByRole('radio', {name: 'Blue'})).toBeChecked();
        });

        await userEvent.click(screen.getByRole('radio', {name: 'Red'}));
        expect(screen.getByRole('radio', {name: 'Red'})).toBeChecked();

        act(() => {
            getHandlers()?.reset();
        });

        await waitFor(() => {
            expect(screen.getByRole('radio', {name: 'Blue'})).toBeChecked();
        });
    });

    it('falls back to schema defaults when loadValues rejects', async () => {
        const loadValues = jest.fn(async () => {
            throw new Error('load failed');
        });
        setupWithLoadValues(loadValues);

        await waitFor(() => {
            expect(screen.getByRole('radio', {name: 'Red'})).toBeChecked();
        });
    });
});
