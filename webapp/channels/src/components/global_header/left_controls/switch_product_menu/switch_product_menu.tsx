// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {ProductIdentifier} from '@mattermost/types/products';

import {getPrevTrialLicense} from 'mattermost-redux/actions/admin';
import {getCloudSubscription} from 'mattermost-redux/selectors/entities/cloud';
import {getConfig, isCloudLicense} from 'mattermost-redux/selectors/entities/general';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import * as Menu from 'components/menu';

import {isChannels} from 'utils/products';

import ProductSwitcherAboutMenuItem from './switch_product_about_menuitem';
import ProductSwitcherChannelsMenuItem from './switch_product_channels_menuitem';
import ProductSwitcherCloudLimitsFooter from './switch_product_cloud_limits_footer';
import ProductSwitcherCloudTrialMenuItem from './switch_product_cloud_trial_menuitem';
import ProductSwitcherDownloadMenuItem from './switch_product_download_menuitem';
import ProductSwitcherEditionMenuItem from './switch_product_edition_menuitem';
import ProductSwitcherIntegrationsMenuItem from './switch_product_integrations_menuitem';
import ProductSwitcherMarketplaceMenuItem from './switch_product_marketplace_menuitem';
import ProductSwitcherPluginMenuItems from './switch_product_plugin_menuitems';
import ProductSwitcherProductsMenuItems from './switch_product_products_menuitems';
import ProductSwitcherSystemConsoleMenuItem from './switch_product_system_console_menuitem';
import ProductSwitcherUserGroupsMenuItem from './switch_product_user_groups_menuitem';

import ProductBranding from '../product_branding';

export const ELEMENT_ID_FOR_SWITCH_PRODUCT_MENU = 'switchProductMenu';
export const ELEMENT_ID_FOR_SWITCH_PRODUCT_MENU_BUTTON = 'switchProductMenuButton';

type Props = {
    productId: ProductIdentifier;
};

export function SwitchProductMenu(props: Props) {
    const {formatMessage} = useIntl();

    const dispatch = useDispatch();

    const config = useSelector(getConfig);

    const appDownloadLink = config.AppDownloadLink;

    const haveEnabledIncomingWebhooks = config.EnableIncomingWebhooks === 'true';
    const haveEnabledOutgoingWebhooks = config.EnableOutgoingWebhooks === 'true';
    const haveEnabledSlashCommands = config.EnableCommands === 'true';
    const haveEnabledOAuthServiceProvider = config.EnableOAuthServiceProvider === 'true';

    const siteName = config.SiteName;

    const isEnterpriseReady = config.BuildEnterpriseReady === 'true';

    const currentTeam = useSelector(getCurrentTeam);
    const currentTeamId = currentTeam?.id;
    const currentTeamName = currentTeam?.name;

    const isUserAdmin = useSelector(isCurrentUserSystemAdmin);

    const isCloudLicensed = useSelector(isCloudLicense);
    const subscription = useSelector(getCloudSubscription);
    const isFreeTrialSubscription = subscription?.is_free_trial === 'true';

    const isChannelsProductActive = isChannels(props.productId);

    // The menu contents unmount when the menu closes, so this has to live on the
    // always-mounted menu to stay a single fetch per session.
    useEffect(() => {
        dispatch(getPrevTrialLicense());
    }, [dispatch]);

    return (
        <Menu.Container
            menuButton={{
                id: ELEMENT_ID_FOR_SWITCH_PRODUCT_MENU_BUTTON,

                // HeaderIconButton is the same classname as the HeaderIconButton component
                class: 'HeaderIconButton globalHeader-leftControls-productMenuButton',

                // The branding sits inside the button so that clicking the product
                // name opens the menu too, not just the icon.
                children: (
                    <>
                        <i className='icon-products'/>
                        <ProductBranding/>
                    </>
                ),
                'aria-label': formatMessage({id: 'globalHeader.productSwitcherMenu.menuButtonLabel', defaultMessage: 'Open product menu'}),
            }}
            menuButtonTooltip={{
                text: formatMessage({id: 'globalHeader.productSwitcherMenu.menuButtonLabel', defaultMessage: 'Open product menu'}),
            }}
            menu={{
                id: ELEMENT_ID_FOR_SWITCH_PRODUCT_MENU,
                width: '240px',
                className: 'globalHeader-leftControls-productSwitcherMenu',
                'aria-label': formatMessage({id: 'globalHeader.productSwitcherMenu.ariaLabel', defaultMessage: 'Product menu'}),
            }}
            menuFooter={
                <ProductSwitcherCloudLimitsFooter
                    isUserAdmin={isUserAdmin}
                    isCloudLicensed={isCloudLicensed}
                    isFreeTrialSubscription={isFreeTrialSubscription}
                />
            }
        >
            <ProductSwitcherChannelsMenuItem
                isChannelsProductActive={isChannelsProductActive}
            />
            <ProductSwitcherProductsMenuItems
                currentProductID={props.productId}
            />
            <ProductSwitcherPluginMenuItems/>
            <Menu.Separator/>
            <ProductSwitcherCloudTrialMenuItem
                isUserAdmin={isUserAdmin}
                isCloudLicensed={isCloudLicensed}
                isFreeTrialSubscription={isFreeTrialSubscription}
            />
            <ProductSwitcherSystemConsoleMenuItem/>
            <ProductSwitcherIntegrationsMenuItem
                isChannelsProductActive={isChannelsProductActive}
                haveEnabledIncomingWebhooks={haveEnabledIncomingWebhooks}
                haveEnabledOutgoingWebhooks={haveEnabledOutgoingWebhooks}
                haveEnabledSlashCommands={haveEnabledSlashCommands}
                haveEnabledOAuthServiceProvider={haveEnabledOAuthServiceProvider}
                currentTeamName={currentTeamName}
            />
            <ProductSwitcherUserGroupsMenuItem
                isEnterpriseReady={isEnterpriseReady}
                isCloudLicensed={isCloudLicensed}
                isFreeTrialSubscription={isFreeTrialSubscription}
            />
            <ProductSwitcherMarketplaceMenuItem
                isChannelsProductActive={isChannelsProductActive}
                currentTeamId={currentTeamId}
            />
            <ProductSwitcherDownloadMenuItem appDownloadLink={appDownloadLink}/>
            <ProductSwitcherAboutMenuItem siteName={siteName}/>
            <ProductSwitcherEditionMenuItem/>
        </Menu.Container>
    );
}
