// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MessageAttachment} from './message_attachments';
import {IDMappedObjects} from './utilities';

export type IncomingWebhook = {
    id: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    user_id: string;
    channel_id: string;
    team_id: string;
    display_name: string;
    description: string;
    username: string;
    icon_url: string;
    channel_locked: boolean;
};

export type OutgoingWebhook = {
    id: string;
    token: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    creator_id: string;
    channel_id: string;
    team_id: string;
    trigger_words: string[];
    trigger_when: number;
    callback_urls: string[];
    display_name: string;
    description: string;
    content_type: string;
    username: string;
    icon_url: string;
};

export type Command = {
    'id': string;
    'token': string;
    'create_at': number;
    'update_at': number;
    'delete_at': number;
    'creator_id': string;
    'team_id': string;
    'trigger': string;
    'method': 'P' | 'G' | '';
    'username': string;
    'icon_url': string;
    'auto_complete': boolean;
    'auto_complete_desc': string;
    'auto_complete_hint': string;
    'display_name': string;
    'description': string;
    'url': string;
};

export type CommandArgs = {
    channel_id: string;
    team_id?: string;
    root_id?: string;
}

export type CommandResponse = {
    response_type: string;
    text: string;
    username: string;
    channel_id: SVGAnimatedString;
    icon_url: string;
    type: string;
    props: Record<string, any>;
    goto_location: string;
    trigger_id: string;
    skip_slack_parsing: boolean;
    attachments: MessageAttachment[];
    extra_responses: CommandResponse[];
};

export type AutocompleteSuggestion = {
    Complete: string;
    Suggestion: string;
    Hint: string;
    Description: string;
    IconData: string;
    type?: string;
};

export type CommandAutocompleteSuggestion = AutocompleteSuggestion; // TODO remove this alias after the mattermost-redux migration

export type OAuthApp = {
    'id': string;
    'creator_id': string;
    'create_at': number;
    'update_at': number;
    'client_secret': string;
    'name': string;
    'description': string;
    'icon_url': string;
    'callback_urls': string[];
    'homepage': string;
    'is_trusted': boolean;
};

export type IntegrationsState = {
    incomingHooks: IDMappedObjects<IncomingWebhook>;
    outgoingHooks: IDMappedObjects<OutgoingWebhook>;
    oauthApps: IDMappedObjects<OAuthApp>;
    appsOAuthAppIDs: string[];
    appsBotIDs: string[];
    systemCommands: IDMappedObjects<Command>;
    commands: IDMappedObjects<Command>;
};

export type DialogSubmission = {
    url: string;
    callback_id: string;
    state: string;
    user_id: string;
    channel_id: string;
    team_id: string;
    submission: {
        [x: string]: string;
    };
    cancelled: boolean;
};

export type DialogElement = {
    display_name: string;
    name: string;
    type: string;
    subtype: string;
    default: string;
    placeholder: string;
    help_text: string;
    optional: boolean;
    min_length: number;
    max_length: number;
    data_source: string;
    options: Array<{
        text: string;
        value: any;
    }>;
};

export type SubmitDialogResponse = {
    error?: string;
    errors?: Record<string, string>;
};
