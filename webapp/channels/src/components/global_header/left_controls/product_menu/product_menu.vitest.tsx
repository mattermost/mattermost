// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {TopLevelProducts} from 'utils/constants';
import * as productUtils from 'utils/products';
import {TestHelper} from 'utils/test_helper';

import ProductMenu from './product_menu';

const spyProduct = vi.spyOn(productUtils, 'useCurrentProductId');
spyProduct.mockReturnValue(null);

describe('components/global/product_switcher', () => {
    beforeEach(() => {
        const products = [
            TestHelper.makeProduct(TopLevelProducts.BOARDS),
            TestHelper.makeProduct(TopLevelProducts.PLAYBOOKS),
        ];
        const spyProducts = vi.spyOn(productUtils, 'useProducts');
        spyProducts.mockReturnValue(products);
    });

    const getBaseState = (overrides = {}) => ({
        views: {
            productMenu: {
                switcherOpen: false,
            },
        },
        entities: {
            general: {
                license: {IsLicensed: 'true'},
                config: {},
            },
            users: {
                currentUserId: 'test_user_id',
                profiles: {
                    test_user_id: TestHelper.getUserMock({id: 'test_user_id'}),
                },
            },
            teams: {
                currentTeamId: 'team_id',
                teams: {
                    team_id: TestHelper.getTeamMock({id: 'team_id'}),
                },
            },
        },
        ...overrides,
    });

    it('should match snapshot', () => {
        const state = getBaseState();

        const {container} = renderWithContext(
            <ProductMenu/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    it('should match snapshot without license', () => {
        const state = getBaseState({
            entities: {
                general: {
                    license: {IsLicensed: 'false'},
                    config: {},
                },
                users: {
                    currentUserId: 'test_user_id',
                    profiles: {
                        test_user_id: TestHelper.getUserMock({id: 'test_user_id'}),
                    },
                },
                teams: {
                    currentTeamId: 'team_id',
                    teams: {
                        team_id: TestHelper.getTeamMock({id: 'team_id'}),
                    },
                },
            },
        });

        const {container} = renderWithContext(
            <ProductMenu/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    it('should render once when there are no top level products available', () => {
        const spyProducts = vi.spyOn(productUtils, 'useProducts');
        spyProducts.mockReturnValue([]);

        const state = getBaseState({
            views: {
                productMenu: {
                    switcherOpen: true,
                },
            },
        });

        const {container} = renderWithContext(
            <ProductMenu/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    it('should render the correct amount of times when there are products available', () => {
        const products = [
            TestHelper.makeProduct(TopLevelProducts.BOARDS),
            TestHelper.makeProduct(TopLevelProducts.PLAYBOOKS),
        ];
        const spyProducts = vi.spyOn(productUtils, 'useProducts');
        spyProducts.mockReturnValue(products);

        const state = getBaseState({
            views: {
                productMenu: {
                    switcherOpen: true,
                },
            },
        });

        const {container} = renderWithContext(
            <ProductMenu/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    it('should have an active button state when the switcher menu is open', () => {
        const state = getBaseState({
            views: {
                productMenu: {
                    switcherOpen: true,
                },
            },
        });

        const {container} = renderWithContext(
            <ProductMenu/>,
            state,
        );

        // The menu button should have aria-expanded=true when open
        const menuButton = container.querySelector('[aria-expanded="true"]');
        expect(menuButton).toBeInTheDocument();
    });

    it('should match snapshot with product switcher menu', () => {
        const state = getBaseState({
            views: {
                productMenu: {
                    switcherOpen: true,
                },
            },
        });

        const {container} = renderWithContext(
            <ProductMenu/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    it('should render ProductBrandingFreeEdition for Entry license', () => {
        const state = getBaseState({
            entities: {
                general: {
                    license: {IsLicensed: 'true', SkuShortName: 'entry'},
                    config: {},
                },
                users: {
                    currentUserId: 'test_user_id',
                    profiles: {
                        test_user_id: TestHelper.getUserMock({id: 'test_user_id'}),
                    },
                },
                teams: {
                    currentTeamId: 'team_id',
                    teams: {
                        team_id: TestHelper.getTeamMock({id: 'team_id'}),
                    },
                },
            },
        });

        renderWithContext(
            <ProductMenu/>,
            state,
        );

        // For entry license, should show ENTRY EDITION badge
        expect(screen.getByText('ENTRY EDITION')).toBeInTheDocument();
    });

    it('should render ProductBrandingFreeEdition for unlicensed', () => {
        const state = getBaseState({
            entities: {
                general: {
                    license: {IsLicensed: 'false'},
                    config: {},
                },
                users: {
                    currentUserId: 'test_user_id',
                    profiles: {
                        test_user_id: TestHelper.getUserMock({id: 'test_user_id'}),
                    },
                },
                teams: {
                    currentTeamId: 'team_id',
                    teams: {
                        team_id: TestHelper.getTeamMock({id: 'team_id'}),
                    },
                },
            },
        });

        renderWithContext(
            <ProductMenu/>,
            state,
        );

        // For unlicensed, should show TEAM EDITION badge
        expect(screen.getByText('TEAM EDITION')).toBeInTheDocument();
    });

    it('should render ProductBranding for Professional license', () => {
        const state = getBaseState({
            entities: {
                general: {
                    license: {IsLicensed: 'true', SkuShortName: 'professional'},
                    config: {},
                },
                users: {
                    currentUserId: 'test_user_id',
                    profiles: {
                        test_user_id: TestHelper.getUserMock({id: 'test_user_id'}),
                    },
                },
                teams: {
                    currentTeamId: 'team_id',
                    teams: {
                        team_id: TestHelper.getTeamMock({id: 'team_id'}),
                    },
                },
            },
        });

        renderWithContext(
            <ProductMenu/>,
            state,
        );

        // Should NOT show free edition badges for professional
        expect(screen.queryByText('ENTRY EDITION')).not.toBeInTheDocument();
        expect(screen.queryByText('TEAM EDITION')).not.toBeInTheDocument();
    });

    it('should render ProductBranding for Enterprise license', () => {
        const state = getBaseState({
            entities: {
                general: {
                    license: {IsLicensed: 'true', SkuShortName: 'enterprise'},
                    config: {},
                },
                users: {
                    currentUserId: 'test_user_id',
                    profiles: {
                        test_user_id: TestHelper.getUserMock({id: 'test_user_id'}),
                    },
                },
                teams: {
                    currentTeamId: 'team_id',
                    teams: {
                        team_id: TestHelper.getTeamMock({id: 'team_id'}),
                    },
                },
            },
        });

        renderWithContext(
            <ProductMenu/>,
            state,
        );

        // Should NOT show free edition badges for enterprise
        expect(screen.queryByText('ENTRY EDITION')).not.toBeInTheDocument();
        expect(screen.queryByText('TEAM EDITION')).not.toBeInTheDocument();
    });

    it('should match snapshot for Entry license', () => {
        const state = getBaseState({
            entities: {
                general: {
                    license: {IsLicensed: 'true', SkuShortName: 'entry'},
                    config: {},
                },
                users: {
                    currentUserId: 'test_user_id',
                    profiles: {
                        test_user_id: TestHelper.getUserMock({id: 'test_user_id'}),
                    },
                },
                teams: {
                    currentTeamId: 'team_id',
                    teams: {
                        team_id: TestHelper.getTeamMock({id: 'team_id'}),
                    },
                },
            },
        });

        const {container} = renderWithContext(
            <ProductMenu/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });
});
