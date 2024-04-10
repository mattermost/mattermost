// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from './channels';
import type {Team} from './teams';
import type {UserProfile} from './users';
import type {IDMappedObjects, RelationOneToOne} from './utilities';

export type ChannelCategoryType = 'favorites' | 'channels' | 'direct_messages' | 'custom';

export enum CategorySorting {
    Alphabetical = 'alpha',
    Default = '', // behaves the same as manual
    Recency = 'recent',
    Manual = 'manual',
}

export type ChannelCategory = {
    id: string;
    user_id: UserProfile['id'];
    team_id: Team['id'];
    type: ChannelCategoryType;
    display_name: string;
    sorting: CategorySorting;
    channel_ids: Array<Channel['id']>;
    muted: boolean;
    collapsed: boolean;
};

export type OrderedChannelCategories = {
    categories: ChannelCategory[];
    order: string[];
};

export type ChannelCategoriesState = {
    byId: IDMappedObjects<ChannelCategory>;
    orderByTeam: RelationOneToOne<Team, Array<ChannelCategory['id']>>;
};
