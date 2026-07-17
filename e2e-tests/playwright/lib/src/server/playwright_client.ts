// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import type {Channel, ChannelType} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {createRandomChannel} from './channel';
import {createNewUserProfile} from './user';

import {testConfig} from '@/test_config';
import {duration, wait} from '@/util';

type LdapAccount = {
    username: string;
    password: string;
};

/**
 * Client4 extended with Playwright test-setup helpers only.
 * These are not part of the Mattermost server API — do not add real API wrappers here.
 */
export class PlaywrightClient4 extends Client4 {
    private createChannelOfType(
        teamId: string,
        displayName: string,
        type: ChannelType,
        name?: string,
    ): Promise<Channel> {
        return this.createChannel(
            createRandomChannel({
                teamId,
                name: name ?? displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                displayName,
                type,
                unique: true,
            }),
        );
    }

    async createPublicChannel(teamId: string, displayName = 'Public', name?: string): Promise<Channel> {
        return this.createChannelOfType(teamId, displayName, 'O', name);
    }

    async createPrivateChannel(teamId: string, displayName = 'Private', name?: string): Promise<Channel> {
        return this.createChannelOfType(teamId, displayName, 'P', name);
    }

    async createUsers(teamId: string, count: number, prefix = 'user'): Promise<UserProfile[]> {
        const users: UserProfile[] = [];
        for (let i = 0; i < count; i++) {
            const user = await createNewUserProfile(this, {prefix});
            await this.addToTeam(teamId, user.id);
            users.push(user);
        }
        return users;
    }

    async migrateUserAuthToSaml(email: string, username: string) {
        return this.doFetch(`${this.getUsersRoute()}/migrate_auth/saml`, {
            method: 'post',
            body: JSON.stringify({
                from: 'email',
                auto: false,
                matches: {[email]: username},
            }),
        });
    }

    async getGroupSyncableIncludingDeleted(groupId: string, syncableId: string, syncableType: 'team' | 'channel') {
        return this.doFetch<{delete_at: number; scheme_admin: boolean}>(
            `${this.getGroupRoute(groupId)}/${syncableType}s/${syncableId}`,
            {method: 'get'},
        );
    }

    /**
     * Configures Mattermost for the OpenLDAP service supplied by the E2E Docker
     * environment. A narrow patch avoids resetting unrelated server settings.
     */
    async configureOpenLdap() {
        await this.patchConfig({
            LdapSettings: {
                Enable: true,
                EnableSync: true,
                LdapServer: testConfig.ldapServer,
                ...(testConfig.ldapPort === 389 ? {} : {LdapPort: testConfig.ldapPort}),
                BaseDN: 'dc=mm,dc=test,dc=com',
                BindUsername: 'cn=admin,dc=mm,dc=test,dc=com',
                BindPassword: testConfig.ldapBindPassword,
                GroupDisplayNameAttribute: 'cn',
                GroupIdAttribute: 'entryUUID',
                FirstNameAttribute: 'cn',
                LastNameAttribute: 'sn',
                EmailAttribute: 'mail',
                UsernameAttribute: 'uid',
                NicknameAttribute: 'cn',
                IdAttribute: 'uid',
                PositionAttribute: 'title',
                LoginIdAttribute: 'uid',
                SkipCertificateVerification: true,
            },
        });
    }

    /**
     * Resets mutable LDAP filters shared by E2E tests to their server defaults.
     */
    async resetOpenLdapTestState() {
        await this.patchConfig({
            LdapSettings: {
                UserFilter: '',
                GroupFilter: '',
                GuestFilter: '',
                EnableAdminFilter: false,
                AdminFilter: '',
            },
        });
    }

    /**
     * Starts an LDAP synchronization job and waits for its terminal status.
     */
    async runLdapSync() {
        const pendingJobs = (await this.getJobsByType('ldap_sync', 0, 100))
            .filter((candidate) => candidate.status === 'pending')
            .sort((a, b) => a.create_at - b.create_at);
        // A pending sync reads LDAP when it starts, so reuse it instead of joining the back of a busy queue.
        const job = pendingJobs[0] ?? (await this.createJob({type: 'ldap_sync'}));
        let phase: 'queued' | 'running' = 'queued';
        let phaseDeadline = Date.now() + duration.half_min;

        while (Date.now() < phaseDeadline) {
            const current = await this.getJob(job.id);
            if (current.status === 'success') {
                return current;
            }
            if (current.status === 'error' || current.status === 'canceled' || current.status === 'warning') {
                throw new Error(`LDAP synchronization ${current.id} finished with status ${current.status}`);
            }
            // Queueing and execution each get an independent, bounded window.
            if (current.status === 'in_progress' && phase === 'queued') {
                phase = 'running';
                phaseDeadline = Date.now() + duration.half_min;
            }
            await wait(duration.half_sec);
        }
        throw new Error(
            `LDAP synchronization ${job.id} did not finish its ${phase} phase within ${duration.half_min}ms`,
        );
    }

    /**
     * Configures, validates, and synchronizes the E2E OpenLDAP directory.
     */
    async initializeOpenLdap() {
        await this.configureOpenLdap();
        await this.resetOpenLdapTestState();
        await this.testLdap();
        await this.runLdapSync();
    }

    /**
     * Returns a linked Mattermost group for a named E2E LDAP group.
     */
    async getOrLinkLdapGroup(name: string) {
        const {groups} = await this.getLdapGroups();
        const ldapGroup = groups.find((group) => group.name === name);
        if (!ldapGroup) {
            throw new Error(`LDAP group ${name} was not found`);
        }

        return ldapGroup.mattermost_group_id
            ? this.getGroup(ldapGroup.mattermost_group_id)
            : this.linkLdapGroup(ldapGroup.primary_key);
    }

    /**
     * Returns an existing Mattermost LDAP user or creates it through LDAP login.
     */
    async getOrCreateLdapUser(account: LdapAccount): Promise<UserProfile> {
        return (await this.getOrCreateLdapUserWithStatus(account)).user;
    }

    /**
     * Returns whether LDAP login created the Mattermost user.
     */
    async getOrCreateLdapUserWithStatus(account: LdapAccount): Promise<{user: UserProfile; created: boolean}> {
        try {
            return {user: await this.getUserByUsername(account.username), created: false};
        } catch (error) {
            if (!this.isNotFoundError(error)) {
                throw error;
            }
        }

        const jitClient = new PlaywrightClient4();
        jitClient.setUrl(testConfig.baseURL);
        return {user: await jitClient.login(account.username, account.password), created: true};
    }

    /**
     * Restores mutable Mattermost state attached to a shared LDAP group.
     */
    async resetLdapGroup(groupId: string) {
        await this.patchGroup(groupId, {allow_reference: false});
        for (const link of (await this.getGroupSyncables(groupId, 'channel')) as unknown as Array<{
            channel_id: string;
        }>) {
            await this.unlinkGroupSyncable(groupId, link.channel_id, 'channel');
        }
        for (const link of (await this.getGroupSyncables(groupId, 'team')) as unknown as Array<{team_id: string}>) {
            await this.unlinkGroupSyncable(groupId, link.team_id, 'team');
        }
    }

    private isNotFoundError(error: unknown) {
        return typeof error === 'object' && error !== null && 'status_code' in error && error.status_code === 404;
    }
}
