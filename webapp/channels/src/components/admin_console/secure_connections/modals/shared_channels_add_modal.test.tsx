// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * The ChannelIcon sub-component (line ~272) is not exported from this module.
 * SharedChannelsAddModal renders ChannelIcon only inside a ChannelsInput option label
 * (the formatLabel callback), which fires only after a user types a query and selects
 * a result from the async dropdown — not on initial render.
 *
 * Mounting the modal to trigger the icon render would require:
 *   - Mocking useSharedChannelRemotes (fetches remote cluster data)
 *   - Mocking searchAllChannels dispatch and simulating user typing
 *   - Stubbing GenericModal portal rendering
 *   - Providing React Select with enough DOM to open its dropdown
 *
 * The override path (useChannelIconOverrideName + compassIconForName) is covered at the
 * selector level (selectors/channel_icon_override.test.ts) and via integration in
 * searchable_channel_list.test.tsx, which uses the identical rendering pattern.
 *
 * If ChannelIcon is extracted to its own module in the future, add override + fallback
 * tests here following the searchable_channel_list.test.tsx pattern.
 */

describe('ChannelIcon (shared_channels_add_modal)', () => {
    it.todo(
        'renders override SVG icon when plugin matcher matches — blocked: ChannelIcon is unexported; ' +
        'icon only renders inside async React Select option labels, requiring full modal + dropdown interaction',
    );

    it.todo(
        'renders default SVG icon when no plugin matcher matches — blocked: same as above',
    );
});
