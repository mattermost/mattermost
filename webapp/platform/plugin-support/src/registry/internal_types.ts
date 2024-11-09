// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {WebSocketClient} from '@mattermost/client';
import type {PluginAnalyticsRow} from '@mattermost/types/admin';
import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {ProductScope} from '@mattermost/types/products';

import type {PluggableText} from './types';

export type IconGlyphTypes = unknown; // TODO

export type ProductOptions = {

    /**
     * A compass-icon glyph to display as the icon in the product switcher
     */
    switcherIcon: IconGlyphTypes;

    /**
     * A string or React element to display in the product switcher
     */
    switcherText: React.ReactNode | React.ElementType;

    /**
     * The route to be displayed at starting from the siteURL
     */
    baseURL: string;

    /**
     * A string specifying the URL the switcher item should point to.
     */
    switcherLinkURL: string;

    /**
     * The component to be displayed below the global header when your route is active.
     */
    mainComponent: React.ComponentType<{
        webSocketClient: WebSocketClient;
    }>;

    /**
     * The public component to be displayed when a public route is active.
     */
    publicComponent: React.ComponentType;

    /**
     * A component to fill the generic area in the center of
     * the global header when your route is active.
     */
    headerCentreComponent: React.ComponentType;

    /**
     * A component to fill the generic area in the right of
     * the global header when your route is active.
     */
    headerRightComponent: React.ComponentType;

    /**
     * A flag to display or hide the team sidebar in products.
     */
    showTeamSidebar: boolean;

    /**
     * A flag to display or hide the App Sidebar in products.
     */
    showAppBar: boolean;

    /**
     * When `true`, {@link ProductComponent.mainComponent} will be wrapped in a container with `grid-area: center` applied automatically.
     * When `false`, {@link ProductComponent.mainComponent} will not be wrapped and must define its own `grid-area`,
     * or return multiple elements with their own `grid-area`s respectively.
     * @default true
     */
    wrapped: boolean;
};

export type SidebarChannelLinkLabelComponentOptions = {
    component: React.ComponentType<unknown>;
};

export type ChannelToastComponentOptions = {
    component: React.ComponentType<unknown>;
};

export type GlobalComponentOptions = {
    component: React.ComponentType<unknown>;
};

type ActionBarComponentOptionsBase = {
    iconUrl: string;
    tooltipText: PluggableText;
    supportedProductIds: ProductScope;
};
export type AppBarComponentOptionsWithAction = ActionBarComponentOptionsBase & {
    action: (channel: Channel, member: ChannelMembership) => void;
    rhsComponent: undefined;
    rhsTitle: undefined;
};
export type AppBarComponentOptionsWithRhs = ActionBarComponentOptionsBase & {
    action?: never;
    rhsComponent: React.ComponentType<unknown>;
    rhsTitle: PluggableText;
};

export type SiteStatisticsHandlerOptions = {
    handler: () => Promise<Record<string, PluginAnalyticsRow>>;
};
