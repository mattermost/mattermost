// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {samplePlugin1, samplePlugin2, samplePlugin3, samplePlugin4} from '../tests/helpers/admin_console_plugin_index_sample_pluings';

import {getPluginEntries} from './admin_console_plugin_index';

describe('AdminConsolePluginsIndex.getPluginEntries', () => {
    it('should return an empty map in case of plugins is undefined', () => {
        const entries = getPluginEntries();
        expect(entries).toEqual({});
    });

    it('should return an empty map in case of plugins is undefined', () => {
        const entries = getPluginEntries(undefined);
        expect(entries).toEqual({});
    });

    it('should return an empty map in case of plugins is empty', () => {
        const entries = getPluginEntries({});
        expect(entries).toEqual({});
    });

    it('should return map with the text extracted from plugins', () => {
        const entries = getPluginEntries({[samplePlugin1.id]: samplePlugin1});
        expect(entries).toMatchSnapshot();
        expect(entries).toHaveProperty('plugin_mattermost-autolink');
    });

    it('should return map with the text extracted from plugins', () => {
        const entries = getPluginEntries({[samplePlugin1.id]: samplePlugin1, [samplePlugin2.id]: samplePlugin2});
        expect(entries).toMatchSnapshot();
        expect(entries).toHaveProperty('plugin_mattermost-autolink');
        expect(entries).toHaveProperty('plugin_Some-random-plugin');
    });

    it('should not return the markdown link texts', () => {
        const entries = getPluginEntries({[samplePlugin3.id]: samplePlugin3});
        expect(entries).toHaveProperty('plugin_plugin-with-markdown');
        expect(entries['plugin_plugin-with-markdown']).toContain('click here');
        expect(entries['plugin_plugin-with-markdown']).toContain('Markdown plugin label');
        expect(entries['plugin_plugin-with-markdown']).not.toContain('localhost');
    });

    it('should extract the text from label field', () => {
        const entries = getPluginEntries({[samplePlugin3.id]: samplePlugin3});
        expect(entries).toHaveProperty('plugin_plugin-with-markdown');
        expect(entries['plugin_plugin-with-markdown']).toContain('Markdown plugin label');
    });

    it('should index the enable plugin setting', () => {
        const entries = getPluginEntries({[samplePlugin3.id]: samplePlugin3});
        expect(entries).toHaveProperty('plugin_plugin-with-markdown');
        expect(entries['plugin_plugin-with-markdown']).toContain('admin.plugin.enable_plugin');
        expect(entries['plugin_plugin-with-markdown']).toContain('PluginSettings.PluginStates.plugin-with-markdown.Enable');
    });

    it('should index the enable plugin setting even if other settings are not present', () => {
        const entries = getPluginEntries({[samplePlugin4.id]: samplePlugin4});
        expect(entries).toHaveProperty('plugin_plugin-without-settings');
        expect(entries['plugin_plugin-without-settings']).toContain('admin.plugin.enable_plugin');
        expect(entries['plugin_plugin-without-settings']).toContain('PluginSettings.PluginStates.plugin-without-settings.Enable');
    });
});
