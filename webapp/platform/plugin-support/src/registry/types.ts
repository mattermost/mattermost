// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Reducer} from 'redux';

import type {MessageListener, ReconnectListener, WebSocketClient} from '@mattermost/client';
import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {FileInfo} from '@mattermost/types/files';
import type {CommandArgs} from '@mattermost/types/integrations';
import type {Post, PostEmbed} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';

import type {PluginUserSettings} from '../user_settings';

export type Theme = unknown; // TODO
export type Board = any; // TODO

export type PluginComponentId = string;

type BasePluggableProps = unknown; // TODO I'm being stricter with this because I want to clean this up
type DefaultComponentOptions = {
    component: React.ComponentType<BasePluggableProps>;
};

export type PluggableText = string | React.ReactNode;

export type RootComponentOptions = DefaultComponentOptions;

export type PopoverUserAttributesComponentOptions = {
    component: React.ComponentType<{
        user: UserProfile;
        hide?: () => void;
        status: string | null;
        fromWebhook?: boolean;
    }>;
};

export type PopoverUserActionsComponentOptions = {
    component: React.ComponentType<{
        user: UserProfile;
        hide?: () => void;
        status: string | null;
    }>;
};

export type LeftSidebarHeaderComponentOptions = DefaultComponentOptions;
export type BottomTeamSidebarComponentOptions = DefaultComponentOptions;

export type PostMessageAttachmentComponentOptions = {
    component: React.ComponentType<{
        postId: string;
        onHeightChange: (height: number) => void;
    }>;
};

export type SearchComponentsOptions = {
    buttonComponent: React.ComponentType<unknown>; // TODO
    suggestionsComponent: React.ComponentType<{
        searchTerms: string;
        onChangeSearch: (value: string, matchedPretext: string) => void;
        onRunSearch: (searchTerms: string) => void;
    }>;
    hintsComponent: React.ComponentType<{
        onChangeSearch: (value: string, matchedPretext: string) => void;
        searchTerms: string;
    }>;
    action: (terms: string) => void;
};

export type LinkTooltipComponentOptions = {
    component: React.ComponentType<{
        href: string;
        show: boolean;
    }>;
};

export type ActionAfterChannelCreationOptions = {
    component: React.ComponentType<BasePluggableProps & {
        setCanCreate: (v: boolean) => void;
        setAction: (action: ((currentTeamId: string, channelId: string) => Promise<Board>) | undefined) => void;
        newBoardInfoIcon: React.JSX.Element;
    }>;
    action: () => void;
};

export type ChannelHeaderButtonActionOptions = {
    icon: React.ReactNode;
    dropdownText: PluggableText;
    tooltipText: PluggableText;
    action: (channel: Channel, member?: ChannelMembership) => void;
};

export type ChannelIntroButtonActionOptions = {
    text: PluggableText;
    action: (channel: Channel, member: ChannelMembership) => void;
    icon: React.ReactNode;
};

export type CallButtonActionOptions = {
    button: React.ReactNode;
    dropdownButton: React.ReactNode;
    action: (channel?: Channel | null, member?: ChannelMembership) => void;
};

export type PostTypeComponentOptions = {
    type: string;
    component: React.ComponentType<{
        post: Post;
        compactDisplay?: boolean;
        isRHS?: boolean;
        theme?: Theme;
    }>;
};
export type PostCardTypeComponentOptions = PostTypeComponentOptions;

export type PostWillRenderEmbedComponentOptions = {
    component: React.ComponentType<{
        embed: PostEmbed;
        webSocketClient?: WebSocketClient;
    }>;
    match: (arg: PostEmbed) => boolean;
    toggleable: boolean;
};

export type MainMenuActionOptions = {
    text: PluggableText;
    action: () => void;
    mobileIcon: React.ReactNode;
};

export type ChannelHeaderMenuActionOptions = {
    text: PluggableText;
    action: (channelId: string) => void;
    shouldRender: (state: GlobalState) => boolean;
};

export type FileDropdownActionOptions = {
    text: PluggableText;
    match: (fileInfo: FileInfo) => boolean;
    action: (fileInfo: FileInfo) => void;
};

export type UserGuideDropdownMenuActionOptions = {
    text: PluggableText;
    action: (fileInfo: FileInfo) => void;
};

export type PostActionComponentOptions = {
    component: React.ComponentType<{
        post: Post;
    }>;
};
export type PostEditorActionComponentOptions = DefaultComponentOptions;
export type CodeBlockActionComponentOptions = DefaultComponentOptions;
export type NewMessagesSeparatorActionComponentOptions = {
    component: React.ComponentType<{
        channelId?: string;
        lastViewedAt: number;
        threadId?: string;
    }>;
};

export type PostDropdownMenuActionOptions = {
    id: string;
    parentMenuId?: string;
    subMenu?: PostDropdownMenuActionOptions[];
    text: PluggableText;
    action: (postId: string) => void;
    filter: (postId: string) => boolean;
};

export type PostDropdownSubMenuActionOptions = PostDropdownMenuActionOptions;
export type RegisterPostDropdownSubMenuActionCallback = (
    innerText: PostDropdownSubMenuActionOptions['text'],
    innerAction: PostDropdownSubMenuActionOptions['action'],
    innerFilter: PostDropdownMenuActionOptions['filter'],
) => RegisterPostDropdownSubMenuActionCallback;

export type PostDropdownMenuComponentOptions = DefaultComponentOptions;

export type FileUploadMethodOptions = {
    text: PluggableText;
    action: (checkPluginHooksAndUploadFiles: ((files: FileList | File[]) => void)) => void;
    icon: React.ReactNode;
};

export type FilesWillUploadHookOptions = {
    hook: (files: File[], uploadFiles: (files: File[]) => void) => { message?: string; files?: File[] };
};

export type UnregisterComponentOptions = {
    componentId: PluginComponentId;
};

export type UnregisterPostTypeComponentOptions = {
    componentId: PluginComponentId;
};

export type ReducerOptions = {
    reducer: Reducer;
};

export type WebSocketEventHandlerOptions = {
    event: string;
    handler: MessageListener;
};

export type UnregisterWebSocketEventHandlerOptions = {
    event: string;
};

export type ReconnectHandlerOptions = {
    handler: ReconnectListener;
};

export type MessageWillBePostedHookOptions = {
    hook: (post: Post) => Promise<{error: {message: string}} | {post: Post}>;
};

export type SlashCommandWillBePostedHookOptions = {
    hook: (message: string, args: CommandArgs) => Promise<{error: {message: string}} | {message: string; args: CommandArgs} | Record<string, never>>;
};

export type MessageWillFormatHookOptions = {
    hook: (post: Post, message: string) => string;
};

export type FilePreviewComponentOptions = {
    override: (fileInfo: FileInfo, post?: Post) => boolean;
    component: React.ComponentType<{
        fileInfo: FileInfo;
        post?: Post;
        onModalDismissed: () => void;
    }>;
};

export type RegisterTranslationsOptions = {
    getTranslationsForLocale: (locale: string) => Record<string, string>;
}

export type RegisterAdminConsolePluginOptions = {
    func: (...args: unknown[]) => unknown;
}

export type AdminConsoleCustomSettingOptions = {
    key: string;
    component: React.Component;
    options: {
        showTitle: boolean;
    };
};

export type AdminConsoleCustomSectionOptions = {
    key: string;
    component: React.Component;
};

export type RightHandSidebarComponentOptions = {
    title: PluggableText;
    component: React.ComponentType<BasePluggableProps>;
}

export type NeedsTeamRouteOptions = {
    route: string;
    component: React.ComponentType<BasePluggableProps>;
};

export type CustomRouteOptions = {
    component: React.ComponentType;
    route: string;
};

export type MessageWillBeUpdatedHookOptions = {
    hook: (post: Partial<Post>, oldPost: Post) => Promise<{error: {message: string}} | {post: Post}>;
};

export type DesktopNotificationHookOptions = {
    hook: (post: Post, msgProps: NewPostMessageProps, channel: Channel, teamId: string, args: DesktopNotificationArgs) => Promise<{
        error?: string;
        args?: DesktopNotificationArgs;
    }>;
};
export type NewPostMessageProps = unknown; // TODO
export type DesktopNotificationArgs = {
    title: string;
    body: string;
    silent: boolean;
    soundName: string;
    url: string;
    notify: boolean;
};

export type UserSettingsOptions = {
    setting: PluginUserSettings;
};
