// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';
import type {RouteComponentProps} from 'react-router-dom';

import type {WebSocketClient} from '@mattermost/client';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';
import type {PluginAnalyticsRow} from '@mattermost/types/admin';
import type {Board} from '@mattermost/types/boards';
import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {FileInfo} from '@mattermost/types/files';
import type {CommandArgs} from '@mattermost/types/integrations';
import type {ClientPluginManifest} from '@mattermost/types/plugins';
import type {Post, PostEmbed} from '@mattermost/types/posts';
import type {ProductScope} from '@mattermost/types/products';
import type {UserProfile} from '@mattermost/types/users';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import type {NewPostMessageProps} from 'actions/new_post';

import type {PluginConfiguration} from 'types/plugins/user_settings';
import type {GlobalState} from 'types/store';

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

export type FilesDropdownAction = PluginComponent & {
    text: PluggableText;
    match: (fileInfo: FileInfo) => boolean;
    action: (fileInfo: FileInfo) => void;
};

export type PostDropdownMenuAction = PluginComponent & {
    parentMenuId?: string;
    subMenu?: PostDropdownMenuAction[];
    text: PluggableText;
    action: (postId: string) => void;
    filter: (postId: string) => boolean;
};

export type ChannelHeaderAction = PluginComponent & {
    text: PluggableText;
    action: (channelId: string) => void;
    shouldRender: (state: GlobalState) => boolean;
};

export type ChannelHeaderButtonAction = PluginComponent & {
    icon: React.ReactNode;
    dropdownText: PluggableText;
    tooltipText: PluggableText;
    action: (channel: Channel, member?: ChannelMembership) => void;
};

export type FileUploadMethodAction = PluginComponent & {
    text: PluggableText;
    action: (checkPluginHooksAndUploadFiles: ((files: FileList | File[]) => void)) => void;
    icon: React.ReactNode;
};

export type MainMenuAction = PluginComponent & {
    text: PluggableText;
    action: () => void;
    mobileIcon: React.ReactNode;
};

export type ChannelIntroButtonAction = PluginComponent & {
    text: PluggableText;
    action: (channel: Channel, member: ChannelMembership) => void;
    icon: React.ReactNode;
};

export type UserGuideDropdownAction = PluginComponent & {
    text: PluggableText;
    action: (fileInfo: FileInfo) => void;
};

export type CallButtonAction = PluginComponent & {
    button: React.ReactNode;
    dropdownButton: React.ReactNode;
    action: (channel?: Channel | null, member?: ChannelMembership) => void;
};

export type MobileChannelHeaderButtonAction = PluginComponent & {
    button?: CallButtonAction['button'];
    dropdownButton?: CallButtonAction['dropdownButton'];
    icon: ChannelHeaderButtonAction['icon'];
    action: ChannelHeaderButtonAction['action'];
    dropdownText?: ChannelHeaderButtonAction['dropdownText'];
    tooltipText?: ChannelHeaderButtonAction['tooltipText'];
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

export type FilesWillUploadHook = PluginComponent & {
    hook: (files: File[], uploadFiles: (files: File[]) => void) => { message?: string; files?: File[] };
}

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

export type NeedsTeamComponent = PluginComponent & {
    route: string;
    component: React.ComponentType<BasePluggableProps>;
}

export type FilePreviewComponent = PluginComponent & {
    override: (fileInfo: FileInfo, post?: Post) => boolean;
    component: React.ComponentType<{
        fileInfo: FileInfo;
        post?: Post;
        onModalDismissed: () => void;
    }>;
}

export type PostWillRenderEmbedComponent = PluginComponent & {
    component: React.ComponentType<{
        embed: PostEmbed;
        webSocketClient?: WebSocketClient;
    }>;
    match: (arg: PostEmbed) => boolean;
    toggleable: boolean;
}

export type PostDropdownMenuItemComponent = PluginComponent & {
    text: PluggableText;
    component: React.ComponentType<BasePluggableProps & {postId: string}>;
};

export type RightHandSidebarComponent = PluginComponent & {
    title: PluggableText;
    component: React.ComponentType<BasePluggableProps>;
};

export type SearchHintsComponent = PluginComponent & {
    component: React.ComponentType<{
        onChangeSearch: (value: string, matchedPretext: string) => void;
        searchTerms: string;
    }>;
};

export type SearchSuggestionsComponent = PluginComponent & {
    component: React.ComponentType<{
        searchTerms: string;
        onChangeSearch: (value: string, matchedPretext: string) => void;
        onRunSearch: (searchTerms: string) => void;
    }>;
};

export type SearchButtonsComponent = PluginComponent & {
    component: React.ComponentType; // Review the props
    action: (terms: string) => void;
};

export type PostActionComponent = PluginComponent & {
    component: React.ComponentType<{
        post: Post;
    }>;
};

export type NewMessagesSeparatorActionComponent = PluginComponent & {
    component: React.ComponentType<{
        lastViewedAt: number;
        channelId?: string;
        threadId?: string;
    }>;
};

export type PopoverUserAttributesComponent = PluginComponent & {
    component: React.ComponentType<BasePluggableProps & {
        user: UserProfile;
        hide?: () => void;
        status: string | null;
        fromWebhook?: boolean;
    }>;
};

export type PopoverUserActionsComponent = PluginComponent & {
    component: React.ComponentType<BasePluggableProps & {
        user: UserProfile;
        hide?: () => void;
        status: string | null;
    }>;
};

export type LeftSidebarHeaderComponent = PluginComponent & {
    component: React.ComponentType<BasePluggableProps>;
};

export type RootComponent = PluginComponent & {
    component: React.ComponentType<BasePluggableProps>;
};

export type BottomTeamSidebarComponent = PluginComponent & {
    component: React.ComponentType<BasePluggableProps>;
};

export type SidebarChannelLinkLabelComponent = PluginComponent & {
    component: React.ComponentType<BasePluggableProps & {
        channel: Channel;
    }>;
};

export type PostMessageAttachmentComponent = PluginComponent & {
    component: React.ComponentType<BasePluggableProps & {
        postId: string;
        onHeightChange: (height: number) => void;
    }>;
};

export type LinkTooltipComponent = PluginComponent & {
    component: React.ComponentType<BasePluggableProps & {
        href: string;
        show: boolean;
    }>;
};

export type PostEditorActionComponent = PluginComponent & {
    component: React.ComponentType;
};

export type CodeBlockActionComponent = PluginComponent & {
    component: React.ComponentType;
};

export type CustomRouteComponent = PluginComponent & {
    component: React.ComponentType;
    route: string;
};

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

export type MessageWillFormatHook = PluginComponent & {
    hook: (post: Post, message: string) => string;
};

export type MessageWillBePostedHook = PluginComponent & {
    hook: (post: Post) => Promise<{error: {message: string}} | {post: Post}>;
};

export type SlashCommandWillBePostedHook = PluginComponent & {
    hook: (message: string, args: CommandArgs) => Promise<{error: {message: string}} | {message: string; args: CommandArgs} | Record<string, never>>;
};

export type MessageWillBeUpdatedHook = PluginComponent & {
    hook: (post: Partial<Post>, oldPost: Post) => Promise<{error: {message: string}} | {post: Post}>;
};

export type PostPluginComponent = {
    id: string;
    pluginId: string;
    type: string;
    component: React.ComponentType<{
        post: Post;
        compactDisplay?: boolean;
        isRHS?: boolean;
        theme?: Theme;
    }>;
};

export type AdminConsolePluginComponent = {
    pluginId: string;
    key: string;
    component: React.Component;
    options: {
        showTitle: boolean;
    };
};

export type AdminConsolePluginCustomSection = {
    pluginId: string;
    key: string;
    component: React.Component;
};
