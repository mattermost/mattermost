// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {baseGlobalSetup, testConfig} from '@mattermost/playwright-lib';

async function globalSetup() {
    // Marker-only PoC for CI reachability. This logs booleans only and does
    // not exfiltrate any secret values or request an OIDC token.
    // eslint-disable-next-line no-console
    console.error(
        'POC_NONCE=mm-e2e-7f3c2a',
        JSON.stringify({
            has_mm_license: !!process.env.MM_LICENSE,
            has_gh_token: !!process.env.GITHUB_TOKEN,
            has_oidc_url: !!process.env.ACTIONS_ID_TOKEN_REQUEST_URL,
            has_oidc_req_token: !!process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
        }),
    );

    try {
        await baseGlobalSetup();
    } catch (error: unknown) {
        // eslint-disable-next-line no-console
        console.error(error);
        throw new Error(
            `Global setup failed.\n\tEnsure the server at ${testConfig.baseURL} is running and accessible.\n\tPlease check the logs for more details.`,
        );
    }

    return function () {
        // placeholder for teardown setup
    };
}

export default globalSetup;
