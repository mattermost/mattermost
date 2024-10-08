// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This is based on "webapp/platform/client/src/client4.ts". Modified for node client.
// Update should be made in comparison with the base Client4.

import fs from 'node:fs';
import path from 'node:path';
import stream from 'stream';

import {FormData} from 'formdata-node';
import {FormDataEncoder} from 'form-data-encoder';

import testConfig from '@e2e-test.config';
import Client4 from '@mattermost/client/client4';
import {Options, StatusOK} from '@mattermost/types/client4';
import {License} from '@mattermost/types/config';
import {CustomEmoji} from '@mattermost/types/emojis';
import {PluginManifest} from '@mattermost/types/plugins';
import {UserProfile} from '@mattermost/types/users';

export default class Client extends Client4 {
    getFormDataOptions = (formData: FormData): Options => {
        const encoder = new FormDataEncoder(formData);

        return {
            method: 'post',
            body: stream.Readable.from(encoder.encode()),
            headers: encoder.headers,
            duplex: 'half',
        };
    };

    readFileAsFormData = (filePath: string, key: string, additionalFields: Record<string, any> = {}) => {
        const fileData = fs.readFileSync(filePath);
        const formData = new FormData();
        formData.append(key, new Blob([fileData]), path.basename(filePath));

        // Append additional fields if provided
        for (const [field, value] of Object.entries(additionalFields)) {
            formData.append(field, value);
        }

        return formData;
    };

    uploadProfileImageX = (userId: string, filePath: string) => {
        const formData = this.readFileAsFormData(filePath, 'image');
        const options = this.getFormDataOptions(formData);
        return this.doFetch<StatusOK>(`${this.getUserRoute(userId)}/image`, options);
    };

    setTeamIconX = (teamId: string, filePath: string) => {
        const formData = this.readFileAsFormData(filePath, 'image');
        const options = this.getFormDataOptions(formData);
        return this.doFetch<StatusOK>(`${this.getTeamRoute(teamId)}/image`, options);
    };

    createCustomEmojiX = (emoji: CustomEmoji, filePath: string) => {
        const formData = this.readFileAsFormData(filePath, 'image', {emoji: JSON.stringify(emoji)});
        const options = this.getFormDataOptions(formData);
        return this.doFetch<CustomEmoji>(`${this.getEmojisRoute()}`, options);
    };

    uploadBrandImageX = (filePath: string) => {
        const formData = this.readFileAsFormData(filePath, 'image');
        const options = this.getFormDataOptions(formData);
        return this.doFetch<StatusOK>(`${this.getBrandRoute()}/image`, options);
    };

    uploadCertificateX = (filePath: string, route: string) => {
        const formData = this.readFileAsFormData(filePath, 'certificate');
        const options = this.getFormDataOptions(formData);
        return this.doFetch<StatusOK>(route, options);
    };

    uploadPublicSamlCertificateX = (filePath: string) => {
        return this.uploadCertificateX(filePath, `${this.getBaseRoute()}/saml/certificate/public`);
    };

    uploadPrivateSamlCertificateX = (filePath: string) => {
        return this.uploadCertificateX(filePath, `${this.getBaseRoute()}/saml/certificate/private`);
    };

    uploadPublicLdapCertificateX = (filePath: string) => {
        return this.uploadCertificateX(filePath, `${this.getBaseRoute()}/ldap/certificate/public`);
    };

    uploadPrivateLdapCertificateX = (filePath: string) => {
        return this.uploadCertificateX(filePath, `${this.getBaseRoute()}/ldap/certificate/private`);
    };

    uploadIdpSamlCertificateX = (filePath: string) => {
        return this.uploadCertificateX(filePath, `${this.getBaseRoute()}/saml/certificate/idp`);
    };

    uploadLicenseX = (filePath: string) => {
        const formData = this.readFileAsFormData(filePath, 'license');
        const options = this.getFormDataOptions(formData);
        return this.doFetch<License>(`${this.getBaseRoute()}/license`, options);
    };

    uploadPluginX = async (filePath: string, force = false) => {
        const additionalFields = force ? {force: 'true'} : {};
        const formData = this.readFileAsFormData(filePath, 'plugin', additionalFields);
        const options = this.getFormDataOptions(formData);
        return this.doFetch<PluginManifest>(this.getPluginsRoute(), options);
    };
}

// Variable to hold cache
const clients: Record<string, ClientCache> = {};

async function makeClient(
    userRequest?: UserRequest,
    opts: {useCache?: boolean; skipLog?: boolean} = {useCache: true, skipLog: false},
): Promise<ClientCache> {
    const client = new Client();
    client.setUrl(testConfig.baseURL);

    try {
        if (!userRequest) {
            return {client, user: null};
        }

        const cacheKey = userRequest.username + userRequest.password;
        if (opts?.useCache && clients[cacheKey] != null) {
            return clients[cacheKey];
        }

        const userProfile = await client.login(userRequest.username, userRequest.password);
        const user = {...userProfile, password: userRequest.password};

        if (opts?.useCache) {
            clients[cacheKey] = {client, user};
        }

        return {client, user};
    } catch (err) {
        if (!opts?.skipLog) {
            // log an error for debugging
            // eslint-disable-next-line no-console
            console.log('makeClient', err);
        }
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

export {Client, makeClient};
