// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type DeliveryTrackingConfig = {
    Enable: boolean;
    EnableForAllChannels: boolean;

    // ChannelIds fully replaces the stored list on save. Only meaningful when
    // EnableForAllChannels is false.
    ChannelIds: string[];
};
