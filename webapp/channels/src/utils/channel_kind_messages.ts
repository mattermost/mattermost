// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessage} from 'react-intl';

import type {KindMessages} from 'utils/channel_kind';

/** Channel/board message pairs that more than one component shows, defined once. */
/* eslint-disable formatjs/enforce-placeholders -- values are passed where each message is rendered */
export const channelKindMessages = {
    nameLabel: {
        channel: defineMessage({
            id: 'channel_modal.name.label',
            defaultMessage: 'Channel name',
        }),
        board: defineMessage({
            id: 'channel_modal.name.label.board',
            defaultMessage: 'Board name',
        }),
    },
    closeChannel: {
        channel: defineMessage({
            id: 'center_panel.archived.closeChannel',
            defaultMessage: 'Close Channel',
        }),
        board: defineMessage({
            id: 'center_panel.archived.closeChannel.board',
            defaultMessage: 'Close Board',
        }),
    },
    channelSettings: {
        channel: defineMessage({
            id: 'channel_header.channel_settings',
            defaultMessage: 'Channel Settings',
        }),
        board: defineMessage({
            id: 'channel_header.channel_settings.board',
            defaultMessage: 'Board Settings',
        }),
    },
    bannerTextPlaceholder: {
        channel: defineMessage({
            id: 'channel_banner.banner_text.placeholder',
            defaultMessage: 'Channel banner text',
        }),
        board: defineMessage({
            id: 'channel_banner.banner_text.placeholder.board',
            defaultMessage: 'Board banner text',
        }),
    },
    archivedChannelsWarning: {
        channel: defineMessage({
            id: 'deleteChannelModal.canViewArchivedChannelsWarning',
            defaultMessage: 'This will archive the channel from the team. Channel contents will still be accessible by channel members.',
        }),
        board: defineMessage({
            id: 'deleteChannelModal.canViewArchivedChannelsWarning.board',
            defaultMessage: 'This will archive the board from the team. Board contents will still be accessible by board members.',
        }),
    },
    confirmArchive: {
        channel: defineMessage({
            id: 'deleteChannelModal.confirmArchive',
            defaultMessage: 'Are you sure you wish to archive the <strong>{display_name}</strong> channel?',
        }),
        board: defineMessage({
            id: 'deleteChannelModal.confirmArchive.board',
            defaultMessage: 'Are you sure you wish to archive the <strong>{display_name}</strong> board?',
        }),
    },
    headerLengthError: {
        channel: defineMessage({
            id: 'edit_channel_header_modal.error',
            defaultMessage: 'The text entered exceeds the character limit. The channel header is limited to {maxLength} characters.',
        }),
        board: defineMessage({
            id: 'edit_channel_header_modal.error.board',
            defaultMessage: 'The text entered exceeds the character limit. The board header is limited to {maxLength} characters.',
        }),
    },
    addChannelsCta: {
        channel: defineMessage({
            id: 'sidebar_left.addChannelsCta',
            defaultMessage: 'Add Channels',
        }),
        board: defineMessage({
            id: 'sidebar_left.addChannelsCta.board',
            defaultMessage: 'Add Boards',
        }),
    },
    sidebarCategoryName: {
        channel: defineMessage({
            id: 'sidebar.types.channels',
            defaultMessage: 'CHANNELS',
        }),
        board: defineMessage({
            id: 'sidebar.types.channels.board',
            defaultMessage: 'BOARDS',
        }),
    },
    findChannel: {
        channel: defineMessage({
            id: 'sidebar_left.channel_navigator.jumpTo',
            defaultMessage: 'Find channel',
        }),
        board: defineMessage({
            id: 'sidebar_left.channel_navigator.jumpTo.board',
            defaultMessage: 'Find board',
        }),
    },
    channelSwitcherLabel: {
        channel: defineMessage({
            id: 'sidebar_left.channel_navigator.channelSwitcherLabel',
            defaultMessage: 'Find Channels',
        }),
        board: defineMessage({
            id: 'sidebar_left.channel_navigator.channelSwitcherLabel.board',
            defaultMessage: 'Find Boards',
        }),
    },
} satisfies Record<string, KindMessages>;
/* eslint-enable formatjs/enforce-placeholders */
