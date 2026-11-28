// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {CloudState} from '@mattermost/types/cloud';
import type {PluginSettings} from '@mattermost/types/config';

import CustomPluginSettings from 'components/admin_console/custom_plugin_settings/custom_plugin_settings';

import {screen, renderWithContext} from 'tests/react_testing_utils';

function CustomSection(props: {settingsList: React.ReactNode[]}) {
    return (<div>{'Custom Section'} {props.settingsList}</div>);
}

function CustomSetting() {
    return (<div>{'Custom Setting'}</div>);
}

describe('custom plugin sections', () => {
    let config: {PluginSettings: PluginSettings};

    const baseProps = {
        isDisabled: false,
        environmentConfig: {},
        setNavigationBlocked: jest.fn(),
        roles: {},
        cloud: {} as CloudState,
        license: {},
        editRole: jest.fn(),
        consoleAccess: {read: {}, write: {}},
        isCurrentUserSystemAdmin: false,
        enterpriseReady: false,
    };

    beforeEach(() => {
        config = {
            PluginSettings: {
                Plugins: {},
            } as unknown as PluginSettings,
        };
    });

    it('empty sections', () => {
        const schema = {
            id: 'testplugin',
            name: 'testplugin',
            description: '',
            version: '',
            active: true,
            webapp: {
                bundle_path: '/static/testplugin_bundle.js',
            },
            sections: [],
        };

        renderWithContext(
            <CustomPluginSettings
                {...baseProps}
                config={config}
                schema={schema}
                patchConfig={jest.fn()}
            />,
        );
        expect(screen.getByText('testplugin')).toBeInTheDocument();
    });

    it('render sections', () => {
        const schema = {
            id: 'testplugin',
            name: 'testplugin',
            description: '',
            version: '',
            active: true,
            webapp: {
                bundle_path: '/static/testplugin_bundle.js',
            },
            sections: [
                {
                    key: 'section1',
                    title: 'Section 1',
                    settings: [],
                    header: 'Section1 Header',
                    footer: 'Section1 Footer',
                },
                {
                    key: 'section2',
                    title: 'Section 2',
                    settings: [
                        {
                            key: 'section2setting1',
                            label: 'Section 2 Setting 1',
                            type: 'text' as const,
                            help_text: 'Section 2 Setting 1 Help Text',
                        },
                    ],
                    header: 'Section2 Header',
                    footer: 'Section2 Footer',
                },
                {
                    key: 'section3',
                    settings: [],
                },
            ],
        };

        renderWithContext(
            <CustomPluginSettings
                {...baseProps}
                config={config}
                schema={schema}
                patchConfig={jest.fn()}
            />,
        );

        expect(screen.getByText('testplugin')).toBeInTheDocument();

        expect(screen.getByText('Section 1')).toBeInTheDocument();
        expect(screen.getByText('Section1 Header')).toBeInTheDocument();
        expect(screen.getByText('Section1 Footer')).toBeInTheDocument();

        expect(screen.getByText('Section 2')).toBeInTheDocument();
        expect(screen.getByText('Section2 Header')).toBeInTheDocument();
        expect(screen.getByText('Section2 Footer')).toBeInTheDocument();
        expect(screen.getByText('Section 2 Setting 1')).toBeInTheDocument();
        expect(screen.getByText('Section 2 Setting 1 Help Text')).toBeInTheDocument();

        expect(screen.queryByText('Section 3')).not.toBeInTheDocument();
    });

    it('custom sections and settings', () => {
        const schema = {
            id: 'testplugin',
            name: 'testplugin',
            description: '',
            version: '',
            active: true,
            webapp: {
                bundle_path: '/static/testplugin_bundle.js',
            },
            sections: [
                {
                    key: 'section1',
                    title: 'Custom Section 1',
                    settings: [
                        {
                            key: 'customsectionnumbersetting',
                            label: 'Custom Section Number Setting',
                            type: 'number' as const,
                            help_text: 'Custom Section Number Setting Help Text',
                        },
                        {
                            key: 'customsectioncustomsetting',
                            type: 'custom' as const,
                            component: CustomSetting,
                        },
                    ],
                    custom: true,
                    component: CustomSection,
                },
                {
                    key: 'section2',
                    title: 'Section 2',
                    settings: [
                        {
                            key: 'section2setting1',
                            label: 'Section 2 Setting 1',
                            type: 'text' as const,
                            help_text: 'Section 2 Setting 1 Help Text',
                        },
                    ],
                    header: 'Section2 Header',
                    footer: 'Section2 Footer',
                },
            ],
        };

        renderWithContext(
            <CustomPluginSettings
                {...baseProps}
                config={config}
                schema={schema}
                patchConfig={jest.fn()}
            />,
        );

        expect(screen.getByText('testplugin')).toBeInTheDocument();

        expect(screen.getByText('Custom Section')).toBeInTheDocument();
        expect(screen.getByText('Custom Section Number Setting')).toBeInTheDocument();
        expect(screen.getByText('Custom Section Number Setting Help Text')).toBeInTheDocument();
        expect(screen.getByText('Custom Setting')).toBeInTheDocument();

        expect(screen.getByText('Section 2')).toBeInTheDocument();
        expect(screen.getByText('Section2 Header')).toBeInTheDocument();
        expect(screen.getByText('Section2 Footer')).toBeInTheDocument();
        expect(screen.getByText('Section 2 Setting 1')).toBeInTheDocument();
        expect(screen.getByText('Section 2 Setting 1 Help Text')).toBeInTheDocument();
    });
});
