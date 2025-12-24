// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import type {ProductIdentifier} from '@mattermost/types/products';

import * as Menu from 'components/menu';

import ProductSwitcherChannelsMenuItem from './product_switcher_channels_menuitem';
import ProductSwitcherIntegrationsMenuItem from './product_switcher_integrations_menuitem';
import ProductSwitcherProductsMenuItems from './product_switcher_products_menuitems';
import ProductSwitcherSystemConsoleMenuItem from './product_switcher_system_console_menuitem';
import ProductSwitcherCloudTrialMenuItem from './product_switcher_trial_menuitem';

export const ELEMENT_ID_FOR_PRODUCT_SWITCHER_MENU = 'productSwitcherMenu';
export const ELEMENT_ID_FOR_PRODUCT_SWITCHER_MENU_BUTTON = 'productSwitcherMenuButton';

type Props = {
    productId: ProductIdentifier;
}

export function ProductSwitcherMenu(props: Props) {
    const {formatMessage} = useIntl();

    return (
        <Menu.Container
            menuButton={{
                id: ELEMENT_ID_FOR_PRODUCT_SWITCHER_MENU_BUTTON,
                class: 'HeaderIconButton',
                children: <i className='icon-products'/>,
                'aria-label': formatMessage({id: 'global_header.productSwitchMenuButton.label', defaultMessage: 'Switch product'}),
            }}
            menuButtonTooltip={{
                text: formatMessage({id: 'global_header.productSwitchMenuButton.label', defaultMessage: 'Switch product'}),
            }}
            menu={{
                id: ELEMENT_ID_FOR_PRODUCT_SWITCHER_MENU,
                minWidth: '225px',
                maxWidth: '270px',
            }}
        >
            <ProductSwitcherChannelsMenuItem
                currentProductID={props.productId}
            />
            <ProductSwitcherProductsMenuItems
                currentProductID={props.productId}
            />
            <ProductSwitcherCloudTrialMenuItem/>
            <Menu.Separator/>
            <ProductSwitcherIntegrationsMenuItem currentProductID={props.productId}/>
            <ProductSwitcherSystemConsoleMenuItem/>
        </Menu.Container>
    );

    // return (
    //     <div ref={menuRef}>
    //         <MenuWrapper
    //             open={switcherOpen}
    //         >
    //             <ProductMenuContainer onClick={handleClick}>
    //                 <ProductMenuButton
    //                     aria-expanded={switcherOpen}
    //                     aria-label={formatMessage({id: 'global_header.productSwitchMenu', defaultMessage: 'Product switch menu'})}
    //                     aria-controls='product-switcher-menu'
    //                 />
    //             </ProductMenuContainer>
    //             <MenuOld
    //                 listId={'product-switcher-menu-dropdown'}
    //                 className={'product-switcher-menu'}
    //                 id={'product-switcher-menu'}
    //                 ariaLabel={'switcherOpen'}
    //             >
    //                 <ProductMenuList
    //                     isMessaging={isChannels(currentProductID)}
    //                 />
    //                 <MenuOld.Group>
    //                     <MenuOld.StartTrial
    //                         id='startTrial'
    //                     />
    //                 </MenuOld.Group>
    //             </MenuOld>
    //         </MenuWrapper>
    //     </div>
    // );
}
