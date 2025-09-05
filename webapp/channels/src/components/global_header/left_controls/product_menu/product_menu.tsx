// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {
    ProductsIcon,
} from '@mattermost/compass-icons/components';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {setProductMenuSwitcherOpen} from 'actions/views/product_menu';
import {isSwitcherOpen} from 'selectors/views/product_menu';

import {
    OnboardingTaskCategory,
    OnboardingTasksName,
    TaskNameMapToSteps,
    useHandleOnBoardingTaskData,
} from 'components/onboarding_tasks';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import {useCurrentProductId, useProducts, isChannels} from 'utils/products';

import ProductBranding from './product_branding';
import ProductBrandingTeamEdition from './product_branding_team_edition';
import ProductMenuItem from './product_menu_item';
import ProductMenuList from './product_menu_list';

import {useClickOutsideRef} from '../../hooks';

export const ProductMenuContainer = styled.nav`
    display: flex;
    align-items: center;
    cursor: pointer;

    > * + * {
        margin-left: 12px;
    }
`;

export const ProductMenuButton = styled.button.attrs(() => ({
    id: 'product_switch_menu',
    type: 'button',
}))`
    display: flex;
    align-items: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    padding: 3px 6px 3px 5px;

    &:hover, &:focus {
        color: rgba(var(--sidebar-text-rgb), 0.56);
        background-color: rgba(var(--sidebar-text-rgb), 0.08);
    }

    &:active {
        color: rgba(var(--sidebar-text-rgb), 0.56);
        background-color: rgba(var(--sidebar-text-rgb), 0.16);
    }

    > * + * {
        margin-left: 8px;
    }
`;

const ProductMenu = (): JSX.Element => {
    const {formatMessage} = useIntl();
    const products = useProducts();
    const dispatch = useDispatch();
    const switcherOpen = useSelector(isSwitcherOpen);
    const menuRef = useRef<HTMLDivElement>(null);
    const currentProductID = useCurrentProductId();
    const license = useSelector(getLicense);

    const handleClick = () => dispatch(setProductMenuSwitcherOpen(!switcherOpen));

    const handleOnBoardingTaskData = useHandleOnBoardingTaskData();

    const visitSystemConsoleTaskName = OnboardingTasksName.VISIT_SYSTEM_CONSOLE;
    const handleVisitConsoleClick = () => {
        const steps = TaskNameMapToSteps[visitSystemConsoleTaskName];
        handleOnBoardingTaskData(visitSystemConsoleTaskName, steps.FINISHED, true, 'finish');
        localStorage.setItem(OnboardingTaskCategory, 'true');
    };

    useClickOutsideRef(menuRef, () => {
        if (!switcherOpen) {
            return;
        }
        dispatch(setProductMenuSwitcherOpen(false));
    });

    const productItems = products?.map((product) => {
        let tourTip;

        return (
            <ProductMenuItem
                key={product.id}
                destination={product.switcherLinkURL}
                icon={product.switcherIcon}
                text={product.switcherText}
                active={product.id === currentProductID}
                onClick={handleClick}
                tourTip={tourTip}
                id={`product-menu-item-${product.pluginId || product.id}`}
            />
        );
    });

    return (
        <div ref={menuRef}>
            <MenuWrapper
                open={switcherOpen}
            >
                <ProductMenuContainer onClick={handleClick}>
                    <ProductMenuButton
                        aria-expanded={switcherOpen}
                        aria-label={formatMessage({id: 'global_header.productSwitchMenu', defaultMessage: 'Product switch menu'})}
                        aria-controls='product-switcher-menu'
                        style={switcherOpen ? {
                            backgroundColor: 'rgba(var(--sidebar-text-rgb), 0.16)',
                            color: 'rgba(var(--sidebar-text-rgb), 0.56)',
                        } : {}}
                    >
                        <ProductsIcon
                            size={20}
                            color='rgba(var(--sidebar-text-rgb), 0.56)'
                        />
                        {license.IsLicensed === 'false' && <ProductBrandingTeamEdition/>}
                        {license.IsLicensed === 'true' && <ProductBranding/>}
                    </ProductMenuButton>
                </ProductMenuContainer>
                <Menu
                    listId={'product-switcher-menu-dropdown'}
                    className={'product-switcher-menu'}
                    id={'product-switcher-menu'}
                    ariaLabel={'switcherOpen'}
                >
                    <ProductMenuItem
                        destination={'/'}
                        icon={'product-channels'}
                        text={'Channels'}
                        active={isChannels(currentProductID)}
                        onClick={handleClick}
                    />
                    {productItems}
                    <ProductMenuList
                        isMessaging={isChannels(currentProductID)}
                        onClick={handleClick}
                        handleVisitConsoleClick={handleVisitConsoleClick}
                    />
                    <Menu.Group>
                        <Menu.StartTrial
                            id='startTrial'
                        />
                    </Menu.Group>
                </Menu>
            </MenuWrapper>
        </div>
    );
};

export default ProductMenu;
