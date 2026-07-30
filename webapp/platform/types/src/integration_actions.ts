// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {BlockDialog} from './integrations';
import {isArrayOf} from './utilities';

export type PostAction = {
    id?: string;
    type?: string;
    name: string;
    tooltip?: string;
    disabled?: boolean;
    style?: string;
    data_source?: string;
    options?: PostActionOption[];
    default_option?: string;
    cookie?: string;
};

export function isPostAction(v: unknown): v is PostAction {
    if (typeof v !== 'object' || !v) {
        return false;
    }

    if ('id' in v && typeof v.id !== 'string') {
        return false;
    }

    if ('name' in v && typeof v.name !== 'string') {
        return false;
    }

    if ('type' in v && typeof v.type !== 'string') {
        return false;
    }

    if ('disabled' in v && typeof v.disabled !== 'boolean') {
        return false;
    }

    if ('tooltip' in v && typeof v.tooltip !== 'string') {
        return false;
    }

    if ('style' in v && typeof v.style !== 'string') {
        return false;
    }

    if ('data_source' in v && typeof v.data_source !== 'string') {
        return false;
    }

    if ('options' in v && !isArrayOf(v.options, isPostActionOption)) {
        return false;
    }

    if ('default_option' in v && typeof v.default_option !== 'string') {
        return false;
    }

    if ('cookie' in v && typeof v.cookie !== 'string') {
        return false;
    }

    return true;
}

export type PostActionOption = {
    text: string;
    value: string;
};

function isPostActionOption(v: unknown): v is PostActionOption {
    if (typeof v !== 'object' || !v) {
        return false;
    }

    if ('text' in v && typeof v.text !== 'string') {
        return false;
    }

    if ('value' in v && typeof v.value !== 'string') {
        return false;
    }

    return true;
}

/** `integration_format` on the do-post-action API body — identifies which format originally had the action. */
export type PostActionIntegrationFormat =
    | 'attachment' |
    'apps_binding' |
    'block' |
    'card' |
    'mm_block';

export type PostActionResponse = {
    status: string;
    trigger_id: string;
    goto_location?: string;
};

/** Subtype for POST /api/v4/actions/blocks/do — empty defaults to execute on the server. */
export type BlockActionSubtype = 'execute' | 'lookup';

/** Where the block action was triggered — required on doBlockAction requests. */
export type BlockActionContext = 'post' | 'dialog';

export type DoBlockActionRequest = {
    subtype?: BlockActionSubtype;

    /** Where the action was triggered: post interactive message or interactive dialog. */
    context: BlockActionContext;

    /** Optional for dialog-scoped cookies (empty post_id). Required when resolving from a stored post. */
    post_id?: string;

    /**
     * Current channel — dialog context only. Used server-side for ephemeral posts;
     * not forwarded to the upstream integration request.
     */
    channel_id?: string;

    action_id: string;
    cookie?: string;
    selected_option?: string;
    query?: Record<string, string>;
    form_values?: Record<string, string | string[] | boolean | number | null>;
    integration_format?: PostActionIntegrationFormat;
};

export type DialogSelectOption = {
    text: string;
    value: string;
};

export type DoBlockActionResponse = {
    trigger_id?: string;
    goto_location?: string;
    error?: string;
    errors?: Record<string, string>;
    type?: '' | 'ok' | 'refresh' | 'dialog';
    mm_blocks?: unknown[];

    /** Opaque encrypted cookie string for subsequent do-block-action calls. */
    mm_blocks_actions?: string;

    /** New stacked dialog (type "dialog") or in-place refresh when context is dialog (type "refresh"). */
    block_dialog?: BlockDialog;

    /** When true in dialog context, leave the current dialog open (e.g. after stacking a child). */
    keep_dialog_open?: boolean;
    items?: DialogSelectOption[];
};
