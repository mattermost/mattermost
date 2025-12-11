// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import MenuStartTrial from './menu_start_trial';

describe('components/widgets/menu/menu_items/menu_start_trial', () => {
    test('should render TEAM EDITION for unlicensed', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: 'test_id',
                },
                general: {
                    license: TestHelper.getLicenseMock({
                        IsLicensed: 'false',
                        SkuShortName: '',
                    }),
                },
            },
        };
        const {container} = renderWithContext(<MenuStartTrial id='startTrial'/>, state);

        expect(container.querySelector('.editionText')).toBeInTheDocument();
        expect(screen.getByText(/TEAM EDITION/)).toBeInTheDocument();
        expect(screen.getByText(/This is the free/)).toBeInTheDocument();
    });

    test('should render ENTRY EDITION for Entry license', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: 'test_id',
                },
                general: {
                    license: TestHelper.getLicenseMock({
                        IsLicensed: 'true',
                        SkuShortName: 'entry',
                    }),
                },
            },
        };
        const {container} = renderWithContext(<MenuStartTrial id='startTrial'/>, state);

        expect(container.querySelector('.editionText')).toBeInTheDocument();
        expect(screen.getByText(/ENTRY EDITION/)).toBeInTheDocument();
        expect(screen.getByText(/Entry offers Enterprise Advance capabilities/)).toBeInTheDocument();
    });

    test('should return null for Professional license', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: 'test_id',
                },
                general: {
                    license: TestHelper.getLicenseMock({
                        IsLicensed: 'true',
                        SkuShortName: 'professional',
                    }),
                },
            },
        };
        const {container} = renderWithContext(<MenuStartTrial id='startTrial'/>, state);

        expect(container.firstChild).toBeNull();
    });

    test('should return null for Enterprise license', () => {
        const state = {
            entities: {
                users: {
                    currentUserId: 'test_id',
                },
                general: {
                    license: TestHelper.getLicenseMock({
                        IsLicensed: 'true',
                        SkuShortName: 'enterprise',
                    }),
                },
            },
        };
        const {container} = renderWithContext(<MenuStartTrial id='startTrial'/>, state);

        expect(container.firstChild).toBeNull();
    });
});
