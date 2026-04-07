// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ProductBrandingFreeEdition from './product_branding_free_edition';

describe('ProductBrandingFreeEdition', () => {
    const baseProps = {};

    test('should show ENTRY EDITION for Entry license', async () => {
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

        const {container} = await renderWithContext(
            <ProductBrandingFreeEdition {...baseProps}/>,
            state,
        );

        expect(screen.getByText('ENTRY EDITION')).toBeInTheDocument();
        const logoElement = container.querySelector('svg');
        expect(logoElement).toBeInTheDocument();
    });

    test('should show TEAM EDITION for unlicensed', async () => {
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

        const {container} = await renderWithContext(
            <ProductBrandingFreeEdition {...baseProps}/>,
            state,
        );

        expect(screen.getByText('TEAM EDITION')).toBeInTheDocument();
        const logoElement = container.querySelector('svg');
        expect(logoElement).toBeInTheDocument();
    });

    test('should show empty badge for Professional license', async () => {
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

        await renderWithContext(
            <ProductBrandingFreeEdition {...baseProps}/>,
            state,
        );

        // Should not show any edition badge
        expect(screen.queryByText('ENTRY EDITION')).not.toBeInTheDocument();
        expect(screen.queryByText('TEAM EDITION')).not.toBeInTheDocument();
        expect(screen.queryByText('PROFESSIONAL EDITION')).not.toBeInTheDocument();
    });

    test('should show empty badge for Enterprise license', async () => {
        const state = {
            entities: {
                general: {
                    license: TestHelper.getLicenseMock({
                        IsLicensed: 'true',
                        SkuShortName: 'enterprise',
                    }),
                },
            },
        };

        await renderWithContext(
            <ProductBrandingFreeEdition {...baseProps}/>,
            state,
        );

        // Should not show any edition badge
        expect(screen.queryByText('ENTRY EDITION')).not.toBeInTheDocument();
        expect(screen.queryByText('TEAM EDITION')).not.toBeInTheDocument();
        expect(screen.queryByText('ENTERPRISE EDITION')).not.toBeInTheDocument();
    });

    test('should show empty badge when no license object', async () => {
        const state = {
            entities: {
                general: {
                    license: {},
                },
            },
        };

        await renderWithContext(
            <ProductBrandingFreeEdition {...baseProps}/>,
            state,
        );

        // Should not show any edition badge when license object is empty
        expect(screen.queryByText('ENTRY EDITION')).not.toBeInTheDocument();
        expect(screen.queryByText('TEAM EDITION')).not.toBeInTheDocument();
    });
});
