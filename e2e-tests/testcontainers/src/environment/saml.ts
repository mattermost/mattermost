// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {httpPost, httpGet, httpPut} from './http';
import {MmctlClient} from './mmctl';
import {formatConfigValue} from './server_config';
import {EnvironmentState} from './types';

/**
 * Upload SAML IDP certificate and configure SAML settings for Keycloak.
 * This fully configures SAML authentication with Keycloak.
 */
export async function uploadSamlIdpCertificate(env: EnvironmentState): Promise<{success: boolean; error?: string}> {
    // Check for Mattermost container (single node, HA leader, subpath server1, or subpath+HA server1 leader)
    const hasMattermost =
        env.mattermostContainer ||
        env.mattermostNodes.get('leader') ||
        env.mattermostServer1 ||
        env.server1Nodes.get('leader');
    if (!hasMattermost || !env.connectionInfo.mattermost || !env.connectionInfo.keycloak) {
        return {success: false, error: 'Mattermost or Keycloak container not running'};
    }

    try {
        env.log('Configuring SAML with Keycloak...');

        // In subpath mode, configure SAML on server1 only (server2 is bare)
        if (env.connectionInfo.subpath) {
            const result1 = await configureSamlForServer(
                env,
                'server1',
                env.connectionInfo.subpath.server1DirectUrl,
                env.connectionInfo.subpath.server1Url,
            );
            if (!result1.success) {
                return result1;
            }

            // Update Keycloak SAML client with server1 URL only
            await updateKeycloakSamlClientForSubpath(env);

            return {success: true};
        } else {
            // Single server or HA mode
            const serverUrl = env.connectionInfo.mattermost.url;
            const directUrl = serverUrl;
            const result = await configureSamlForServer(env, 'mattermost', directUrl, serverUrl);
            if (!result.success) {
                return result;
            }

            // Update Keycloak SAML client
            await updateKeycloakSamlClient(env, serverUrl);

            return {success: true};
        }
    } catch (err) {
        return {success: false, error: String(err)};
    }
}

/**
 * Configure SAML for a single Mattermost server.
 */
export async function configureSamlForServer(
    env: EnvironmentState,
    serverName: string,
    directUrl: string,
    siteUrl: string,
): Promise<{success: boolean; error?: string}> {
    const certificate = `-----BEGIN CERTIFICATE-----
MIICozCCAYsCBgGNzWfMwjANBgkqhkiG9w0BAQsFADAVMRMwEQYDVQQDDAptYXR0ZXJtb3N0MB4XDTI0MDIyMTIwNDA0OFoXDTM0MDIyMTIwNDIyOFowFTETMBEGA1UEAwwKbWF0dGVybW9zdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAOnsgNexkO5tbKkFXN+SdMUuLHbqdjZ9/JSnKrYPHLarf8801YDDzV8wI9jjdCCgq+xtKFKWlwU2rGpjPbefDLV1m7CSu0Iq+hNxDiBdX3wkEIK98piDpx+xYGL0aAbXn3nAlqFOWQJLKLM1I65ZmK31YZeVj4Kn01W4WfsvKHoxPjLPwPTug4HB6vaQXqEpzYYYHyuJKvIYNuVwo0WQdaPRXb0poZoYzOnoB6tOFrim6B7/chqtZeXQc7h6/FejBsV59aO5uATI0aAJw1twzjCNIiOeJLB2jlLuIMR3/Yaqr8IRpRXzcRPETpisWNilhV07ZBW0YL9ZwuU4sHWy+iMCAwEAATANBgkqhkiG9w0BAQsFAAOCAQEAW4I1egm+czdnnZxTtth3cjCmLg/UsalUDKSfFOLAlnbe6TtVhP4DpAl+OaQO4+kdEKemLENPmh4ddaHUjSSbbCQZo8B7IjByEe7x3kQdj2ucQpA4bh0vGZ11pVhk5HfkGqAO+UVNQsyLpTmWXQ8SEbxcw6mlTM4SjuybqaGOva1LBscI158Uq5FOVT6TJaxCt3dQkBH0tK+vhRtIM13pNZ/+SFgecn16AuVdBfjjqXynefrSihQ20BZ3NTyjs/N5J2qvSwQ95JARZrlhfiS++L81u2N/0WWni9cXmHsdTLxRrDZjz2CXBNeFOBRio74klSx8tMK27/2lxMsEC7R+DA==
-----END CERTIFICATE-----`;

    // Get mmctl client for this server
    const mmctl = getMmctlForServer(env, serverName);
    if (!mmctl) {
        return {success: false, error: `Could not get mmctl client for ${serverName}`};
    }

    // Admin credentials
    const adminUsername = env.config.admin?.username || 'sysadmin';
    const adminPassword = env.config.admin?.password || 'Sys@dmin-sample1';
    const adminEmail = `${adminUsername}@sample.mattermost.com`;

    // Step 1: Create admin user
    const createResult = await mmctl.exec(
        `user create --email "${adminEmail}" --username "${adminUsername}" --password "${adminPassword}" --system-admin`,
    );
    if (createResult.exitCode !== 0 && !createResult.stdout.includes('already exists')) {
        env.log(`⚠ Failed to create admin user on ${serverName}: ${createResult.stdout || createResult.stderr}`);
        return {success: false, error: `Failed to create admin user on ${serverName}: ${createResult.stdout}`};
    }
    env.log(`✓ Admin user ready on ${serverName} (${adminUsername})`);

    // Step 2: Login to get a token
    // In subpath mode, the API is at /mattermost1/api/v4/... not /api/v4/...
    // Extract the subpath prefix from siteUrl to prepend to API paths.
    const parsedDirect = new URL(directUrl);
    const parsedSite = new URL(siteUrl);
    const apiHost = parsedDirect.hostname;
    const apiPort = parseInt(parsedDirect.port, 10) || 80;
    const subpathPrefix = parsedSite.pathname.replace(/\/$/, ''); // e.g. "/mattermost1" or ""

    const loginResult = await httpPost(
        apiHost,
        apiPort,
        `${subpathPrefix}/api/v4/users/login`,
        JSON.stringify({login_id: adminUsername, password: adminPassword}),
        {'Content-Type': 'application/json'},
    );

    if (!loginResult.success || !loginResult.token) {
        env.log(`⚠ Failed to login on ${serverName}: ${loginResult.error || 'No token received'}`);
        return {
            success: false,
            error: `Failed to login on ${serverName}: ${loginResult.error || 'No token received'}`,
        };
    }

    // Step 3: Upload the certificate
    const uploadResult = await httpPost(apiHost, apiPort, `${subpathPrefix}/api/v4/saml/certificate/idp`, certificate, {
        'Content-Type': 'application/x-pem-file',
        Authorization: `Bearer ${loginResult.token}`,
    });

    if (!uploadResult.success) {
        return {success: false, error: `Failed to upload certificate on ${serverName}: ${uploadResult.error}`};
    }
    env.log(`✓ SAML IDP certificate uploaded on ${serverName}`);

    // Step 4: Configure SAML settings via mmctl
    const keycloakExternalUrl = `http://${env.connectionInfo.keycloak!.host}:${env.connectionInfo.keycloak!.port}`;

    const samlSettings: Record<string, string | boolean> = {
        'SamlSettings.IdpURL': `${keycloakExternalUrl}/realms/mattermost/protocol/saml`,
        'SamlSettings.IdpDescriptorURL': `${keycloakExternalUrl}/realms/mattermost`,
        'SamlSettings.ServiceProviderIdentifier': 'mattermost',
        'SamlSettings.AssertionConsumerServiceURL': `${siteUrl}/login/sso/saml`,
        'SamlSettings.SignatureAlgorithm': 'RSAwithSHA256',
        'SamlSettings.CanonicalAlgorithm': 'Canonical1.0',
        'SamlSettings.IdAttribute': 'id',
        'SamlSettings.FirstNameAttribute': 'firstName',
        'SamlSettings.LastNameAttribute': 'lastName',
        'SamlSettings.EmailAttribute': 'email',
        'SamlSettings.UsernameAttribute': 'username',
        'SamlSettings.Verify': false,
        'SamlSettings.Encrypt': false,
        'SamlSettings.SignRequest': false,
        'SamlSettings.LoginButtonText': 'SAML',
        'SamlSettings.LoginButtonColor': '#34a28b',
        'SamlSettings.LoginButtonTextColor': '#ffffff',
    };

    for (const [key, value] of Object.entries(samlSettings)) {
        const formattedValue = formatConfigValue(value);
        await mmctl.exec(`config set ${key} ${formattedValue}`);
    }

    // Enable SAML
    const enableResult = await mmctl.exec('config set SamlSettings.Enable true');
    if (enableResult.exitCode !== 0) {
        env.log(`⚠ Failed to enable SAML on ${serverName}: ${enableResult.stdout || enableResult.stderr}`);
        return {success: false, error: `Failed to enable SAML on ${serverName}`};
    }
    env.log(`✓ SAML enabled on ${serverName}`);

    return {success: true};
}

/**
 * Get mmctl client for a specific server in subpath mode.
 */
export function getMmctlForServer(env: EnvironmentState, serverName: string): MmctlClient | null {
    if (serverName === 'mattermost') {
        // Subpath + HA: use server1 leader
        const server1Leader = env.server1Nodes.get('leader');
        if (env.config.server.subpath && server1Leader) return new MmctlClient(server1Leader);
        // Subpath single: use server1
        if (env.config.server.subpath && env.mattermostServer1) return new MmctlClient(env.mattermostServer1);
        // HA: use leader
        const leaderContainer = env.mattermostNodes.get('leader');
        if (leaderContainer) return new MmctlClient(leaderContainer);
        // Single: use mattermost container
        if (env.mattermostContainer) return new MmctlClient(env.mattermostContainer);
        return null;
    }

    if (serverName === 'server1') {
        // Subpath + HA: use server1 leader
        const server1Leader = env.server1Nodes.get('leader');
        if (server1Leader) return new MmctlClient(server1Leader);
        if (env.mattermostServer1) return new MmctlClient(env.mattermostServer1);
        return null;
    }

    if (serverName === 'server2' && env.mattermostServer2) {
        return new MmctlClient(env.mattermostServer2);
    }

    return null;
}

/**
 * Update Keycloak SAML client for subpath mode with both server URLs.
 */
export async function updateKeycloakSamlClientForSubpath(env: EnvironmentState): Promise<void> {
    if (!env.connectionInfo.keycloak || !env.connectionInfo.subpath) {
        return;
    }

    const {host, port} = env.connectionInfo.keycloak;
    const {server1Url, server2Url, url: nginxUrl} = env.connectionInfo.subpath;

    try {
        // Get Keycloak admin token
        const tokenResult = await httpPost(
            host,
            port,
            '/realms/master/protocol/openid-connect/token',
            'grant_type=password&client_id=admin-cli&username=admin&password=admin',
            {'Content-Type': 'application/x-www-form-urlencoded'},
        );

        if (!tokenResult.success || !tokenResult.body) {
            env.log(`⚠ Failed to get Keycloak admin token: ${tokenResult.error}`);
            return;
        }

        const tokenData = JSON.parse(tokenResult.body);
        const accessToken = tokenData.access_token;

        // Get the SAML client ID
        const clientsResult = await httpGet(host, port, '/admin/realms/mattermost/clients?clientId=mattermost', {
            Authorization: `Bearer ${accessToken}`,
        });

        if (!clientsResult.success || !clientsResult.body) {
            env.log(`⚠ Failed to get Keycloak clients: ${clientsResult.error}`);
            return;
        }

        const clients = JSON.parse(clientsResult.body);
        if (!clients || clients.length === 0) {
            env.log('⚠ SAML client not found in Keycloak');
            return;
        }

        const clientId = clients[0].id;

        // Update the client with both server URLs
        const updatedClient = {
            ...clients[0],
            rootUrl: nginxUrl,
            baseUrl: nginxUrl,
            redirectUris: [
                `${server1Url}/login/sso/saml`,
                `${server1Url}/*`,
                `${server2Url}/login/sso/saml`,
                `${server2Url}/*`,
            ],
            webOrigins: [nginxUrl, server1Url, server2Url],
        };

        const updateResult = await httpPut(
            host,
            port,
            `/admin/realms/mattermost/clients/${clientId}`,
            JSON.stringify(updatedClient),
            {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        );

        if (!updateResult.success) {
            env.log(`⚠ Failed to update Keycloak SAML client: ${updateResult.error}`);
            return;
        }

        env.log(`✓ Keycloak SAML client updated for subpath mode`);
    } catch (err) {
        env.log(`⚠ Failed to update Keycloak SAML client: ${err}`);
    }
}

/**
 * Update Keycloak SAML client configuration with the correct Mattermost URL.
 */
export async function updateKeycloakSamlClient(env: EnvironmentState, mattermostUrl: string): Promise<void> {
    if (!env.connectionInfo.keycloak) {
        env.log('⚠ Keycloak not available, skipping client update');
        return;
    }

    const {host, port} = env.connectionInfo.keycloak;

    try {
        // Step 1: Get Keycloak admin token
        const tokenResult = await httpPost(
            host,
            port,
            '/realms/master/protocol/openid-connect/token',
            'grant_type=password&client_id=admin-cli&username=admin&password=admin',
            {'Content-Type': 'application/x-www-form-urlencoded'},
        );

        if (!tokenResult.success || !tokenResult.body) {
            env.log(`⚠ Failed to get Keycloak admin token: ${tokenResult.error}`);
            return;
        }

        const tokenData = JSON.parse(tokenResult.body);
        const accessToken = tokenData.access_token;

        // Step 2: Get the SAML client ID
        const clientsResult = await httpGet(host, port, '/admin/realms/mattermost/clients?clientId=mattermost', {
            Authorization: `Bearer ${accessToken}`,
        });

        if (!clientsResult.success || !clientsResult.body) {
            env.log(`⚠ Failed to get Keycloak clients: ${clientsResult.error}`);
            return;
        }

        const clients = JSON.parse(clientsResult.body);
        if (!clients || clients.length === 0) {
            env.log('⚠ SAML client not found in Keycloak');
            return;
        }

        const clientId = clients[0].id;

        // Step 3: Update the client with correct Mattermost URL
        const updatedClient = {
            ...clients[0],
            rootUrl: mattermostUrl,
            baseUrl: mattermostUrl,
            redirectUris: [`${mattermostUrl}/login/sso/saml`, `${mattermostUrl}/*`],
            webOrigins: [mattermostUrl],
        };

        const updateResult = await httpPut(
            host,
            port,
            `/admin/realms/mattermost/clients/${clientId}`,
            JSON.stringify(updatedClient),
            {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        );

        if (!updateResult.success) {
            env.log(`⚠ Failed to update Keycloak SAML client: ${updateResult.error}`);
            return;
        }

        env.log(`✓ Keycloak SAML client updated with Mattermost URL: ${mattermostUrl}`);
    } catch (err) {
        env.log(`⚠ Failed to update Keycloak SAML client: ${err}`);
    }
}
