// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PublishedIsolatedFrameUtils} from '@mattermost/shared/types/global';

import {registerIsolatedFrame} from 'utils/isolated_frame_firewall';

// Annotating the object with the contract type is the drift check: tsc fails if
// registerIsolatedFrame stops being assignable to the published signature.
export const publishedIsolatedFrameUtils: PublishedIsolatedFrameUtils = {
    register: registerIsolatedFrame,
};
