// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {
    ApplicationCogIcon,
    DotsHorizontalIcon,
    DownloadOutlineIcon,
    InformationOutlineIcon,
    ViewGridPlusOutlineIcon,
    WebhookIncomingIcon,
} from '@mattermost/compass-icons/components';

import {Permissions} from 'mattermost-redux/constants';
import {getConfig, isMarketplaceEnabled} from 'mattermost-redux/selectors/entities/general';
import {haveICurrentTeamPermission, haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {openModal} from 'actions/views/modals';

import AboutBuildModal from 'components/about_build_modal';
import * as Menu from 'components/menu';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';
import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';
import MarketplaceModal from 'components/plugin_marketplace/marketplace_modal';

import {ModalIdentifiers} from 'utils/constants';
import {useProducts} from 'utils/products';
import * as UserAgent from 'utils/user_agent';

import type {GlobalState} from 'types/store';

import ProductMenuItem from './product_menu_item';

import './more_menu.scss';

/**
 * MoreMenu displays the three-dot button and dropdown menu for overflow products
 * and system items. Uses Menu.Container positioned to the right of the sidebar.
 *
 * Products section shows all products with checkboxes to toggle pinned state.
 * System items section shows Console, Integrations, Marketplace, Download Apps, and About.
 */
const MoreMenu = (): JSX.Element => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const history = useHistory();
    const products = useProducts();

    // Selectors for config and permissions
    const config = useSelector(getConfig);
    const currentTeam = useSelector(getCurrentTeam);
    const enablePluginMarketplace = useSelector(isMarketplaceEnabled);

    // Config values
    const siteName = config.SiteName || 'Mattermost';
    const appDownloadLink = config.AppDownloadLink || '';
    const enableCommands = config.EnableCommands === 'true';
    const enableIncomingWebhooks = config.EnableIncomingWebhooks === 'true';
    const enableOAuthServiceProvider = config.EnableOAuthServiceProvider === 'true';
    const enableOutgoingWebhooks = config.EnableOutgoingWebhooks === 'true';

    // Permission checks
    const canManageTeamIntegrations = useSelector((state: GlobalState) =>
        haveICurrentTeamPermission(state, Permissions.MANAGE_SLASH_COMMANDS) ||
        haveICurrentTeamPermission(state, Permissions.MANAGE_OWN_SLASH_COMMANDS) ||
        haveICurrentTeamPermission(state, Permissions.MANAGE_INCOMING_WEBHOOKS) ||
        haveICurrentTeamPermission(state, Permissions.MANAGE_OWN_INCOMING_WEBHOOKS) ||
        haveICurrentTeamPermission(state, Permissions.MANAGE_OUTGOING_WEBHOOKS) ||
        haveICurrentTeamPermission(state, Permissions.MANAGE_OWN_OUTGOING_WEBHOOKS) ||
        haveISystemPermission(state, {permission: Permissions.MANAGE_OAUTH}),
    );
    const canManageSystemBots = useSelector((state: GlobalState) =>
        haveISystemPermission(state, {permission: Permissions.MANAGE_BOTS}) ||
        haveISystemPermission(state, {permission: Permissions.MANAGE_OTHERS_BOTS}),
    );

    // Integration visibility logic
    const someIntegrationEnabled = enableIncomingWebhooks || enableOutgoingWebhooks || enableCommands || enableOAuthServiceProvider || canManageSystemBots;
    const canManageIntegrations = canManageTeamIntegrations || canManageSystemBots;
    const showIntegrations = someIntegrationEnabled && canManageIntegrations && currentTeam;

    const tooltipText = formatMessage({
        id: 'product_sidebar.moreMenu.tooltip',
        defaultMessage: 'More options',
    });

    const channelsName = formatMessage({
        id: 'product_sidebar.channels',
        defaultMessage: 'Channels',
    });

    // Handlers
    const handleSystemConsoleClick = useCallback(() => {
        history.push('/admin_console');
    }, [history]);

    const handleIntegrationsClick = useCallback(() => {
        if (currentTeam?.name) {
            history.push(`/${currentTeam.name}/integrations`);
        }
    }, [history, currentTeam]);

    const handleMarketplaceClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.PLUGIN_MARKETPLACE,
            dialogType: MarketplaceModal,
            dialogProps: {},
        }));
    }, [dispatch]);

    const handleAboutClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.ABOUT,
            dialogType: AboutBuildModal,
            dialogProps: {},
        }));
    }, [dispatch]);

    const showDownloadApps = appDownloadLink && !UserAgent.isMobileApp();

    return (
        <div className='MoreMenu__wrapper'>
            <Menu.Container
                menuButton={{
                    id: 'productSidebarMoreMenuButton',
                    class: 'MoreMenuButton',
                    children: (
                        <DotsHorizontalIcon size={24}/>
                    ),
                }}
                menuButtonTooltip={{
                    text: tooltipText,
                    isVertical: false,
                }}
                menu={{
                    id: 'productSidebarMoreMenu',
                    'aria-label': formatMessage({
                        id: 'product_sidebar.moreMenu.ariaLabel',
                        defaultMessage: 'More menu',
                    }),
                    className: 'MoreMenu',
                }}
                anchorOrigin={{vertical: 'top', horizontal: 'right'}}
                transformOrigin={{vertical: 'top', horizontal: 'left'}}
            >
                {/* Products section - all products with pin checkboxes */}
                <ProductMenuItem
                    productId='channels'
                    name={channelsName}
                    icon='product-channels'
                />
                {products?.map((product) => (
                    <ProductMenuItem
                        key={product.id}
                        productId={product.id}
                        name={String(product.switcherText || '')}
                        icon={product.switcherIcon}
                    />
                ))}

                <Menu.Separator/>

                {/* System items section */}
                <SystemPermissionGate permissions={Permissions.SYSCONSOLE_READ_PERMISSIONS}>
                    <Menu.Item
                        id='systemConsole'
                        leadingElement={
                            <span className='MoreMenu__systemIcon'>
                                <ApplicationCogIcon size={16}/>
                            </span>
                        }
                        labels={(
                            <FormattedMessage
                                id='navbar_dropdown.console'
                                defaultMessage='System Console'
                            />
                        )}
                        onClick={handleSystemConsoleClick}
                    />
                </SystemPermissionGate>

                {showIntegrations && (
                    <Menu.Item
                        id='integrations'
                        leadingElement={
                            <span className='MoreMenu__systemIcon'>
                                <WebhookIncomingIcon size={16}/>
                            </span>
                        }
                        labels={(
                            <FormattedMessage
                                id='navbar_dropdown.integrations'
                                defaultMessage='Integrations'
                            />
                        )}
                        onClick={handleIntegrationsClick}
                    />
                )}

                <TeamPermissionGate
                    teamId={currentTeam?.id}
                    permissions={[Permissions.SYSCONSOLE_WRITE_PLUGINS]}
                >
                    {enablePluginMarketplace && (
                        <Menu.Item
                            id='marketplace'
                            leadingElement={
                                <span className='MoreMenu__systemIcon'>
                                    <ViewGridPlusOutlineIcon size={16}/>
                                </span>
                            }
                            labels={(
                                <FormattedMessage
                                    id='navbar_dropdown.marketplace'
                                    defaultMessage='App Marketplace'
                                />
                            )}
                            onClick={handleMarketplaceClick}
                        />
                    )}
                </TeamPermissionGate>

                {showDownloadApps && (
                    <Menu.Item
                        id='downloadApps'
                        leadingElement={
                            <span className='MoreMenu__systemIcon'>
                                <DownloadOutlineIcon size={16}/>
                            </span>
                        }
                        labels={(
                            <FormattedMessage
                                id='navbar_dropdown.nativeApps'
                                defaultMessage='Download Apps'
                            />
                        )}
                        onClick={() => {
                            window.open(appDownloadLink, '_blank', 'noopener,noreferrer');
                        }}
                    />
                )}

                <Menu.Item
                    id='about'
                    leadingElement={
                        <span className='MoreMenu__systemIcon'>
                            <InformationOutlineIcon size={16}/>
                        </span>
                    }
                    labels={(
                        <FormattedMessage
                            id='navbar_dropdown.about'
                            defaultMessage='About {appTitle}'
                            values={{appTitle: siteName}}
                        />
                    )}
                    onClick={handleAboutClick}
                />
            </Menu.Container>
        </div>
    );
};

export default MoreMenu;
