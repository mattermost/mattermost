// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';
import fetch from 'node-fetch';

globalThis.fetch = fetch;

// Prevent any connections from being made to the internet outside of Nock
nock.disableNetConnect();
