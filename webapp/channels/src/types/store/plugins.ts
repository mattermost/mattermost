// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RegistryTypes} from '@hmhealey/plugin-support';
import type React from 'react';
import type {RouteComponentProps} from 'react-router-dom';

import type {WebSocketClient} from '@mattermost/client';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';
import type {PluginAnalyticsRow} from '@mattermost/types/admin';
import type {Board} from '@mattermost/types/boards';
import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {ClientPluginManifest} from '@mattermost/types/plugins';
import type {ProductScope} from '@mattermost/types/products';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import type {PluginConfiguration} from 'types/plugins/user_settings';

export type PluginSiteStatsHandler = () => Promise<Record<string, PluginAnalyticsRow>>;

export type PluginsState = {
    plugins: IDMappedObjects<ClientPluginManifest>;

    components: {
        CallButton: CallButtonAction[];
        PostDropdownMenu: PostDropdownMenuAction[];
        MainMenu: MainMenuAction[];
        ChannelHeader: ChannelHeaderAction[];
        ChannelHeaderButton: ChannelHeaderButtonAction[];
        MobileChannelHeaderButton: MobileChannelHeaderButtonAction[];
        AppBar: AppBarAction[];
        UserGuideDropdown: UserGuideDropdownAction[];
        FileUploadMethod: FileUploadMethodAction[];
        ChannelIntroButton: ChannelIntroButtonAction[];
        FilesDropdown: FilesDropdownAction[];
        Product: ProductComponent[];
        PostDropdownMenuItem: PostDropdownMenuItemComponent[];
        PostAction: PostActionComponent[];
        PostEditorAction: PostEditorActionComponent[];
        CodeBlockAction: CodeBlockActionComponent[];
        NewMessagesSeparatorAction: NewMessagesSeparatorActionComponent[];
        FilePreview: FilePreviewComponent[];
        LinkTooltip: LinkTooltipComponent[];
        RightHandSidebarComponent: RightHandSidebarComponent[];
        NeedsTeamComponent: NeedsTeamComponent[];
        CreateBoardFromTemplate: CreateBoardFromTemplateComponent[];
        SearchHints: SearchHintsComponent[];
        SearchSuggestions: SearchSuggestionsComponent[];
        SearchButtons: SearchButtonsComponent[];
        PostWillRenderEmbedComponent: PostWillRenderEmbedComponent[];
        PopoverUserAttributes: PopoverUserAttributesComponent[];
        PopoverUserActions: PopoverUserActionsComponent[];
        LeftSidebarHeader: LeftSidebarHeaderComponent[];
        Root: RootComponent[];
        BottomTeamSidebar: BottomTeamSidebarComponent[];
        PostMessageAttachment: PostMessageAttachmentComponent[];
        CustomRouteComponent: CustomRouteComponent[];
        Global: GlobalComponent[];
        ChannelToast: ChannelToastComponent[];
        SidebarChannelLinkLabel: SidebarChannelLinkLabelComponent[];
        FilesWillUploadHook: FilesWillUploadHook[];
        DesktopNotificationHooks: DesktopNotificationHook[];
        MessageWillFormat: MessageWillFormatHook[];
        MessageWillBePosted: MessageWillBePostedHook[];
        SlashCommandWillBePosted: SlashCommandWillBePostedHook[];
        MessageWillBeUpdated: MessageWillBeUpdatedHook[];
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

    adminConsoleCustomSections: {
        [pluginId: string]: {
            [sectionKey: string]: AdminConsolePluginCustomSection;
        };
    };

    siteStatsHandlers: {
        [pluginId: string]: PluginSiteStatsHandler;
    };

    userSettings: {
        [pluginId: string]: PluginConfiguration;
    };
};

export type Menu = {
    id: string;
    parentMenuId?: string;
    text?: PluggableText;
    selectedValueText?: string;
    subMenu?: Menu[];
    filter?: (id: string) => boolean;
    action?: (...args: any) => void;
    icon?: React.ReactNode;
    direction?: 'left' | 'right';
    isHeader?: boolean;
}

type PluginComponent = {
    id: string;
    pluginId: string;
};

type BasePluggableProps = {
    webSocketClient: WebSocketClient;
    theme: Theme;
}

export type PluggableText = string | React.ReactNode;

export type AppBarChannelAction = (channel: Channel, member: ChannelMembership) => void;
export type AppBarAction = PluginComponent & {
    iconUrl: string;
    supportedProductIds: ProductScope;
    tooltipText: PluggableText;
} & ({
    action: AppBarChannelAction;
} | {
    rhsComponentId: string;
    action: () => {data: boolean};
});

export type FilesDropdownAction = PluginComponent & RegistryTypes.FileDropdownActionOptions;

export type PostDropdownMenuAction = PluginComponent & {
    parentMenuId?: string;
    subMenu?: PostDropdownMenuAction[];
    text: PluggableText;
    action: (postId: string) => void;
    filter: (postId: string) => boolean;
};

export type ChannelHeaderAction = PluginComponent & RegistryTypes.ChannelHeaderMenuActionOptions;

export type ChannelHeaderButtonAction = PluginComponent & RegistryTypes.ChannelHeaderButtonActionOptions;

export type FileUploadMethodAction = PluginComponent & RegistryTypes.FileUploadMethodOptions;

export type MainMenuAction = PluginComponent & RegistryTypes.MainMenuActionOptions;

export type ChannelIntroButtonAction = PluginComponent & RegistryTypes.ChannelIntroButtonActionOptions;

export type UserGuideDropdownAction = PluginComponent & RegistryTypes.UserGuideDropdownMenuActionOptions;

export type CallButtonAction = PluginComponent & RegistryTypes.CallButtonActionOptions;

export type MobileChannelHeaderButtonAction = PluginComponent & {
    button?: CallButtonAction['button'];
    dropdownButton?: CallButtonAction['dropdownButton'];
    icon: ChannelHeaderButtonAction['icon'];
    action: ChannelHeaderButtonAction['action'];
    dropdownText?: ChannelHeaderButtonAction['dropdownText'];
    tooltipText?: ChannelHeaderButtonAction['tooltipText'];
};

export type DesktopNotificationArgs = RegistryTypes.DesktopNotificationArgs;
export type DesktopNotificationHook = PluginComponent & RegistryTypes.DesktopNotificationHookOptions;

export type FilesWillUploadHook = PluginComponent & RegistryTypes.FilesWillUploadHookOptions;

type ProductBaseProps = {theme: Theme};
export type ProductSubComponentNames = 'mainComponent' | 'publicComponent' | 'headerCentreComponent' | 'headerRightComponent';
export type ProductComponent = PluginComponent & {

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
    mainComponent: React.ComponentType<ProductBaseProps & {
        webSocketClient: WebSocketClient;
    }>;

    /**
     * The public component to be displayed when a public route is active.
     */
    publicComponent: React.ComponentType<ProductBaseProps & RouteComponentProps>;

    /**
     * A component to fill the generic area in the center of
     * the global header when your route is active.
     */
    headerCentreComponent: React.ComponentType<ProductBaseProps>;

    /**
     * A component to fill the generic area in the right of
     * the global header when your route is active.
     */
    headerRightComponent: React.ComponentType<ProductBaseProps>;

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

export type NeedsTeamComponent = PluginComponent & RegistryTypes.NeedsTeamRouteOptions;

export type FilePreviewComponent = PluginComponent & RegistryTypes.FilePreviewComponentOptions;

export type PostWillRenderEmbedComponent = PluginComponent & RegistryTypes.PostWillRenderEmbedComponentOptions;

export type PostDropdownMenuItemComponent = PluginComponent & {
    text: PluggableText;
    component: React.ComponentType<BasePluggableProps & {postId: string}>;
};

export type RightHandSidebarComponent = PluginComponent & RegistryTypes.RightHandSidebarComponentOptions;

export type SearchHintsComponent = PluginComponent & {
    component: RegistryTypes.SearchComponentsOptions['hintsComponent'];
};

export type SearchSuggestionsComponent = PluginComponent & {
    component: RegistryTypes.SearchComponentsOptions['suggestionsComponent'];
};

export type SearchButtonsComponent = PluginComponent & {
    component: RegistryTypes.SearchComponentsOptions['buttonComponent'];
    action: RegistryTypes.SearchComponentsOptions['action'];
};

export type PostActionComponent = PluginComponent & RegistryTypes.PostActionComponentOptions;

export type NewMessagesSeparatorActionComponent = PluginComponent & RegistryTypes.NewMessagesSeparatorActionComponentOptions;

export type PopoverUserAttributesComponent = PluginComponent & RegistryTypes.PopoverUserAttributesComponentOptions;

export type PopoverUserActionsComponent = PluginComponent & RegistryTypes.PopoverUserActionsComponentOptions;

export type LeftSidebarHeaderComponent = PluginComponent & RegistryTypes.LeftSidebarHeaderComponentOptions;

export type RootComponent = PluginComponent & RegistryTypes.RootComponentOptions;

export type BottomTeamSidebarComponent = PluginComponent & RegistryTypes.BottomTeamSidebarComponentOptions;

export type SidebarChannelLinkLabelComponent = PluginComponent & {
    component: React.ComponentType<BasePluggableProps & {
        channel: Channel;
    }>;
};

export type PostMessageAttachmentComponent = PluginComponent & RegistryTypes.PostMessageAttachmentComponentOptions;

export type LinkTooltipComponent = PluginComponent & RegistryTypes.LinkTooltipComponentOptions;

export type PostEditorActionComponent = PluginComponent & RegistryTypes.PostEditorActionComponentOptions;

export type CodeBlockActionComponent = PluginComponent & RegistryTypes.CodeBlockActionComponentOptions;

export type CustomRouteComponent = PluginComponent & RegistryTypes.CustomRouteOptions;

export type GlobalComponent = PluginComponent & {
    component: React.ComponentType;
};

export type ChannelToastComponent = PluginComponent & {
    component: React.ComponentType<BasePluggableProps>;
}

export type CreateBoardFromTemplateComponent = PluginComponent & {
    component: React.ComponentType<BasePluggableProps & {
        setCanCreate: (v: boolean) => void;
        setAction: (action: ((currentTeamId: string, channelId: string) => Promise<Board>) | undefined) => void;
        newBoardInfoIcon: React.JSX.Element;
    }>;
    action: () => void;
};

export type MessageWillFormatHook = PluginComponent & RegistryTypes.MessageWillFormatHookOptions;

export type MessageWillBePostedHook = PluginComponent & RegistryTypes.MessageWillBePostedHookOptions;

export type SlashCommandWillBePostedHook = PluginComponent & RegistryTypes.SlashCommandWillBePostedHookOptions;

export type MessageWillBeUpdatedHook = PluginComponent & RegistryTypes.MessageWillBeUpdatedHookOptions;

export type PostPluginComponent = PluginComponent & RegistryTypes.PostTypeComponentOptions;

export type AdminConsolePluginComponent = {
    pluginId: string;
} & RegistryTypes.AdminConsoleCustomSettingOptions;

export type AdminConsolePluginCustomSection = {
    pluginId: string;
} & RegistryTypes.AdminConsoleCustomSectionOptions;
