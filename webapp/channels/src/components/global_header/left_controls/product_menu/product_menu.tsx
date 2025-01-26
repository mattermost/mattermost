// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import {ProductsIcon} from '@mattermost/compass-icons/components';

import {setProductMenuSwitcherOpen} from 'actions/views/product_menu';
import {isSwitcherOpen} from 'selectors/views/product_menu';

import * as Menu from 'components/menu';
import {
    OnboardingTaskCategory,
    OnboardingTasksName,
    TaskNameMapToSteps,
    useHandleOnBoardingTaskData,
} from 'components/onboarding_tasks';
import MenuOld from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import {useCurrentProductId, isChannels} from 'utils/products';

import ProductMenuList from './product_menu_list';
import ProductSwitcherChannelsMenuItem from './product_switcher_channels_menuitem';
import ProductSwitcherProductsMenuItems from './product_switcher_products_menuitems';

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
    const dispatch = useDispatch();
    const switcherOpen = useSelector(isSwitcherOpen);
    const menuRef = useRef<HTMLDivElement>(null);
    const currentProductID = useCurrentProductId();

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

    // eslint-disable-next-line no-constant-condition
    if (true) {
        return (
            <Menu.Container
                menuButton={{
                    id: 'productMenuButton',
                    class: 'btn btn-icon btn-quaternary btn-inverted btn-sm buttons-in-globalHeader',
                    children: <ProductsIcon size={18}/>,
                    'aria-label': formatMessage({id: 'global_header.productSwitchMenuButton.label', defaultMessage: 'Switch product'}),
                }}
                menuButtonTooltip={{
                    text: formatMessage({id: 'global_header.productSwitchMenuButton.label', defaultMessage: 'Switch product'}),
                }}
                menu={{
                    id: 'productSwitcherMenu',
                    minWidth: '225px',
                    maxWidth: '270px',
                }}
            >
                <ProductSwitcherChannelsMenuItem
                    currentProductID={currentProductID}
                />
                <ProductSwitcherProductsMenuItems
                    currentProductID={currentProductID}
                />
                <Menu.Separator/>
            </Menu.Container>
        );
    }

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
                    />
                </ProductMenuContainer>
                <MenuOld
                    listId={'product-switcher-menu-dropdown'}
                    className={'product-switcher-menu'}
                    id={'product-switcher-menu'}
                    ariaLabel={'switcherOpen'}
                >
                    <ProductMenuList
                        isMessaging={isChannels(currentProductID)}
                        onClick={handleClick}
                        handleVisitConsoleClick={handleVisitConsoleClick}
                    />
                    <MenuOld.Group>
                        <MenuOld.StartTrial
                            id='startTrial'
                        />
                    </MenuOld.Group>
                </MenuOld>
            </MenuWrapper>
        </div>
    );
};

export default ProductMenu;
