// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This is based on "webapp/platform/client/src/client4.ts". Modified for node client.
// Update should be made in comparison with the base Client4.

import fs from 'node:fs';
import path from 'node:path';

import FormData from 'form-data';
import 'isomorphic-unfetch';

import testConfig from '@e2e-test.config';
import Client4 from '@mattermost/client/client4';
import {Options, StatusOK} from '@mattermost/types/client4';
import {License} from '@mattermost/types/config';
import {CustomEmoji} from '@mattermost/types/emojis';
import {PluginManifest} from '@mattermost/types/plugins';
import {UserProfile} from '@mattermost/types/users';

export default class Client extends Client4 {
    getFormDataOptions = (formData: FormData): Options => {
        return {
            method: 'post',
            body: formData,
            headers: {
                'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
            },
        };
    };

    uploadProfileImageX = (userId: string, filePath: string) => {
        const fileData = fs.readFileSync(filePath);
        const formData = new FormData();
        formData.append('image', fileData, path.basename(filePath));
        const options = this.getFormDataOptions(formData);

        return this.doFetch<StatusOK>(`${this.getUserRoute(userId)}/image`, options);
    };

    setTeamIconX = (teamId: string, filePath: string) => {
        const fileData = fs.readFileSync(filePath);
        const formData = new FormData();
        formData.append('image', fileData, path.basename(filePath));
        const options = this.getFormDataOptions(formData);

        return this.doFetch<StatusOK>(`${this.getTeamRoute(teamId)}/image`, options);
    };

    createCustomEmojiX = (emoji: CustomEmoji, filePath: string) => {
        const fileData = fs.readFileSync(filePath);
        const formData = new FormData();
        formData.append('image', fileData, path.basename(filePath));
        formData.append('emoji', JSON.stringify(emoji));
        const options = this.getFormDataOptions(formData);

        return this.doFetch<CustomEmoji>(`${this.getEmojisRoute()}`, options);
    };

    uploadBrandImageX = (filePath: string) => {
        const fileData = fs.readFileSync(filePath);
        const formData = new FormData();
        formData.append('image', fileData, path.basename(filePath));
        const options = this.getFormDataOptions(formData);

        return this.doFetch<StatusOK>(`${this.getBrandRoute()}/image`, options);
    };

    uploadPublicSamlCertificateX = (filePath: string) => {
        const fileData = fs.readFileSync(filePath);
        const formData = new FormData();
        formData.append('certificate', fileData, path.basename(filePath));
        const options = this.getFormDataOptions(formData);

        return this.doFetch<StatusOK>(`${this.getBaseRoute()}/saml/certificate/public`, options);
    };

    uploadPrivateSamlCertificateX = (filePath: string) => {
        const fileData = fs.readFileSync(filePath);
        const formData = new FormData();
        formData.append('certificate', fileData, path.basename(filePath));
        const options = this.getFormDataOptions(formData);

        return this.doFetch<StatusOK>(`${this.getBaseRoute()}/saml/certificate/private`, options);
    };

    uploadPublicLdapCertificateX = (filePath: string) => {
        const fileData = fs.readFileSync(filePath);
        const formData = new FormData();
        formData.append('certificate', fileData, path.basename(filePath));
        const options = this.getFormDataOptions(formData);

        return this.doFetch<StatusOK>(`${this.getBaseRoute()}/ldap/certificate/public`, options);
    };

    uploadPrivateLdapCertificateX = (filePath: string) => {
        const fileData = fs.readFileSync(filePath);
        const formData = new FormData();
        formData.append('certificate', fileData, path.basename(filePath));
        const options = this.getFormDataOptions(formData);

        return this.doFetch<StatusOK>(`${this.getBaseRoute()}/ldap/certificate/private`, options);
    };

    uploadIdpSamlCertificateX = (filePath: string) => {
        const fileData = fs.readFileSync(filePath);
        const formData = new FormData();
        formData.append('certificate', fileData, path.basename(filePath));
        const options = this.getFormDataOptions(formData);

        return this.doFetch<StatusOK>(`${this.getBaseRoute()}/saml/certificate/idp`, options);
    };

    uploadLicenseX = (filePath: string) => {
        const fileData = fs.readFileSync(filePath);
        const formData = new FormData();
        formData.append('license', fileData, path.basename(filePath));
        const options = this.getFormDataOptions(formData);

        return this.doFetch<License>(`${this.getBaseRoute()}/license`, options);
    };

    uploadPluginX = async (filePath: string, force = false) => {
        const fileData = fs.readFileSync(filePath);
        const formData = new FormData();
        if (force) {
            formData.append('force', 'true');
        }
        formData.append('plugin', fileData, path.basename(filePath));
        const options = this.getFormDataOptions(formData);

        return this.doFetch<PluginManifest>(this.getPluginsRoute(), options);
    };

    // *****************************************************************************
    // Boards client
    // based on "webapp/boards/src/octoClient.ts"
    // *****************************************************************************

    async patchUserConfig(userID: string, patch: UserConfigPatch): Promise<UserPreference[] | undefined> {
        const path = `/users/${encodeURIComponent(userID)}/config`;
        const options = {
            method: 'put',
            body: JSON.stringify(patch),
        };

        return this.doFetch<UserPreference[]>(this.getBoardsRoute() + path, options);
    }
}

// Variable to hold cache
const clients: Record<string, ClientCache> = {};

async function makeClient(userRequest?: UserRequest, useCache = true): Promise<ClientCache> {
    const client = new Client();
    client.setUrl(testConfig.baseURL);

    try {
        if (!userRequest) {
            return {client, user: null};
        }

        const cacheKey = userRequest.username + userRequest.password;
        if (useCache && clients[cacheKey] != null) {
            return clients[cacheKey];
        }

        const userProfile = await client.login(userRequest.username, userRequest.password);
        const user = {...userProfile, password: userRequest.password};

        // Manually do until boards as product is consistent in all the codebase.
        client.setUseBoardsProduct(true);

        if (useCache) {
            clients[cacheKey] = {client, user};
        }

        return {client, user};
    } catch (err) {
        // log an error for debugging
        // eslint-disable-next-line no-console
        console.log('makeClient', err);
        return {client, user: null};
    }
}

// Client types

type UserRequest = {
    username: string;
    email?: string;
    password: string;
};

type ClientCache = {
    client: Client;
    user: UserProfile | null;
};

// Boards types

interface UserPreference {
    user_id: string;
    category: string;
    name: string;
    value: any;
}

interface UserConfigPatch {
    updatedFields?: Record<string, string>;
    deletedFields?: string[];
}

export {Client, makeClient};
