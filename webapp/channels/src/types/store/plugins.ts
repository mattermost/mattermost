// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {ProductScope} from '@mattermost/types/products';

import {ClientPluginManifest} from '@mattermost/types/plugins';
import {PluginAnalyticsRow} from '@mattermost/types/admin';
import {FileInfo} from '@mattermost/types/files';
import {Post, PostEmbed} from '@mattermost/types/posts';
import {IDMappedObjects} from '@mattermost/types/utilities';
import {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';

import {WebSocketClient} from '@mattermost/client';

import {GlobalState} from 'types/store';
import {Channel} from '@mattermost/types/channels';
import {NewPostMessageProps} from 'actions/new_post';

export type PluginSiteStatsHandler = () => Promise<Record<string, PluginAnalyticsRow>>;

export type PluginsState = {
    plugins: IDMappedObjects<ClientPluginManifest>;

    components: {
        [componentName: string]: PluginComponent[];
        Product: ProductComponent[];
        CallButton: PluginComponent[];
        PostDropdownMenu: PluginComponent[];
        FilePreview: PluginComponent[];
        MainMenu: PluginComponent[];
        LinkTooltip: PluginComponent[];
        RightHandSidebarComponent: PluginComponent[];
        ChannelHeaderButton: PluginComponent[];
        MobileChannelHeaderButton: PluginComponent[];
        AppBar: AppBarComponent[];
        UserGuideDropdownItem: PluginComponent[];
        FilesWillUploadHook: PluginComponent[];
        NeedsTeamComponent: NeedsTeamComponent[];
        CreateBoardFromTemplate: PluginComponent[];
        DesktopNotificationHooks: DesktopNotificationHook[];
    };

    postTypes: {
        [postType: string]: PostPluginComponent;
    };
    postCardTypes: {
        [postType: string]: PostPluginComponent;
    };

    adminConsoleReducers: {
        [pluginId: string]: any;
    };
    adminConsoleCustomComponents: {
        [pluginId: string]: {
            [settingName: string]: AdminConsolePluginComponent;
        };
    };
    siteStatsHandlers: {
        [pluginId: string]: PluginSiteStatsHandler;
    };
};

export type Menu = {
    id: string;
    parentMenuId?: string;
    text?: React.ReactElement | string;
    selectedValueText?: string;
    subMenu?: Menu[];
    filter?: (id?: string) => boolean;
    action?: (...args: any) => void;
    icon?: React.ReactElement;
    direction?: 'left' | 'right';
    isHeader?: boolean;
}

export type PluginComponent = {
    id: string;
    pluginId: string;
    title?: string;

    /** @default null - which means 'channels'*/
    supportedProductIds?: ProductScope;
    component?: React.ComponentType;
    subMenu?: Menu[];
    text?: string;
    dropdownText?: string;
    tooltipText?: string;
    button?: React.ReactElement;
    dropdownButton?: React.ReactElement;
    icon?: React.ReactElement;
    iconUrl?: string;
    mobileIcon?: React.ReactElement;
    filter?: (id: string) => boolean;
    action?: (...args: any) => void; // TODO Add more concrete types?
    shouldRender?: (state: GlobalState) => boolean;
};

export type AppBarComponent = PluginComponent & {
    rhsComponentId?: string;
}

export type NeedsTeamComponent = PluginComponent & {
    route: string;
}

export type FilesWillUploadHook = {
    hook: (files: File[], uploadFiles: (files: File[]) => void) => { message?: string; files?: File[] };
}

export type FilePreviewComponent = {
    id: string;
    pluginId: string;
    override: (fileInfo: FileInfo, post?: Post) => boolean;
    component: React.ComponentType<{ fileInfo: FileInfo; post?: Post; onModalDismissed: () => void }>;
}

export type FileDropdownPluginComponent = {
    id: string;
    pluginId: string;
    text: string | React.ReactElement;
    match: (fileInfo: FileInfo) => boolean;
    action: (fileInfo: FileInfo) => void;
};

export type PostPluginComponent = {
    id: string;
    pluginId: string;
    type: string;
    component: React.ElementType;
};

export type AdminConsolePluginComponent = {
    pluginId: string;
    key: string;
    component: React.Component;
    options: {
        showTitle: boolean;
    };
};

export type PostWillRenderEmbedPluginComponent = {
    id: string;
    pluginId: string;
    component: React.ComponentType<{ embed: PostEmbed; webSocketClient?: WebSocketClient }>;
    match: (arg: PostEmbed) => boolean;
    toggleable: boolean;
}

export type ProductComponent = {

    /**
     * The main uuid of the product.
     */
    id: string;

    /**
     * The plain identifier of the source plugin
     */
    pluginId: string;

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
    mainComponent: React.ComponentType;

    /**
     * The public component to be displayed when a public route is active.
     */
    publicComponent: React.ComponentType | null;

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

export type DesktopNotificationArgs = {
    title: string;
    body: string;
    silent: boolean;
    soundName: string;
    url: string;
    notify: boolean;
};

export type DesktopNotificationHook = PluginComponent & {
    hook: (post: Post, msgProps: NewPostMessageProps, channel: Channel, teamId: string, args: DesktopNotificationArgs) => Promise<{
        error?: string;
        args?: DesktopNotificationArgs;
    }>;
}
