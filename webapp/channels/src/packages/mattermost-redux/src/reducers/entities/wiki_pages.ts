// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';

import type {SelectPropertyField} from '@mattermost/types/properties';

import {UserTypes, WikiTypes} from 'mattermost-redux/action_types';

export default function wikiPages(state: SelectPropertyField | null = null, action: AnyAction): SelectPropertyField | null {
    switch (action.type) {
    case WikiTypes.RECEIVED_PAGE_STATUS_FIELD:
        return action.data;
    case UserTypes.LOGOUT_SUCCESS:
        return null;
    default:
        return state;
    }
}

export type WikiPagesState = SelectPropertyField | null;
