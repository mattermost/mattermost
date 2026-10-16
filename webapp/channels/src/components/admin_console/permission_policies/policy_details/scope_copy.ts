// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

export type PolicyScope = 'user' | 'bot';

type ScopeCopy = {
    whoSubtitle: MessageDescriptor;
    attributesTitle: MessageDescriptor;
    attributesSubtitle: MessageDescriptor;
    tableHelp: MessageDescriptor;
    tableEmpty: MessageDescriptor;
};

// tableHelp/tableEmpty reuse TableEditor's own default ids, so their defaultMessages must match table_editor.tsx exactly.
const userCopy = defineMessages({
    whoSubtitle: {id: 'admin.permission_policies.edit.who.subtitle', defaultMessage: 'Define rules based on user attributes and values'},
    attributesTitle: {id: 'admin.permission_policies.edit.who.attributes_title', defaultMessage: 'User attribute requirements'},
    attributesSubtitle: {id: 'admin.permission_policies.edit.who.attributes_subtitle', defaultMessage: 'Select attributes and values that users must have for this policy'},
    tableHelp: {id: 'admin.access_control.table_editor.help_text', defaultMessage: 'Each row is a single condition that must be met for a user to comply with the policy. All rules are combined with logical AND operator (`&&`).'},
    tableEmpty: {id: 'admin.access_control.table_editor.blank_state', defaultMessage: 'Select a user attribute and values to create a rule'},
});

const botCopy = defineMessages({
    whoSubtitle: {id: 'admin.permission_policies.edit.who.subtitle_bot', defaultMessage: 'Define rules based on bot attributes and values'},
    attributesTitle: {id: 'admin.permission_policies.edit.who.attributes_title_bot', defaultMessage: 'Bot attribute requirements'},
    attributesSubtitle: {id: 'admin.permission_policies.edit.who.attributes_subtitle_bot', defaultMessage: 'Select attributes and values that bots must have for this policy'},
    tableHelp: {id: 'admin.permission_policies.edit.table_help_text_bot', defaultMessage: 'Each row is a single condition that must be met for a bot to comply with the policy. All rules are combined with logical AND operator (`&&`).'},
    tableEmpty: {id: 'admin.permission_policies.edit.table_empty_bot', defaultMessage: 'Select a bot attribute and values to create a rule'},
});

export const SCOPE_COPY: Record<PolicyScope, ScopeCopy> = {
    user: userCopy,
    bot: botCopy,
};
