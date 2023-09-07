// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Bot} from '@mattermost/types/bots';
import {CategorySorting} from '@mattermost/types/channel_categories';
import type {ChannelCategory} from '@mattermost/types/channel_categories';
import type {Channel, ChannelMembership, ChannelNotifyProps, ChannelWithTeamData} from '@mattermost/types/channels';
import type {Invoice, Product, Subscription, CloudCustomer} from '@mattermost/types/cloud';
import type {ClientLicense} from '@mattermost/types/config';
import type {SystemEmoji, CustomEmoji} from '@mattermost/types/emojis';
import type {FileInfo} from '@mattermost/types/files';
import type {Group} from '@mattermost/types/groups';
import type {Command, IncomingWebhook, OutgoingWebhook} from '@mattermost/types/integrations';
import type {Post} from '@mattermost/types/posts';
import type {PreferenceType} from '@mattermost/types/preferences';
import type {Reaction} from '@mattermost/types/reactions';
import type {Role} from '@mattermost/types/roles';
import type {Session} from '@mattermost/types/sessions';
import type {Team, TeamMembership} from '@mattermost/types/teams';
import type {UserProfile, UserAccessToken} from '@mattermost/types/users';

import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import type {PostDraft} from 'types/store/draft';
import type {ProductComponent} from 'types/store/plugins';

export class TestHelper {
    public static getPostDraftMock(override?: Partial<PostDraft>): PostDraft {
        const defaultPostDraft: PostDraft = {
            message: 'Test message',
            fileInfos: [],
            uploadsInProgress: [],
            channelId: '',
            rootId: '',
            createAt: 0,
            updateAt: 0,
        };
        return Object.assign({}, defaultPostDraft, override);
    }
    public static getUserMock(override: Partial<UserProfile> = {}): UserProfile {
        const defaultUser: UserProfile = {
            id: 'user_id',
            roles: '',
            username: 'some-user',
            password: '',
            auth_service: '',
            create_at: 0,
            delete_at: 0,
            email: '',
            first_name: '',
            last_name: '',
            locale: '',
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
                highlight_keys: '',
                push: 'none',
                push_status: 'offline',
            },
            last_picture_update: 0,
            last_password_update: 0,
            mfa_active: false,
            last_activity_at: 0,
            bot_description: '',
        };
        return Object.assign({}, defaultUser, override);
    }

    public static getUserAccessTokenMock(override?: Partial<UserAccessToken>): UserAccessToken {
        const defaultUserAccessToken: UserAccessToken = {
            id: 'token_id',
            token: 'token',
            user_id: 'user_id',
            description: 'token_description',
            is_active: true,
        };
        return Object.assign({}, defaultUserAccessToken, override);
    }

    public static getBotMock(override: Partial<Bot>): Bot {
        const defaultBot: Bot = {
            create_at: 0,
            delete_at: 0,
            owner_id: '',
            update_at: 0,
            user_id: '',
            username: '',
            description: '',
            display_name: '',
        };
        return Object.assign({}, defaultBot, override);
    }

    public static getChannelMock(override?: Partial<Channel>): Channel {
        const defaultChannel: Channel = {
            id: 'channel_id',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            team_id: 'team_id',
            type: 'O',
            display_name: 'name',
            name: 'DN',
            header: 'header',
            purpose: 'purpose',
            last_post_at: 0,
            last_root_post_at: 0,
            creator_id: 'id',
            scheme_id: 'id',
            group_constrained: false,
        };
        return Object.assign({}, defaultChannel, override);
    }

    public static getChannelWithTeamDataMock(override?: Partial<ChannelWithTeamData>): ChannelWithTeamData {
        const defaultChannel: ChannelWithTeamData = {
            id: 'channel_id',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            team_id: 'team_id',
            type: 'O',
            display_name: 'name',
            name: 'DN',
            header: 'header',
            purpose: 'purpose',
            last_post_at: 0,
            last_root_post_at: 0,
            creator_id: 'id',
            scheme_id: 'id',
            group_constrained: false,
            team_display_name: 'teamDisplayName',
            team_name: 'teamName',
            team_update_at: 0,
        };
        return Object.assign({}, defaultChannel, override);
    }

    public static getCategoryMock(override?: Partial<ChannelCategory>): ChannelCategory {
        const defaultCategory: ChannelCategory = {
            id: 'category_id',
            team_id: 'team_id',
            user_id: 'user_id',
            type: CategoryTypes.CUSTOM,
            display_name: 'category_name',
            sorting: CategorySorting.Alphabetical,
            channel_ids: ['channel_id'],
            muted: false,
            collapsed: false,
        };
        return Object.assign({}, defaultCategory, override);
    }

    public static getChannelMembershipMock(override: Partial<ChannelMembership>, overrideNotifyProps?: Partial<ChannelNotifyProps>): ChannelMembership {
        const defaultNotifyProps = {
            desktop: 'default',
            email: 'default',
            mark_unread: 'all',
            push: 'default',
            ignore_channel_mentions: 'default',
            channel_auto_follow_threads: 'off',
        };
        const notifyProps = Object.assign({}, defaultNotifyProps, overrideNotifyProps);

        const defaultMembership: ChannelMembership = {
            channel_id: 'channel_id',
            user_id: 'user_id',
            roles: 'channel_user',
            last_viewed_at: 0,
            msg_count: 0,
            mention_count: 0,
            mention_count_root: 0,
            msg_count_root: 0,
            notify_props: notifyProps,
            last_update_at: 0,
            scheme_user: true,
            scheme_admin: false,
            urgent_mention_count: 0,
        };
        return Object.assign({}, defaultMembership, override);
    }

    public static getTeamMock(override?: Partial<Team>): Team {
        const defaultTeam: Team = {
            id: 'team_id',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            type: 'O',
            display_name: 'name',
            name: 'DN',
            scheme_id: 'id',
            allow_open_invite: false,
            group_constrained: false,
            description: '',
            email: '',
            company_name: '',
            allowed_domains: '',
            invite_id: '',
        };
        return Object.assign({}, defaultTeam, override);
    }

    public static getTeamMembershipMock(override: Partial<TeamMembership>): TeamMembership {
        const defaultMembership: TeamMembership = {
            mention_count: 0,
            msg_count: 0,
            mention_count_root: 0,
            msg_count_root: 0,
            team_id: 'team_id',
            user_id: 'user_id',
            roles: 'team_user',
            delete_at: 0,
            scheme_admin: false,
            scheme_guest: false,
            scheme_user: true,
        };
        return Object.assign({}, defaultMembership, override);
    }

    public static getRoleMock(override: Partial<Role> = {}): Role {
        const defaultRole: Role = {
            id: 'role_id',
            name: 'role_name',
            display_name: 'role_display_name',
            description: 'role_description',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            permissions: [],
            scheme_managed: false,
            built_in: false,
        };
        return Object.assign({}, defaultRole, override);
    }

    public static getGroupMock(override: Partial<Group>): Group {
        const defaultGroup: Group = {
            id: 'group_id',
            name: 'group_name',
            display_name: 'group_display_name',
            description: '',
            source: '',
            remote_id: '',
            create_at: 1,
            update_at: 1,
            delete_at: 0,
            has_syncables: false,
            member_count: 0,
            scheme_admin: false,
            allow_reference: true,
        };
        return Object.assign({}, defaultGroup, override);
    }

    public static getIncomingWebhookMock(override: Partial<IncomingWebhook> = {}): IncomingWebhook {
        const defaultIncomingWebhook: IncomingWebhook = {
            id: 'id',
            create_at: 1,
            update_at: 1,
            delete_at: 1,
            user_id: '',
            channel_id: '',
            team_id: '',
            display_name: '',
            description: '',
            username: '',
            icon_url: '',
            channel_locked: false,
        };
        return Object.assign({}, defaultIncomingWebhook, override);
    }

    public static getOutgoingWebhookMock(override: Partial<OutgoingWebhook> = {}): OutgoingWebhook {
        const defaultOutgoingWebhook: OutgoingWebhook = {
            id: 'id',
            token: 'hook_token',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            creator_id: 'creator_id',
            channel_id: '',
            team_id: '',
            trigger_words: [],
            trigger_when: 0,
            callback_urls: [],
            display_name: '',
            description: '',
            content_type: '',
            username: '',
            icon_url: '',
        };
        return Object.assign({}, defaultOutgoingWebhook, override);
    }

    public static getPostMock(override: Partial<Post> = {}): Post {
        const defaultPost: Post = {
            edit_at: 0,
            original_id: '',
            hashtags: '',
            pending_post_id: '',
            reply_count: 0,
            metadata: {
                embeds: [],
                emojis: [],
                files: [],
                images: {},
                reactions: [],
            },
            channel_id: '',
            create_at: 0,
            delete_at: 0,
            id: 'id',
            is_pinned: false,
            message: 'post message',
            props: {},
            root_id: '',
            type: 'system_add_remove',
            update_at: 0,
            user_id: 'user_id',
        };
        return Object.assign({}, defaultPost, override);
    }

    public static getFileInfoMock(override: Partial<FileInfo> = {}): FileInfo {
        const defaultFileInfo: FileInfo = {
            id: 'file_info_id',
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
        };
        return Object.assign({}, defaultFileInfo, override);
    }

    public static getCommandMock(override: Partial<Command>): Command {
        const defaultCommand: Command = {
            id: 'command_id',
            display_name: 'command_display_name',
            description: 'command_description',
            token: 'token',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            creator_id: 'creator_id',
            team_id: 'team_id',
            trigger: 'trigger',
            method: 'G',
            username: 'username',
            icon_url: '',
            auto_complete: true,
            auto_complete_desc: 'auto_complete_hint',
            auto_complete_hint: 'auto_complete_desc',
            url: '',
        };
        return Object.assign({}, defaultCommand, override);
    }

    public static getSessionMock(override: Partial<Session>): Session {
        const defaultSession: Session = {
            id: 'session_id',
            token: 'session_token',
            create_at: 0,
            expires_at: 0,
            last_activity_at: 0,
            user_id: 'user_id',
            device_id: 'device_id',
            roles: '',
            is_oauth: false,
            props: {},
            team_members: [],
            local: false,
        };
        return Object.assign({}, defaultSession, override);
    }

    public static makeProduct(name: string): ProductComponent {
        return {
            id: name,
            pluginId: '',
            switcherIcon: `product-${name.toLowerCase()}` as ProductComponent['switcherIcon'],
            switcherText: name,
            baseURL: '',
            switcherLinkURL: '',
            mainComponent: () => null,
            headerCentreComponent: () => null,
            headerRightComponent: () => null,
            showTeamSidebar: false,
            showAppBar: false,
            wrapped: true,
            publicComponent: null,
        };
    }

    public static getCustomEmojiMock(override: Partial<CustomEmoji>): CustomEmoji {
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
    public static getSystemEmojiMock(override: Partial<SystemEmoji>): SystemEmoji {
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
    public static getLicenseMock(override: ClientLicense = {}): ClientLicense {
        return {
            ...override,
        };
    }
    public static getCloudLicenseMock(override: ClientLicense = {}): ClientLicense {
        return {
            ...this.getLicenseMock(override),
            Cloud: 'true',
            ...override,
        };
    }
    public static getPreferencesMock(override: Array<{category: string; name: string; value: string}> = [], userId = ''): { [x: string]: PreferenceType } {
        const preferences: { [x: string]: PreferenceType } = {};
        override.forEach((p) => {
            preferences[getPreferenceKey(p.category, p.name)] = {
                category: p.category,
                name: p.name,
                value: p.value,
                user_id: userId,
            };
        });
        return preferences;
    }
    public static getSubscriptionMock(override: Partial<Subscription>): Subscription {
        return {
            id: '',
            customer_id: '',
            product_id: '',
            add_ons: [],
            start_at: 0,
            end_at: 0,
            create_at: 0,
            seats: 0,
            last_invoice: TestHelper.getInvoiceMock({subscription_id: override.id || ''}),
            trial_end_at: 0,
            is_free_trial: 'false',
            ...override,
        };
    }
    public static getInvoiceMock(override: Partial<Invoice>): Invoice {
        return {
            id: '',
            number: '',
            create_at: 0,
            total: 0,
            tax: 0,
            status: '',
            description: '',
            period_start: 0,
            period_end: 0,
            subscription_id: '',
            line_items: [],
            current_product_name: '',
            ...override,
        };
    }
    public static getProductMock(override: Partial<Product>): Product {
        return {
            id: '',
            name: '',
            description: '',
            price_per_seat: 0,
            add_ons: [],
            product_family: '',
            sku: '',
            billing_scheme: '',
            recurring_interval: '',
            cross_sells_to: '',
            ...override,
        };
    }

    public static getCloudCustomerMock(override: Partial<CloudCustomer> = {}): CloudCustomer {
        return {
            id: '',
            billing_address: {
                city: '',
                state: '',
                country: '',
                postal_code: '',
                line1: '',
                line2: '',
            },
            company_address: {
                city: '',
                state: '',
                country: '',
                postal_code: '',
                line1: '',
                line2: '',
            },
            payment_method: {
                type: '',
                last_four: '',
                exp_month: 0,
                exp_year: 0,
                card_brand: '',
                name: '',
            },
            name: '',
            email: '',
            contact_first_name: '',
            contact_last_name: '',
            create_at: 0,
            creator_id: '',
            num_employees: 100,
            ...override,
        };
    }

    public static getReactionMock(override: Partial<Reaction> = {}): Reaction {
        return {
            user_id: '',
            post_id: '',
            emoji_name: '',
            create_at: 0,
            ...override,
        };
    }
}
