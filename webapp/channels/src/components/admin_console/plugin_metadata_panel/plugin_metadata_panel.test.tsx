// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PluginMetadataPanel, {formatPluginVersion} from 'components/admin_console/plugin_metadata_panel/plugin_metadata_panel';

import {screen, renderWithContext} from 'tests/react_testing_utils';

describe('formatPluginVersion', () => {
    test('should prefix version with v when missing', () => {
        expect(formatPluginVersion('0.7.4')).toBe('v0.7.4');
        expect(formatPluginVersion('1.2.3')).toBe('v1.2.3');
    });

    test('should not duplicate v prefix', () => {
        expect(formatPluginVersion('v0.7.4')).toBe('v0.7.4');
        expect(formatPluginVersion('V1.0.0')).toBe('V1.0.0');
    });
});

describe('PluginMetadataPanel', () => {
    test('should render plugin name, id, and version on one line', () => {
        renderWithContext(
            <PluginMetadataPanel
                name='FL3XX'
                id='com.mattermost.fl3xx'
                version='0.7.4'
            />,
        );

        expect(screen.getByTestId('plugin-metadata-panel')).toHaveTextContent('FL3XX (com.mattermost.fl3xx - v0.7.4)');
        expect(screen.getByTestId('plugin-metadata-id')).toHaveTextContent('com.mattermost.fl3xx');
        expect(screen.getByTestId('plugin-metadata-version')).toHaveTextContent('v0.7.4');
        expect(screen.getByRole('button', {name: 'Copy'})).toHaveTextContent('com.mattermost.fl3xx');
    });

    test('should fall back to plugin id when display name is missing', () => {
        renderWithContext(
            <PluginMetadataPanel
                name='   '
                id='com.mattermost.fl3xx'
                version='0.7.4'
            />,
        );

        expect(screen.getByTestId('plugin-metadata-panel')).toHaveTextContent('com.mattermost.fl3xx (com.mattermost.fl3xx - v0.7.4)');
        expect(screen.getByText('com.mattermost.fl3xx', {selector: 'strong'})).toBeInTheDocument();
    });

    test('should omit version segment when version is missing', () => {
        renderWithContext(
            <PluginMetadataPanel
                name='FL3XX'
                id='com.mattermost.fl3xx'
                version=''
            />,
        );

        expect(screen.getByTestId('plugin-metadata-panel')).toHaveTextContent('FL3XX (com.mattermost.fl3xx)');
        expect(screen.queryByTestId('plugin-metadata-version')).not.toBeInTheDocument();
    });

    test('should link display name to website and version to release notes when provided', () => {
        renderWithContext(
            <PluginMetadataPanel
                name='Agents Plugin'
                id='com.mattermost.ai'
                version='1.2.3'
                homepageUrl='https://github.com/mattermost/mattermost-plugin-ai'
                releaseNotesUrl='https://github.com/mattermost/mattermost-plugin-ai/releases/tag/v1.2.3'
            />,
        );

        expect(screen.getByRole('link', {name: 'Agents Plugin'})).toHaveAttribute('href', 'https://github.com/mattermost/mattermost-plugin-ai');
        expect(screen.getByRole('link', {name: 'v1.2.3'})).toHaveAttribute('href', 'https://github.com/mattermost/mattermost-plugin-ai/releases/tag/v1.2.3');
        expect(screen.queryByText('release notes')).not.toBeInTheDocument();
    });

    test('should not render links when urls are not provided', () => {
        renderWithContext(
            <PluginMetadataPanel
                name='Agents Plugin'
                id='com.mattermost.ai'
                version='1.2.3'
            />,
        );

        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
});
