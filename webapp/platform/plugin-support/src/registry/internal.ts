// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type * as InternalRegistryTypes from './internal_types';
import type {PluginComponentId} from './types';

export interface InternalPluginRegistry {

    /**
     * INTERNAL: Subject to change without notice.
     * Register a Product, consisting of a global header menu item, mainComponent, and other pluggables.
     * @remarks DANGER: Interferes with historic routes.
     * @see {@link ProductComponent}
     * @returns {string}
     */
    registerProduct(options: InternalRegistryTypes.ProductOptions): PluginComponentId;

    // INTERNAL: Subject to change without notice.
    // Register a component to render in the LHS next to a channel's link label.
    // All parameters are required.
    // Returns a unique identifier.
    registerSidebarChannelLinkLabelComponent(options: InternalRegistryTypes.SidebarChannelLinkLabelComponentOptions): PluginComponentId;

    // INTERNAL: Subject to change without notice.
    // Register a component to render in channel's center view, in place of a channel toast.
    // All parameters are required.
    // Returns a unique identifier.
    registerChannelToastComponent(options: InternalRegistryTypes.ChannelToastComponentOptions): PluginComponentId;

    // INTERNAL: Subject to change without notice.
    // Register a global component at the root of the app that survives across product switches.
    // All parameters are required.
    // Returns a unique identifier.
    registerGlobalComponent(options: InternalRegistryTypes.GlobalComponentOptions): PluginComponentId;

    /**
     * INTERNAL: Subject to change without notice.
     * Add an item to the App Bar.
     * @param {string} iconUrl resolvable URL to use as the button's icon.
     * @param {PluginComponent['action'] | undefined} action called when the button is clicked, passed the channel and channel member as arguments.
     * @param {React.ReactNode} tooltipText string or React element shown for tooltip appear on hover.
     * @param {null | string | Array<null | string>} supportedProductIds specifies one or multiple product identifier(s),
     * identifiers can either be the "real" product uuid, or a product's more commonly accessible plugin id, or '*' to match everything.
     * @param {PluginComponent['component'] | undefined} rhsComponent an optional corresponding RHS component. If provided, its toggler is automatically wired to the action.
     * @param {ReactResolvable | undefined} rhsTitle the corresponding RHS component's title.
     * @returns {string} unique identifier
     */
    registerAppBarComponent(options: InternalRegistryTypes.AppBarComponentOptionsWithAction): {id: PluginComponentId; rhsComponent: any};
    registerAppBarComponent(options: InternalRegistryTypes.AppBarComponentOptionsWithRhs): PluginComponentId;

    // INTERNAL: Subject to change without notice.
    // Register a handler to retrieve stats that will be displayed on the system console
    // Accepts the following:
    // - handler - Func to be called to retrieve the stats from plugin api. It must be type PluginSiteStatsHandler.
    // Returns undefined
    registerSiteStatisticsHandler(options: InternalRegistryTypes.SiteStatisticsHandlerOptions): void;
}
