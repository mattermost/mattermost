// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TopLevelProducts} from 'utils/constants';
import * as productUtils from 'utils/products';
import {TestHelper} from 'utils/test_helper';

import ProductMenu from './product_menu';

jest.mock('./product_branding', () => {
    return function MockProductBranding() {
        return <div data-testid='product-branding'/>;
    };
});

jest.mock('./product_branding_team_edition', () => {
    return function MockProductBrandingFreeEdition() {
        return <div data-testid='product-branding-free-edition'/>;
    };
});

jest.mock('./product_menu_list', () => {
    return function MockProductMenuList() {
        return <div data-testid='product-menu-list'/>;
    };
});

jest.mock('components/onboarding_tasks', () => ({
    OnboardingTaskCategory: 'onboardingTask',
    OnboardingTasksName: {VISIT_SYSTEM_CONSOLE: 'visit_system_console'},
    TaskNameMapToSteps: {visit_system_console: {FINISHED: 999}},
    useHandleOnBoardingTaskData: () => jest.fn(),
}));

const spyProduct = jest.spyOn(productUtils, 'useCurrentProductId');
spyProduct.mockReturnValue(null);

describe('components/global/product_switcher', () => {
    beforeEach(() => {
        const products = [
            TestHelper.makeProduct(TopLevelProducts.BOARDS),
            TestHelper.makeProduct(TopLevelProducts.PLAYBOOKS),
        ];
        const spyProducts = jest.spyOn(productUtils, 'useProducts');
        spyProducts.mockReturnValue(products);
    });

    const baseState = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                },
            },
        },
        views: {
            productMenu: {
                switcherOpen: false,
            },
        },
    };

    it('should match snapshot', () => {
        const {container} = renderWithContext(
            <ProductMenu/>,
            baseState,
        );

        expect(container).toMatchSnapshot();
    });

    it('should match snapshot without license', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    ...baseState.entities.general,
                    license: {
                        IsLicensed: 'false',
                    },
                },
            },
        };

        const {container} = renderWithContext(
            <ProductMenu/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });

    it('should render once when there are no top level products available', () => {
        const state = {
            ...baseState,
            views: {
                ...baseState.views,
                productMenu: {
                    switcherOpen: true,
                },
            },
        };

        const {container} = renderWithContext(
            <ProductMenu/>,
            state,
        );

        const spyProducts = jest.spyOn(productUtils, 'useProducts');
        spyProducts.mockReturnValue([]);

        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems.length).toBeGreaterThanOrEqual(1);
        expect(menuItems.at(0)).toBeDefined();
        expect(container).toMatchSnapshot();
    });

    it('should render the correct amount of times when there are products available', () => {
        const state = {
            ...baseState,
            views: {
                ...baseState.views,
                productMenu: {
                    switcherOpen: true,
                },
            },
        };

        const products = [
            TestHelper.makeProduct(TopLevelProducts.BOARDS),
            TestHelper.makeProduct(TopLevelProducts.PLAYBOOKS),
        ];

        const spyProducts = jest.spyOn(productUtils, 'useProducts');
        spyProducts.mockReturnValue(products);

        const {container} = renderWithContext(
            <ProductMenu/>,
            state,
        );

        // Channels + 2 products
        expect(screen.getAllByRole('menuitem')).toHaveLength(3);
        expect(container).toMatchSnapshot();
    });

    it('should have an active button state when the switcher menu is open', () => {
        const state = {
            ...baseState,
            views: {
                ...baseState.views,
                productMenu: {
                    switcherOpen: true,
                },
            },
        };

        const {container} = renderWithContext(
            <ProductMenu/>,
            state,
        );

        const button = screen.getByRole('button', {name: 'Product switch menu'});
        expect(button).toHaveAttribute('aria-expanded', 'true');
        expect(container).toMatchSnapshot();
    });

    it('should match snapshot with product switcher menu', () => {
        const state = {
            ...baseState,
            views: {
                ...baseState.views,
                productMenu: {
                    switcherOpen: true,
                },
            },
        };

        const {container} = renderWithContext(
            <ProductMenu/>,
            state,
        );

        expect(screen.getByTestId('product-menu-list')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it('should render ProductBrandingFreeEdition for Entry license', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    ...baseState.entities.general,
                    license: {
                        IsLicensed: 'true',
                        SkuShortName: 'entry',
                    },
                },
            },
        };

        renderWithContext(
            <ProductMenu/>,
            state,
        );

        expect(screen.getByTestId('product-branding-free-edition')).toBeInTheDocument();
        expect(screen.queryByTestId('product-branding')).not.toBeInTheDocument();
    });

    it('should render ProductBrandingFreeEdition for unlicensed', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    ...baseState.entities.general,
                    license: {
                        IsLicensed: 'false',
                    },
                },
            },
        };

        renderWithContext(
            <ProductMenu/>,
            state,
        );

        expect(screen.getByTestId('product-branding-free-edition')).toBeInTheDocument();
        expect(screen.queryByTestId('product-branding')).not.toBeInTheDocument();
    });

    it('should render ProductBranding for Professional license', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    ...baseState.entities.general,
                    license: {
                        IsLicensed: 'true',
                        SkuShortName: 'professional',
                    },
                },
            },
        };

        renderWithContext(
            <ProductMenu/>,
            state,
        );

        expect(screen.getByTestId('product-branding')).toBeInTheDocument();
        expect(screen.queryByTestId('product-branding-free-edition')).not.toBeInTheDocument();
    });

    it('should render ProductBranding for Enterprise license', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    ...baseState.entities.general,
                    license: {
                        IsLicensed: 'true',
                        SkuShortName: 'enterprise',
                    },
                },
            },
        };

        renderWithContext(
            <ProductMenu/>,
            state,
        );

        expect(screen.getByTestId('product-branding')).toBeInTheDocument();
        expect(screen.queryByTestId('product-branding-free-edition')).not.toBeInTheDocument();
    });

    it('renders registered ProductSwitcherMenuItems that are not hidden', () => {
        const action = jest.fn();
        const state = {
            ...baseState,
            views: {...baseState.views, productMenu: {switcherOpen: true}},
            plugins: {
                components: {
                    ProductSwitcherMenuItem: [
                        {id: 'item-1', pluginId: 'test-plugin', text: 'My Plugin Item', icon: 'globe', action},
                    ],
                },
            },
        };

        renderWithContext(<ProductMenu/>, state);

        expect(screen.getByText('My Plugin Item')).toBeInTheDocument();
    });

    it('hides ProductSwitcherMenuItems where isHidden returns true', () => {
        const state = {
            ...baseState,
            views: {...baseState.views, productMenu: {switcherOpen: true}},
            plugins: {
                components: {
                    ProductSwitcherMenuItem: [
                        {
                            id: 'item-1',
                            pluginId: 'test-plugin',
                            text: 'Hidden Item',
                            icon: 'globe',
                            action: jest.fn(),
                            isHidden: () => true,
                        },
                    ],
                },
            },
        };

        renderWithContext(<ProductMenu/>, state);

        expect(screen.queryByText('Hidden Item')).not.toBeInTheDocument();
    });

    it('passes full Redux state to isHidden', () => {
        const isHidden = jest.fn(() => false);
        const state = {
            ...baseState,
            views: {...baseState.views, productMenu: {switcherOpen: true}},
            plugins: {
                components: {
                    ProductSwitcherMenuItem: [
                        {id: 'item-1', pluginId: 'test-plugin', text: 'Gated Item', icon: 'globe', action: jest.fn(), isHidden},
                    ],
                },
            },
        };

        renderWithContext(<ProductMenu/>, state);

        expect(screen.getByText('Gated Item')).toBeInTheDocument();
        expect(isHidden).toHaveBeenCalledWith(
            expect.objectContaining({
                entities: expect.any(Object),
                plugins: expect.any(Object),
            }),
        );
    });

    it('renders no separator when all items are hidden by isHidden', () => {
        const state = {
            ...baseState,
            views: {...baseState.views, productMenu: {switcherOpen: true}},
            plugins: {
                components: {
                    ProductSwitcherMenuItem: [
                        {
                            id: 'item-1',
                            pluginId: 'test-plugin',
                            text: 'Hidden Item',
                            icon: 'globe',
                            action: jest.fn(),
                            isHidden: () => true,
                        },
                    ],
                },
            },
        };

        renderWithContext(<ProductMenu/>, state);

        expect(screen.queryByRole('separator')).toBeNull();
    });

    it('hides ProductSwitcherMenuItems where isHidden throws', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const state = {
            ...baseState,
            views: {...baseState.views, productMenu: {switcherOpen: true}},
            plugins: {
                components: {
                    ProductSwitcherMenuItem: [
                        {
                            id: 'item-1',
                            pluginId: 'test-plugin',
                            text: 'Throwing Item',
                            icon: 'globe',
                            action: jest.fn(),
                            isHidden: () => {
                                throw new Error('test error');
                            },
                        },
                    ],
                },
            },
        };

        renderWithContext(<ProductMenu/>, state);

        expect(screen.queryByText('Throwing Item')).not.toBeInTheDocument();
        consoleSpy.mockRestore();
    });

    it('calls action and closes menu on item click', async () => {
        const action = jest.fn();
        const state = {
            ...baseState,
            views: {...baseState.views, productMenu: {switcherOpen: true}},
            plugins: {
                components: {
                    ProductSwitcherMenuItem: [
                        {id: 'item-1', pluginId: 'test-plugin', text: 'Clickable Item', icon: 'globe', action},
                    ],
                },
            },
        };

        renderWithContext(<ProductMenu/>, state);

        const item = screen.getByText('Clickable Item');
        await userEvent.click(item);

        expect(action).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByText('Clickable Item')).not.toBeInTheDocument());
    });

    it('should match snapshot with a registered ProductSwitcherMenuItem', () => {
        const state = {
            ...baseState,
            views: {...baseState.views, productMenu: {switcherOpen: true}},
            plugins: {
                components: {
                    ProductSwitcherMenuItem: [
                        {id: 'item-1', pluginId: 'test-plugin', text: 'Create Encrypted Channel', icon: 'shield-outline', action: jest.fn()},
                    ],
                },
            },
        };

        const {container} = renderWithContext(<ProductMenu/>, state);

        expect(container).toMatchSnapshot();
    });

    it('should match snapshot for Entry license', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    ...baseState.entities.general,
                    license: {
                        IsLicensed: 'true',
                        SkuShortName: 'entry',
                    },
                },
            },
        };

        const {container} = renderWithContext(
            <ProductMenu/>,
            state,
        );

        expect(container).toMatchSnapshot();
    });
});
