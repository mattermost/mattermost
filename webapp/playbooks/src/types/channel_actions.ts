// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface ChannelAction {
    id?: string;
    channel_id: string;
    enabled: boolean;
    delete_at?: number;
    action_type: ChannelActionType;
    trigger_type: ChannelTriggerType;
    payload: PayloadType;
}

export enum ChannelActionType {
    WelcomeMessage = 'send_welcome_message',
    PromptRunPlaybook = 'prompt_run_playbook',
    CategorizeChannel = 'categorize_channel',
}

export enum ChannelTriggerType {
    NewMemberJoins = 'new_member_joins',
    KeywordsPosted = 'keywords',
}

export type PayloadType =
    | WelcomeMessageActionPayload
    | PromptRunPlaybookFromKeywordsPayload
    | CategorizeChannelPayload;

export interface WelcomeMessageActionPayload {
    message: string;
}

export interface PromptRunPlaybookFromKeywordsPayload {
    keywords: string[];
    playbook_id: string;
}

export interface CategorizeChannelPayload {
    category_name: string;
}
