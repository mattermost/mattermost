// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RemoteClusterInfo} from '@mattermost/types/shared_channels';

export type WorkspaceWithStatus = RemoteClusterInfo & {pendingSave?: boolean};
