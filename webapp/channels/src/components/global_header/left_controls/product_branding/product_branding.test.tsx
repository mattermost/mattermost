// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TopLevelProducts} from 'utils/constants';
import * as productUtils from 'utils/products';
import {TestHelper} from 'utils/test_helper';

import type {ProductComponent} from 'types/store/plugins';

import {ProductBranding} from './product_branding';

// Compass icons render a bare <svg>, so the fallback icon needs a test id to be identifiable.
jest.mock('@mattermost/compass-icons/components', () => {
    const actual = jest.requireActual('@mattermost/compass-icons/components');
    return {
        ...actual,
        ProductChannelsIcon: (props: any) => (
            <svg
                data-testid='ProductChannelsIcon'
                {...props}
            />
        ),
    };
});

describe('ProductBranding', () => {
    // Anything licensed other than Entry renders the licensed-edition branding,
    // which is the variant that shows the current product's icon and name.
    const licensedState = {
        entities: {
            general: {
                license: TestHelper.getLicenseMock({
                    IsLicensed: 'true',
                    SkuShortName: 'professional',
                }),
            },
        },
    };

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

        expect(screen.getAllByText('Channels').length).toBeGreaterThan(0);
    });

    test('should show Playbooks when on Playbooks product', () => {
        jest.spyOn(productUtils, 'useCurrentProduct').mockReturnValue(
            TestHelper.makeProduct(TopLevelProducts.PLAYBOOKS),
        );

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

        expect(screen.getAllByText('Playbooks').length).toBeGreaterThan(0);
    });

    test('should show Boards when on Boards product', () => {
        jest.spyOn(productUtils, 'useCurrentProduct').mockReturnValue(
            TestHelper.makeProduct(TopLevelProducts.BOARDS),
        );

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

        expect(screen.getAllByText('Boards').length).toBeGreaterThan(0);
    });

    test('should render a React element icon when switcherIcon is a React node', () => {
        const CustomIcon = (
            <svg data-testid='custom-icon'>
                <circle
                    cx='12'
                    cy='12'
                    r='10'
                />
            </svg>
        );

        jest.spyOn(productUtils, 'useCurrentProduct').mockReturnValue({
            ...TestHelper.makeProduct('CustomProduct'),
            switcherIcon: CustomIcon as unknown as ProductComponent['switcherIcon'],
        });

        renderWithContext(<ProductBranding/>, licensedState);

        expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    });

    test('should fall back to the Channels icon when the icon name is not in the glyph map', () => {
        jest.spyOn(productUtils, 'useCurrentProduct').mockReturnValue({
            ...TestHelper.makeProduct('InvalidProduct'),
            switcherIcon: 'non-existent-icon-name' as ProductComponent['switcherIcon'],
        });

        renderWithContext(<ProductBranding/>, licensedState);

        expect(screen.getByTestId('ProductChannelsIcon')).toBeInTheDocument();
    });

    test('should not render an edition badge for Enterprise license', () => {
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

        jest.spyOn(productUtils, 'useCurrentProduct').mockReturnValue(null);

        renderWithContext(<ProductBranding/>, state);

        expect(screen.queryByText('ENTRY EDITION')).not.toBeInTheDocument();
        expect(screen.queryByText('TEAM EDITION')).not.toBeInTheDocument();
    });

    test('should not render an edition badge when the license object is empty', () => {
        const state = {
            entities: {
                general: {
                    license: {},
                },
            },
        };

        renderWithContext(<ProductBranding/>, state);

        expect(screen.queryByText('ENTRY EDITION')).not.toBeInTheDocument();
        expect(screen.queryByText('TEAM EDITION')).not.toBeInTheDocument();
    });
});
