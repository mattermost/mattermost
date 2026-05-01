// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nodeFetch from 'node-fetch';

// Nock 13 can't mock Node's built-in fetch, so we have to replace the it with node-fetch to be able to mock it despite
// some mismatched parameters.
globalThis.fetch = nodeFetch as unknown as typeof fetch;
