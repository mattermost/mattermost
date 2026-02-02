// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type CustomChannelIcon = {
    id: string;
    name: string;
    svg: string; // Base64-encoded SVG content
    normalize_color: boolean;
    create_at: number;
    update_at: number;
    delete_at: number;
    created_by: string;
};

export type CustomChannelIconCreate = Omit<CustomChannelIcon, 'id' | 'create_at' | 'update_at' | 'delete_at' | 'created_by'>;

export type CustomChannelIconPatch = {
    name?: string;
    svg?: string;
    normalize_color?: boolean;
};
