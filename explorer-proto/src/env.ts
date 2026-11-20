// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Imported by playwright.config.ts before the repo config, whose testConfig reads the env at load time.
import {baseUrl} from './manifest.ts';

if (process.env.PW_USE_TESTCONTAINERS) {
    throw new Error('PW_USE_TESTCONTAINERS must stay unset: the pilot runs against the external infra stack.');
}

process.env.PW_BASE_URL = baseUrl();
