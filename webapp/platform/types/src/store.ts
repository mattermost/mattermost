// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminState} from './admin';
import type {AppsState} from './apps';
import type {Bot} from './bots';
import type {ChannelCategoriesState} from './channel_categories';
import type {ChannelsState} from './channels';
import type {CloudState, CloudUsage} from './cloud';
import type {EmojisState} from './emojis';
import type {FilesState} from './files';
import type {GeneralState} from './general';
import type {GroupsState} from './groups';
import type {HostedCustomerState} from './hosted_customer';
import type {IntegrationsState} from './integrations';
import type {JobsState} from './jobs';
import type {LimitsState} from './limits';
import type {PostsState} from './posts';
import type {PreferenceType} from './preferences';
import type {
    AdminRequestsStatuses, ChannelsRequestsStatuses,
    FilesRequestsStatuses, GeneralRequestsStatuses,
    PostsRequestsStatuses, RolesRequestsStatuses,
    TeamsRequestsStatuses, UsersRequestsStatuses,
} from './requests';
import type {Role} from './roles';
import type {SchemesState} from './schemes';
import type {SearchState} from './search';
import type {TeamsState} from './teams';
import type {ThreadsState} from './threads';
import type {Typing} from './typing';
import type {UsersState} from './users';

export type GlobalState = {
    entities: {
        general: GeneralState;
        users: UsersState;
        limits: LimitsState;
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
