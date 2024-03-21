// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AppManifest} from './apps';
import type {PluginManifest} from './plugins';

export type MarketplaceLabel = {
    name: string;
    description?: string;
    url?: string;
}

export enum HostingType {
    OnPrem = 'on-prem',
    Cloud = 'cloud',
}

export enum AuthorType {
    Mattermost = 'mattermost',
    Partner = 'partner',
    Community = 'community',
}

export enum ReleaseStage {
    Production = 'production',
    Beta = 'beta',
    Experimental = 'experimental',
}

interface MarketplaceBaseItem {
    labels?: MarketplaceLabel[];
    hosting?: HostingType;
    author_type: AuthorType;
    release_stage: ReleaseStage;
    enterprise: boolean;
}

export interface MarketplacePlugin extends MarketplaceBaseItem {
    manifest: PluginManifest;
    icon_data?: string;
    homepage_url?: string;
    download_url?: string;
    release_notes_url?: string;
    installed_version?: string;
}

export interface MarketplaceApp extends MarketplaceBaseItem {
    manifest: AppManifest;
    installed: boolean;
    icon_url?: string;
}
