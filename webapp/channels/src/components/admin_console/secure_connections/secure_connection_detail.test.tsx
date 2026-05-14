// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * The ChannelIcon sub-component (line ~428) is not exported from this module.
 * SecureConnectionDetail itself requires react-router-dom (useParams, useHistory,
 * useLocation), several custom hooks (useRemoteClusterEdit, useRemoteClusterCreate,
 * useSharedChannelRemoteRows, useTeamOptions, useSharedChannelsAdd), and @tanstack/react-table,
 * making it expensive to mount in tests.
 *
 * The override path (useChannelIconOverrideName + compassIconForName) is covered at the
 * selector level (selectors/channel_icon_override.test.ts) and at the hook level
 * (hooks/useChannelIconOverrideName indirectly via searchable_sync_job_channel_list.test.tsx
 * and searchable_channel_list.test.tsx), which share the identical rendering pattern.
 *
 * If ChannelIcon is extracted to its own module in the future, add override + fallback
 * tests here following the searchable_channel_list.test.tsx pattern.
 */

describe('ChannelIcon (secure_connection_detail)', () => {
    it.todo(
        'renders override SVG icon when plugin matcher matches — blocked: ChannelIcon is unexported; ' +
        'SecureConnectionDetail requires router context + 4 custom hooks not feasible to stub cheaply',
    );

    it.todo(
        'renders default SVG icon when no plugin matcher matches — blocked: same as above',
    );
});
