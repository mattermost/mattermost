// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {ProductIdentifier} from '@mattermost/types/products';

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
import ProductSwitcherProductsMenuItems from './switch_product_products_menuitems';
import ProductSwitcherSystemConsoleMenuItem from './switch_product_system_console_menuitem';
import ProductSwitcherUserGroupsMenuItem from './switch_product_user_groups_menuitem';

export const ELEMENT_ID_FOR_SWITCH_PRODUCT_MENU = 'switchProductMenu';
export const ELEMENT_ID_FOR_SWITCH_PRODUCT_MENU_BUTTON = 'switchProductMenuButton';

type Props = {
    productId: ProductIdentifier;
}

export function SwitchProductMenu(props: Props) {
    const {formatMessage} = useIntl();

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

    return (
        <Menu.Container
            menuButton={{
                id: ELEMENT_ID_FOR_SWITCH_PRODUCT_MENU_BUTTON,
                class: 'HeaderIconButton', // Its the same classname as the HeaderIconButton component
                children: <i className='icon-products'/>,
                'aria-label': formatMessage({id: 'globalHeader.productSwitcherMenu.menuButtonAriaLabel', defaultMessage: 'Switch product menu'}),
            }}
            menuButtonTooltip={{
                text: formatMessage({id: 'globalHeader.productSwitcherMenu.menuButtonTooltip', defaultMessage: 'Switch product'}),
            }}
            menu={{
                id: ELEMENT_ID_FOR_SWITCH_PRODUCT_MENU,
                width: '240px',
                className: 'globalHeader-leftControls-productSwitcherMenu',
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
                isUserAdmin={isUserAdmin}
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
