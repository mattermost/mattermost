// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {AppBinding} from '@mattermost/types/apps';

import {renderWithContext} from 'tests/react_testing_utils';

import AppBarBinding from './app_bar_binding';

describe('components/app_bar/AppBarBinding', () => {
    const baseBinding: AppBinding = {
        app_id: 'test-app',
        location: 'app_bar',
        label: 'Test App',
        icon: 'https://evil.example/icon.png',
    };

    test('omits img when BlockExternalImages is true and binding.icon is external', () => {
        const {container} = renderWithContext(
            <AppBarBinding binding={baseBinding}/>,
            {
                entities: {
                    general: {
                        config: {
                            BlockExternalImages: 'true',
                            SiteURL: 'https://mm.example.com',
                        },
                    },
                },
            },
        );

        expect(container.querySelector('img')).toBeNull();
    });

    test('renders img when BlockExternalImages is true and binding.icon is internal', () => {
        const {container} = renderWithContext(
            <AppBarBinding binding={{...baseBinding, icon: 'https://mm.example.com/static/icon.png'}}/>,
            {
                entities: {
                    general: {
                        config: {
                            BlockExternalImages: 'true',
                            SiteURL: 'https://mm.example.com',
                        },
                    },
                },
            },
        );

        expect(container.querySelector('img')).toHaveAttribute('src', 'https://mm.example.com/static/icon.png');
    });

    test('renders img when BlockExternalImages is false and binding.icon is external', () => {
        const {container} = renderWithContext(
            <AppBarBinding binding={baseBinding}/>,
            {
                entities: {
                    general: {
                        config: {
                            BlockExternalImages: 'false',
                            SiteURL: 'https://mm.example.com',
                        },
                    },
                },
            },
        );

        expect(container.querySelector('img')).toHaveAttribute('src', 'https://evil.example/icon.png');
    });
});
