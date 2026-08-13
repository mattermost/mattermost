// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from './channels';

// Equivalent to MessageDescriptor from react-intl
type MessageDescriptor = {
    id: string;
    defaultMessage: string;
};

export type PluginManifest = {
    id: string;
    name: string;
    description?: string;
    homepage_url?: string;
    support_url?: string;
    release_notes_url?: string;
    icon_path?: string;
    version: string;
    min_server_version?: string;
    translate?: boolean;
    server?: PluginManifestServer;
    backend?: PluginManifestServer;
    webapp?: PluginManifestWebapp;
    settings_schema?: PluginSettingsSchema;
    props?: Record<string, any>;
};

export type PluginRedux = PluginManifest & {active: boolean};

export type PluginManifestServer = {
    executables?: {
        'linux-amd64'?: string;
        'darwin-amd64'?: string;
        'windows-amd64'?: string;
    };
    executable: string;
};

export type PluginManifestWebapp = {
    bundle_path: string;
};

export type PluginSettingsSchema = {
    header: string;
    footer: string;
    settings: PluginSetting[];
    sections?: PluginSettingSection[];
};

export type PluginSettingSection = {
    key: string;
    title?: string;
    subtitle?: string;
    settings: PluginSetting[];
    header?: string;
    footer?: string;
    custom?: boolean;
    fallback?: boolean;
};

export type PluginSetting = {
    key: string;
    display_name: string;
    type: string;
    help_text: string | MessageDescriptor;
    regenerate_help_text?: string;
    placeholder: string;
    default: any;
    options?: PluginSettingOption[];
    hosting?: 'on-prem' | 'cloud';
};

export type PluginSettingOption = {
    display_name: string;
    value: string;
};

export type PluginsResponse = {
    active: PluginManifest[];
    inactive: PluginManifest[];
};

export type PluginStatus = {
    plugin_id: string;
    cluster_id: string;
    plugin_path: string;
    state: number;
    name: string;
    description: string;
    version: string;
};

type PluginInstance = {
    cluster_id: string;
    version: string;
    state: number;
};

export type PluginStatusRedux = {
    id: string;
    name: string;
    description: string;
    version: string;
    active: boolean;
    state: number;
    error?: string;
    instances: PluginInstance[];
};

export type ClientPluginManifest = {
    id: string;
    name: string;
    min_server_version?: string;
    version: string;
    webapp: {
        bundle_path: string;
    };
};

export type MarketplaceLabel = { // TODO remove this in favour of the definition in types/marketplace after the mattermost-redux migration
    name: string;
    description?: string;
    url?: string;
    color?: string;
};

export enum HostingType { // TODO remove this in favour of the definition in types/marketplace after the mattermost-redux migration
    OnPrem = 'on-prem',
    Cloud = 'cloud',
}

export enum AuthorType { // TODO remove this in favour of the definition in types/marketplace after the mattermost-redux migration
    Mattermost = 'mattermost',
    Partner = 'partner',
    Community = 'community',
}

export enum ReleaseStage { // TODO remove this in favour of the definition in types/marketplace after the mattermost-redux migration
    Production = 'production',
    Beta = 'beta',
    Experimental = 'experimental',
}

export type MarketplacePlugin = { // TODO remove this in favour of the definition in types/marketplace after the mattermost-redux migration
    homepage_url?: string;
    icon_data?: string;
    download_url?: string;
    release_notes_url?: string;
    labels?: MarketplaceLabel[];
    hosting?: HostingType;
    author_type: AuthorType;
    release_stage: ReleaseStage;
    enterprise: boolean;
    manifest: PluginManifest;
    installed_version?: string;
};

/**
 * Snapshot of the "Create a new channel" modal's form, passed to a plugin's channel-type option
 * (both its `extraContent` component and its `onCreate` handler). `type` is the id of the selected
 * channel-type option: 'O' or 'P' for the built-in public/private types, otherwise the registered
 * option's id. All fields are read-only; the plugin does not write back into the modal.
 */
export type NewChannelFormState = {
    teamId: string;
    displayName: string;
    url: string;
    purpose: string;
    type: string;
    defaultCategoryName?: string;
    managedCategoryName?: string;
    classificationId?: string;
    bannerText?: string;
};

/**
 * Discriminated union returned by a channel-type option's `onCreate` handler.
 * - `created`: plugin created the channel successfully; the modal switches to `channel`.
 * - `deferred`: plugin will finish creation asynchronously; the modal closes immediately.
 * - `error`: plugin encountered an error; the modal displays `message`.
 */
export type NewChannelFormResult =
    {status: 'created'; channel: Channel} |
    {status: 'deferred'} |
    {status: 'error'; message: string};
