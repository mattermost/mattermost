// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AdminState} from './admin';
import {Bot} from './bots';
import {ChannelsState} from './channels';
import {ChannelCategoriesState} from './channel_categories';
import {CloudState, CloudUsage} from './cloud';
import {HostedCustomerState} from './hosted_customer';
import {EmojisState} from './emojis';
import {FilesState} from './files';
import {GeneralState} from './general';
import {GroupsState} from './groups';
import {IntegrationsState} from './integrations';
import {JobsState} from './jobs';
import {PostsState} from './posts';
import {PreferenceType} from './preferences';
import {
    AdminRequestsStatuses, ChannelsRequestsStatuses,
    FilesRequestsStatuses, GeneralRequestsStatuses,
    PostsRequestsStatuses, RolesRequestsStatuses,
    TeamsRequestsStatuses, UsersRequestsStatuses,
} from './requests';
import {Role} from './roles';
import {SchemesState} from './schemes';
import {SearchState} from './search';
import {TeamsState} from './teams';
import {ThreadsState} from './threads';
import {Typing} from './typing';
import {UsersState} from './users';
import {AppsState} from './apps';
import {GifsState} from './gifs';

export type GlobalState = {
    entities: {
        general: GeneralState;
        users: UsersState;
        teams: TeamsState;
        channels: ChannelsState;
        posts: PostsState;
        threads: ThreadsState;
        bots: {
            accounts: Record<string, Bot>;
        };
        preferences: {
            myPreferences: {
                [x: string]: PreferenceType;
            };
        };
        admin: AdminState;
        jobs: JobsState;
        search: SearchState;
        integrations: IntegrationsState;
        files: FilesState;
        emojis: EmojisState;
        typing: Typing;
        roles: {
            roles: {
                [x: string]: Role;
            };
            pending: Set<string>;
        };
        schemes: SchemesState;
        gifs: GifsState;
        groups: GroupsState;
        channelCategories: ChannelCategoriesState;
        apps: AppsState;
        cloud: CloudState;
        hostedCustomer: HostedCustomerState;
        usage: CloudUsage;
    };
    errors: any[];
    requests: {
        channels: ChannelsRequestsStatuses;
        general: GeneralRequestsStatuses;
        posts: PostsRequestsStatuses;
        teams: TeamsRequestsStatuses;
        users: UsersRequestsStatuses;
        admin: AdminRequestsStatuses;
        files: FilesRequestsStatuses;
        roles: RolesRequestsStatuses;
    };
    websocket: {
        connected: boolean;
        lastConnectAt: number;
        lastDisconnectAt: number;
        connectionId: string;
    };
};
