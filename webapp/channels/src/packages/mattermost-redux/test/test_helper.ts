// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import {randomUUID} from 'crypto';

import {Command, DialogElement, OAuthApp} from '@mattermost/types/integrations';
import {SystemEmoji, CustomEmoji} from '@mattermost/types/emojis';
import {Bot} from '@mattermost/types/bots';
import {Team, TeamMembership} from '@mattermost/types/teams';
import {Role} from '@mattermost/types/roles';
import {Post, PostMetadata} from '@mattermost/types/posts';
import {Channel, ChannelNotifyProps, ChannelMembership} from '@mattermost/types/channels';
import {Group} from '@mattermost/types/groups';
import {UserProfile, UserNotifyProps} from '@mattermost/types/users';
import {Scheme} from '@mattermost/types/schemes';
import {FileInfo} from '@mattermost/types/files';

import {Client4} from '@mattermost/client';

import General from 'mattermost-redux/constants/general';
import {generateId} from 'mattermost-redux/utils/helpers';

export const DEFAULT_SERVER = 'http://localhost:8065';
const PASSWORD = 'password1';

const {DEFAULT_LOCALE} = General;

class TestHelper {
    basicClient4: Client4 | null;
    basicUser: UserProfile | null;
    basicTeam: Team | null;
    basicTeamMember: TeamMembership | null;
    basicChannel: Channel | null;
    basicChannelMember: ChannelMembership | null;
    basicPost: Post | null;
    basicRoles: Record<string, Role> | null;
    basicScheme: Scheme | null;
    basicGroup: Group | null;

    constructor() {
        this.basicClient4 = null;

        this.basicUser = null;
        this.basicTeam = null;
        this.basicTeamMember = null;
        this.basicChannel = null;
        this.basicChannelMember = null;
        this.basicPost = null;
        this.basicRoles = null;
        this.basicScheme = null;
        this.basicGroup = null;
    }

    activateMocking() {
        if (!nock.isActive()) {
            nock.activate();
        }
    }

    generateId = () => {
        return generateId();
    };

    createClient4 = () => {
        const client = new Client4();

        client.setUrl(DEFAULT_SERVER);

        return client;
    };

    fakeEmail = () => {
        return 'success' + this.generateId() + '@simulator.amazonses.com';
    };

    fakeUser = (): UserProfile => {
        return {
            email: this.fakeEmail(),
            password: PASSWORD,
            locale: DEFAULT_LOCALE,
            username: this.generateId(),
            first_name: this.generateId(),
            last_name: this.generateId(),
            create_at: Date.now(),
            delete_at: 0,
            roles: 'system_user',
            id: 'user_id',
            auth_service: '',
            nickname: '',
            position: '',
            terms_of_service_create_at: 0,
            terms_of_service_id: '',
            update_at: 0,
            is_bot: false,
            props: {},
            notify_props: {
                channel: 'false',
                comments: 'never',
                desktop: 'default',
                desktop_sound: 'false',
                calls_desktop_sound: 'true',
                email: 'false',
                first_name: 'false',
                mark_unread: 'mention',
                mention_keys: '',
                push: 'none',
                push_status: 'offline',
            },
            last_picture_update: 0,
            last_password_update: 0,
            mfa_active: false,
            last_activity_at: 0,
            bot_description: '',
        };
    };

    getUserMock = (override: Partial<UserProfile>): UserProfile => {
        return {
            email: '',
            password: '',
            locale: '',
            username: '',
            first_name: '',
            last_name: '',
            create_at: 0,
            delete_at: 0,
            roles: '',
            id: '',
            auth_service: '',
            nickname: '',
            position: '',
            terms_of_service_create_at: 0,
            terms_of_service_id: '',
            update_at: 0,
            is_bot: false,
            props: {},
            notify_props: {
                channel: 'false',
                comments: 'never',
                desktop: 'default',
                desktop_sound: 'false',
                calls_desktop_sound: 'true',
                email: 'false',
                first_name: 'false',
                mark_unread: 'mention',
                mention_keys: '',
                push: 'none',
                push_status: 'offline',
            },
            last_picture_update: 0,
            last_password_update: 0,
            mfa_active: false,
            last_activity_at: 0,
            bot_description: '',
            ...override,
        };
    };

    fakeUserWithId = (id = this.generateId()) => {
        return {
            ...this.fakeUser(),
            id,
            create_at: 1507840900004,
            update_at: 1507840900004,
            delete_at: 0,
        };
    };

    fakeUserWithStatus = (status: string, id = this.generateId()) => {
        return {
            ...this.fakeUser(),
            id,
            status,
            create_at: 1507840900004,
            update_at: 1507840900004,
            delete_at: 0,
        };
    };

    fakeTeam = (): Team => {
        const name = this.generateId();
        let inviteId = this.generateId();
        if (inviteId.length > 32) {
            inviteId = inviteId.substring(0, 32);
        }

        return {
            id: 'team_id',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            name,
            display_name: `Unit Test ${name}`,
            type: 'O',
            email: this.fakeEmail(),
            allowed_domains: '',
            invite_id: inviteId,
            scheme_id: this.generateId(),
            allow_open_invite: false,
            group_constrained: false,
            description: '',
            company_name: '',
        };
    };

    fakeTeamWithId = (): Team => {
        return {
            ...this.fakeTeam(),
            id: this.generateId(),
            create_at: 1507840900004,
            update_at: 1507840900004,
            delete_at: 0,
        };
    };

    fakeTeamMember = (userId: string, teamId: string): TeamMembership => {
        return {
            user_id: userId,
            team_id: teamId,
            roles: 'team_user',
            delete_at: 0,
            scheme_user: false,
            scheme_admin: false,

            mention_count: 0,
            msg_count: 0,
            mention_count_root: 0,
            msg_count_root: 0,
            scheme_guest: false,
        };
    };

    fakeOutgoingHook = (teamId: string) => {
        return {
            team_id: teamId,
        };
    };

    fakeOutgoingHookWithId = (teamId: string) => {
        return {
            ...this.fakeOutgoingHook(teamId),
            id: this.generateId(),
        };
    };

    mockScheme = (): Scheme => {
        return {
            name: this.generateId(),
            description: this.generateId(),
            scope: 'channel',
            id: '',
            display_name: '',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            default_team_admin_role: '',
            default_team_user_role: '',
            default_team_guest_role: '',
            default_channel_admin_role: '',
            default_channel_user_role: '',
            default_channel_guest_role: '',
            default_playbook_admin_role: '',
            default_playbook_member_role: '',
            default_run_member_role: '',
        };
    };

    mockSchemeWithId = (): Scheme => {
        return {
            ...this.mockScheme(),
            id: this.generateId(),
            create_at: 1507840900004,
            update_at: 1507840900004,
            delete_at: 0,
        };
    };

    testIncomingHook = () => {
        return {
            id: this.generateId(),
            create_at: 1507840900004,
            update_at: 1507840900004,
            delete_at: 0,
            user_id: this.basicUser!.id,
            channel_id: this.basicChannel!.id,
            team_id: this.basicTeam!.id,
            display_name: 'test',
            description: 'test',
        };
    };

    testOutgoingHook = () => {
        return {
            id: this.generateId(),
            token: this.generateId(),
            create_at: 1507841118796,
            update_at: 1507841118796,
            delete_at: 0,
            creator_id: this.basicUser!.id,
            channel_id: this.basicChannel!.id,
            team_id: this.basicTeam!.id,
            trigger_words: ['testword'],
            trigger_when: 0,
            callback_urls: ['http://localhost/notarealendpoint'],
            display_name: 'test',
            description: '',
            content_type: 'application/x-www-form-urlencoded',
        };
    };

    testCommand = (teamId: string): Command => {
        return {
            id: '',
            token: '',
            trigger: this.generateId(),
            method: 'P',
            create_at: 1507841118796,
            update_at: 1507841118796,
            delete_at: 0,
            creator_id: this.basicUser!.id,
            team_id: teamId,
            username: 'test',
            icon_url: 'http://localhost/notarealendpoint',
            auto_complete: true,
            auto_complete_desc: 'test',
            auto_complete_hint: 'test',
            display_name: 'test',
            description: 'test',
            url: 'http://localhost/notarealendpoint',
        };
    };

    fakeMarketplacePlugin = () => {
        return {
            homepage_url: 'http://myplugin.com',
            download_url: 'http://github.myplugin.tar.gz',
            download_signature_url: 'http://github.myplugin.tar.gz.asc',
            manifest:
                {
                    id: 'com.mattermost.fake-plugin',
                    name: 'Fake Plugin',
                    description: 'This plugin is for Redux testing purposes',
                    version: '0.1.0',
                    min_server_version: '5.12.0',
                },
        };
    };

    fakeChannel = (teamId: string): Channel => {
        const name = this.generateId();

        return {
            name,
            team_id: teamId,
            display_name: `Unit Test ${name}`,
            type: 'O',
            delete_at: 0,
            scheme_id: this.generateId(),

            id: 'channel_id',
            create_at: 0,
            update_at: 0,
            header: 'header',
            purpose: 'purpose',
            last_post_at: 0,
            last_root_post_at: 0,
            creator_id: 'id',
            group_constrained: false,
        };
    };

    fakeChannelOverride = (override: Partial<Channel>): Channel => {
        return {
            name: '',
            team_id: '',
            display_name: '',
            type: 'O',
            delete_at: 0,
            scheme_id: '',
            id: '',
            create_at: 0,
            update_at: 0,
            header: '',
            purpose: '',
            last_post_at: 0,
            last_root_post_at: 0,
            creator_id: '',
            group_constrained: false,
            ...override,
        };
    };

    getChannelMock = (override?: Partial<Channel>) => {
        return Object.assign(this.fakeChannel(override?.team_id || ''), override);
    };

    fakeChannelWithId = (teamId: string) => {
        return {
            ...this.fakeChannel(teamId),
            id: this.generateId(),
            create_at: 1507840900004,
            update_at: 1507840900004,
            delete_at: 0,
        };
    };

    fakeDmChannel = (userId: string, otherUserId: string) => {
        return {
            name: userId > otherUserId ? otherUserId + '__' + userId : userId + '__' + otherUserId,
            team_id: '',
            display_name: `${otherUserId}`,
            type: 'D',
            status: 'offline',
            teammate_id: `${otherUserId}`,
            id: this.generateId(),
            delete_at: 0,
        };
    };

    fakeGmChannel = (...usernames: string[]) => {
        return {
            name: randomUUID(),
            team_id: '',
            display_name: usernames.join(','),
            type: 'G',
            id: this.generateId(),
            delete_at: 0,
        };
    };

    fakeChannelMember = (userId: string, channelId: string): ChannelMembership => {
        return {
            user_id: userId,
            channel_id: channelId,
            notify_props: {},
            roles: 'system_user',
            last_viewed_at: 0,
            msg_count: 0,
            msg_count_root: 0,
            mention_count: 0,
            mention_count_root: 0,
            urgent_mention_count: 0,
            scheme_user: false,
            scheme_admin: false,
            last_update_at: 0,
        };
    };

    fakeChannelNotifyProps = (override: Partial<ChannelNotifyProps>): ChannelNotifyProps => {
        return {
            desktop: 'default',
            desktop_sound: 'off',
            email: 'default',
            mark_unread: 'mention',
            push: 'default',
            ignore_channel_mentions: 'default',
            channel_auto_follow_threads: 'off',
            ...override,
        };
    };

    fakeUserNotifyProps = (override: Partial<UserNotifyProps>): UserNotifyProps => {
        return {
            desktop: 'default',
            desktop_sound: 'true',
            calls_desktop_sound: 'true',
            email: 'true',
            mark_unread: 'all',
            push: 'default',
            push_status: 'ooo',
            comments: 'never',
            first_name: 'true',
            channel: 'true',
            mention_keys: '',
            ...override,
        };
    };

    fakePost = (channelId: string): Post => {
        return {
            channel_id: channelId,
            message: `Unit Test ${this.generateId()}`,
            type: '',

            edit_at: 0,
            original_id: '',
            hashtags: '',
            pending_post_id: '',
            reply_count: 0,
            metadata: {
                embeds: [],
                emojis: [],
                images: {},
                reactions: [],
            } as unknown as PostMetadata, // coercion because an existing test relies on this not having files
            create_at: 0,
            delete_at: 0,
            id: 'id',
            is_pinned: false,
            props: {},
            root_id: '',
            update_at: 0,
            user_id: 'user_id',
        };
    };

    fakePostOverride = (override: Partial<Post>): Post => {
        return {
            channel_id: '',
            message: '',
            type: '',
            edit_at: 0,
            original_id: '',
            hashtags: '',
            pending_post_id: '',
            reply_count: 0,
            metadata: {
                embeds: [],
                emojis: [],
                images: {},
                reactions: [],
                files: [],
            },
            create_at: 0,
            delete_at: 0,
            id: '',
            is_pinned: false,
            props: {},
            root_id: '',
            update_at: 0,
            user_id: '',
            ...override,
        };
    };

    getPostMock = (override?: Partial<Post>) => {
        return Object.assign(this.fakePost(override?.channel_id || ''), override);
    };

    fakePostWithId = (channelId: string): Post => {
        return {
            ...this.fakePost(channelId),
            id: this.generateId(),
            create_at: 1507840900004,
            update_at: 1507840900004,
            delete_at: 0,
        };
    };

    getFileInfoMock = (override: Partial<FileInfo>): FileInfo => {
        return {
            id: '',
            user_id: '',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            name: '',
            extension: '',
            size: 0,
            mime_type: '',
            has_preview_image: false,
            width: 0,
            height: 0,
            clientId: '',
            archived: false,
            ...override,
        };
    };

    fakeFiles = (count: number): FileInfo[] => {
        const files = [];
        while (files.length < count) {
            files.push({
                id: this.generateId(),
                user_id: 'user_id',
                create_at: 1,
                update_at: 1,
                delete_at: 1,
                name: 'name',
                extension: 'jpg',
                size: 1,
                mime_type: 'mime_type',
                has_preview_image: true,
                width: 350,
                height: 200,
                clientId: 'client_id',
                archived: false,
            });
        }

        return files;
    };

    fakeOAuthApp = (): OAuthApp => {
        return {
            id: '',
            creator_id: '',
            create_at: 0,
            client_secret: '',
            name: this.generateId(),
            callback_urls: ['http://localhost/notrealurl'],
            homepage: 'http://localhost/notrealurl',
            description: 'fake app',
            is_trusted: false,
            icon_url: 'http://localhost/notrealurl',
            update_at: 1507841118796,
        };
    };

    fakeOAuthAppWithId = () => {
        return {
            ...this.fakeOAuthApp(),
            id: this.generateId(),
        };
    };

    fakeBot = (): Bot => {
        return {
            user_id: this.generateId(),
            username: this.generateId(),
            display_name: 'Fake bot',
            owner_id: this.generateId(),
            create_at: 1507840900004,
            update_at: 1507840900004,
            delete_at: 0,
            description: '',
        };
    };

    fakeGroup = (groupId: string, source = 'ldap'): Group => {
        const name = 'software-engineers';

        return {
            name,
            id: groupId,
            display_name: 'software engineers',
            delete_at: 0,
            allow_reference: true,
            source,

            description: '',
            remote_id: '',
            create_at: 1,
            update_at: 1,
            has_syncables: false,
            member_count: 0,
            scheme_admin: false,
        };
    };

    fakeGroupWithId = (groupId: string): Group => {
        return {
            ...this.fakeGroup(groupId),
            id: this.generateId(),
            create_at: 1507840900004,
            update_at: 1507840900004,
            delete_at: 0,
        };
    };

    getCustomEmojiMock(override: Partial<CustomEmoji>): CustomEmoji {
        return {
            id: 'emoji_id',
            name: 'emoji',
            category: 'custom',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            creator_id: 'user_id',
            ...override,
        };
    }

    getSystemEmojiMock(override: Partial<SystemEmoji>): SystemEmoji {
        return {
            name: '',
            category: 'recent',
            image: '',
            short_name: '',
            short_names: [],
            batch: 0,
            unified: '',
            ...override,
        };
    }

    getDialogElementMock(override: Partial<DialogElement>): DialogElement {
        return {
            display_name: '',
            name: '',
            type: '',
            subtype: '',
            default: '',
            placeholder: '',
            help_text: '',
            optional: false,
            min_length: 0,
            max_length: 0,
            data_source: '',
            options: [],
            ...override,
        };
    }

    getRoleMock(override: Partial<Role>): Role {
        return {
            id: '',
            name: '',
            display_name: '',
            description: '',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            permissions: [],
            scheme_managed: false,
            built_in: false,
            ...override,
        };
    }

    mockLogin = () => {
        const clientBaseRoute = this.basicClient4!.getBaseRoute();
        nock(clientBaseRoute).
            post('/users/login').
            reply(200, this.basicUser!, {'X-Version-Id': 'Server Version'});

        nock(clientBaseRoute).
            get('/users/me').
            reply(200, this.basicUser!);

        nock(clientBaseRoute).
            get('/users/me/teams/members').
            reply(200, [this.basicTeamMember]);

        nock(clientBaseRoute).
            get('/users/me/teams/unread?include_collapsed_threads=true').
            reply(200, [{team_id: this.basicTeam!.id, msg_count: 0, mention_count: 0}]);

        nock(clientBaseRoute).
            get('/users/me/teams').
            reply(200, [this.basicTeam]);

        nock(clientBaseRoute).
            get('/users/me/preferences').
            reply(200, [{user_id: this.basicUser!.id, category: 'tutorial_step', name: this.basicUser!.id, value: '999'}]);
    };

    initMockEntities = () => {
        this.basicUser = this.fakeUserWithId();
        this.basicUser.roles = 'system_user system_admin';
        this.basicTeam = this.fakeTeamWithId();
        this.basicTeamMember = this.fakeTeamMember(this.basicUser.id, this.basicTeam.id);
        this.basicChannel = this.fakeChannelWithId(this.basicTeam.id);
        this.basicChannelMember = this.fakeChannelMember(this.basicUser.id, this.basicChannel.id);
        this.basicPost = {...this.fakePostWithId(this.basicChannel.id), create_at: 1507841118796};
        this.basicRoles = {
            system_admin: {
                id: this.generateId(),
                name: 'system_admin',
                display_name: 'authentication.roles.global_admin.name',
                description: 'authentication.roles.global_admin.description',
                permissions: [
                    'system_admin_permission',
                ],
                scheme_managed: true,
                built_in: true,
                create_at: 0,
                update_at: 0,
                delete_at: 0,
            },
            system_user: {
                id: this.generateId(),
                name: 'system_user',
                display_name: 'authentication.roles.global_user.name',
                description: 'authentication.roles.global_user.description',
                permissions: [
                    'system_user_permission',
                ],
                scheme_managed: true,
                built_in: true,
                create_at: 0,
                update_at: 0,
                delete_at: 0,
            },
            team_admin: {
                id: this.generateId(),
                name: 'team_admin',
                display_name: 'authentication.roles.team_admin.name',
                description: 'authentication.roles.team_admin.description',
                permissions: [
                    'team_admin_permission',
                ],
                scheme_managed: true,
                built_in: true,
                create_at: 0,
                update_at: 0,
                delete_at: 0,
            },
            team_user: {
                id: this.generateId(),
                name: 'team_user',
                display_name: 'authentication.roles.team_user.name',
                description: 'authentication.roles.team_user.description',
                permissions: [
                    'team_user_permission',
                ],
                scheme_managed: true,
                built_in: true,
                create_at: 0,
                update_at: 0,
                delete_at: 0,
            },
            channel_admin: {
                id: this.generateId(),
                name: 'channel_admin',
                display_name: 'authentication.roles.channel_admin.name',
                description: 'authentication.roles.channel_admin.description',
                permissions: [
                    'channel_admin_permission',
                ],
                scheme_managed: true,
                built_in: true,
                create_at: 0,
                update_at: 0,
                delete_at: 0,
            },
            channel_user: {
                id: this.generateId(),
                name: 'channel_user',
                display_name: 'authentication.roles.channel_user.name',
                description: 'authentication.roles.channel_user.description',
                permissions: [
                    'channel_user_permission',
                ],
                scheme_managed: true,
                built_in: true,
                create_at: 0,
                update_at: 0,
                delete_at: 0,
            },
        };
        this.basicScheme = this.mockSchemeWithId();
        this.basicGroup = this.fakeGroupWithId('');
    };

    initBasic = (client4 = this.createClient4()) => {
        client4.setUrl(DEFAULT_SERVER);
        this.basicClient4 = client4;

        this.initMockEntities();
        this.activateMocking();

        return {
            client4: this.basicClient4,
            user: this.basicUser,
            team: this.basicTeam,
            channel: this.basicChannel,
            post: this.basicPost,
        };
    };

    tearDown = () => {
        nock.restore();

        this.basicClient4 = null;
        this.basicUser = null;
        this.basicTeam = null;
        this.basicTeamMember = null;
        this.basicChannel = null;
        this.basicChannelMember = null;
        this.basicPost = null;
    };

    wait = (time: number) => new Promise((resolve) => setTimeout(resolve, time));
}

export default new TestHelper();
