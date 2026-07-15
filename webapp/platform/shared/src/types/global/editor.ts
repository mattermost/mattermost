// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentType, ForwardRefExoticComponent, KeyboardEvent, KeyboardEventHandler, ReactNode, ReactNodeArray, RefAttributes, RefObject} from 'react';

import type {Agent} from '@mattermost/types/agents';
import type {Channel} from '@mattermost/types/channels';
import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import type {ProviderResults, SuggestionResults} from './suggestions';

// Plugin-facing contract for window.WebappUtils.editor. The web app asserts each
// shape stays assignable to the real component/provider at build time in
// published_editor.ts.

export type ActionResult<Data = unknown, Error = unknown> = {
    data?: Data;
    error?: Error;
};

export type WysiwygEditorProps = {
    value: string;
    onChange: (markdown: string) => void;
    onSubmit: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
    placeholder?: string;
    channelId: string;
    rootId?: string;
    disabled?: boolean;
    id?: string;
    useCtrlSend?: boolean;
    sendCodeBlockOnCtrlEnter?: boolean;
    onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
};

export type SuggestionListProps = {
    inputRef?: RefObject<HTMLDivElement>;
    open: boolean;
    position?: 'top' | 'bottom';
    renderNoResults?: boolean;
    onCompleteWord: (term: string, matchedPretext: string, e?: KeyboardEventHandler<HTMLDivElement>) => boolean;
    preventClose?: () => void;
    onItemHover: (term: string) => void;
    pretext: string;
    cleared: boolean;
    results: SuggestionResults;
    selection: string;
    suggestionBoxAlgn?: {
        lineHeight?: number;
        pixelsToMoveX?: number;
        pixelsToMoveY?: number;
    };
};

export type PublishedMarkdownMode = 'bold' | 'italic' | 'link' | 'strike' | 'code' | 'heading' | 'quote' | 'ul' | 'ol';

export type FormattingBarProps = {
    applyFormatting: (mode: PublishedMarkdownMode) => void;
    disableControls: boolean;
    location: string;
    additionalControls?: ReactNodeArray;
    aiActionsMenu?: ReactNode;

    // Returns a Tiptap Editor. Left as `any` so plugins don't need `@tiptap/react`
    getEditor?: () => any;
};

export type PublishedEditorComponentProps = {
    wysiwyg_editor: WysiwygEditorProps;
    suggestion_list: SuggestionListProps;
    formatting_bar: FormattingBarProps;
};

export type PublishedEditorComponentId = keyof PublishedEditorComponentProps;

// Providers emit ProviderResults; SuggestionList consumes the normalized SuggestionResults.
export type SuggestionProviderInstance = {
    triggerCharacter?: string;
    handlePretextChanged: (pretext: string, resultsCallback: (results: ProviderResults) => void) => boolean | void;
};

export type AtMentionProviderOptions = {
    currentUserId: string;
    channelId: string;
    autocompleteUsersInChannel: (prefix: string) => Promise<ActionResult>;
    useChannelMentions: boolean;
    autocompleteGroups: Group[] | null;
    searchAssociatedGroupsForReference: (prefix: string) => Promise<ActionResult<Group[]>>;
    priorityProfiles: UserProfile[] | undefined;
    defaultAgent?: Agent;
};

export type CommandProviderOptions = {
    teamId: string;
    channelId: string;
    rootId?: string;
};

export type ChannelMentionProviderArgs = [
    channelSearchFunc: (
        term: string,
        success: (channels: Channel[]) => void,
        error: () => void,
    ) => Promise<ActionResult>,
    delayChannelAutocomplete: boolean,
];

export type PublishedSuggestionProviderConstructors = {
    AtMention: new (options: AtMentionProviderOptions) => SuggestionProviderInstance;
    ChannelMention: new (...args: ChannelMentionProviderArgs) => SuggestionProviderInstance;
    Command: new (options: CommandProviderOptions) => SuggestionProviderInstance;
    Emoticon: new () => SuggestionProviderInstance;
};

export type PublishedSuggestionProviderId = keyof PublishedSuggestionProviderConstructors;

export type PublishedWysiwygEditorHandle = {
    insertText: (text: string) => void;
    focus: () => void;
    blur: () => void;
    getInputBox: () => HTMLElement | null;
};

export type PublishedFormattingBarHandle = {
    openLinkPopover: () => void;
};

export type PublishedEditorUtils = {
    WysiwygEditor: ForwardRefExoticComponent<WysiwygEditorProps & RefAttributes<PublishedWysiwygEditorHandle>>;
    SuggestionList: ComponentType<SuggestionListProps>;
    FormattingBar: ForwardRefExoticComponent<FormattingBarProps & RefAttributes<PublishedFormattingBarHandle>>;
    providers: PublishedSuggestionProviderConstructors;
};
