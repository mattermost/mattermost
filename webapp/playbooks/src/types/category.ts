// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export enum CategoryItemType {
    PlaybookItemType = 'p',
    RunItemType = 'r',
}

export interface CategoryItem {
    item_id: string
    type: CategoryItemType
    name: string
    public: boolean;
}

export interface Category {
    id: string;
    name: string;
    team_id: string;
    user_id: string;
    collapsed: boolean;
    create_at: number;
    update_at: number;
    delete_at: number;
    items: CategoryItem[];
}

