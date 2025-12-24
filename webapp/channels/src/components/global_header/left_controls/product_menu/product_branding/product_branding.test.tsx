// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TopLevelProducts} from 'utils/constants';
import * as productUtils from 'utils/products';
import {TestHelper} from 'utils/test_helper';

import {ProductBranding} from './product_branding';

describe('ProductBranding', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should render TEAM EDITION for unlicensed users', () => {
        const state = {
            entities: {
                general: {
                    license: TestHelper.getLicenseMock({
                        IsLicensed: 'false',
                        SkuShortName: '',
                    }),
                },
            },
        };

        renderWithContext(<ProductBranding/>, state);

        expect(screen.getByText('TEAM EDITION')).toBeInTheDocument();
    });

    test('should render ENTRY EDITION for Entry license', () => {
        const state = {
            entities: {
                general: {
                    license: TestHelper.getLicenseMock({
                        IsLicensed: 'true',
                        SkuShortName: 'entry',
                    }),
                },
            },
        };

        renderWithContext(<ProductBranding/>, state);

        expect(screen.getByText('ENTRY EDITION')).toBeInTheDocument();
    });

    test('should not render a license name for a licensed edition that is not Entry', () => {
        jest.spyOn(productUtils, 'useCurrentProduct').mockReturnValue(null);

        const state = {
            entities: {
                general: {
                    license: TestHelper.getLicenseMock({
                        IsLicensed: 'true',
                        SkuShortName: 'professional',
                    }),
                },
            },
        };

        renderWithContext(<ProductBranding/>, state);

        expect(screen.queryByText('TEAM EDITION')).not.toBeInTheDocument();
        expect(screen.queryByText('ENTRY EDITION')).not.toBeInTheDocument();
        expect(screen.queryByText('PROFESSIONAL')).not.toBeInTheDocument();
    });

    test('should show Channels when on Channels product', () => {
        jest.spyOn(productUtils, 'useCurrentProduct').mockReturnValue(null);

        renderWithContext(<ProductBranding/>);

        expect(screen.getAllByText('Channels').length).toBeGreaterThan(0);
    });

    test('should show Playbooks when on Playbooks product', () => {
        jest.spyOn(productUtils, 'useCurrentProduct').mockReturnValue(
            TestHelper.makeProduct(TopLevelProducts.PLAYBOOKS),
        );

        renderWithContext(<ProductBranding/>);

        expect(screen.getAllByText('Playbooks').length).toBeGreaterThan(0);
    });

    test('should show Boards when on Boards product', () => {
        jest.spyOn(productUtils, 'useCurrentProduct').mockReturnValue(
            TestHelper.makeProduct(TopLevelProducts.BOARDS),
        );

        renderWithContext(<ProductBranding/>);

        expect(screen.getAllByText('Boards').length).toBeGreaterThan(0);
    });
});
