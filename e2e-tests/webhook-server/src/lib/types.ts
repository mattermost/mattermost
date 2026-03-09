// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { Request, Response } from "express";

export interface ServerContext {
    baseUrl: string | null;
    webhookBaseUrl: string | null;
    adminUsername: string | null;
    adminPassword: string | null;
}

export interface ServiceMeta {
    description?: string;
    type?: string;
    action?: string;
    dialog?: string;
    subcommand_map?: Record<string, string>;
    default_dialog?: string;
    lookup?: string;
    listServices?: () => ServiceInfo[];
}

export interface ServiceInfo {
    method: string;
    path: string;
    type: string;
    description: string;
    dynamic?: boolean;
}

export interface HandlerArgs {
    req: Request;
    res: Response;
    body: Record<string, any> | null;
    query: Record<string, string>;
    context: ServerContext;
    meta: ServiceMeta;
}

export type Handler = (args: HandlerArgs) => void | Promise<void>;

// Aligned with server model.DialogElement
export interface DialogElement {
    type: string;
    display_name: string;
    name: string;
    optional?: boolean;
    placeholder?: string;
    help_text?: string;
    default?: string;
    subtype?: string;
    min_length?: number;
    max_length?: number;
    data_source?: string;
    data_source_url?: string;
    options?: Array<{ text: string; value: string }> | null;
    refresh?: boolean;
    multiselect?: boolean;
    min_date?: string;
    time_interval?: number;
    datetime_config?: Record<string, any>;
    _data_source_url_path?: string;
}

// Aligned with server model.Dialog
export interface DialogConfig {
    callback_id: string;
    title: string;
    icon_url?: string;
    submit_label?: string;
    introduction_text?: string;
    state?: string;
    elements?: DialogElement[];
    _submit_url_path?: string;
    _source_url_path?: string;
    include_defaults_variant?: Record<string, string>;
}
