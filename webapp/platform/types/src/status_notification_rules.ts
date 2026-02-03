// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type StatusNotificationRule = {
    id: string;
    name: string;
    enabled: boolean;
    watched_user_id: string;
    recipient_user_id: string;
    event_filters: string; // Comma-separated: "status_online,activity_message"
    create_at: number;
    update_at: number;
    delete_at: number;
    created_by: string;
};

// Event filter constants
export const StatusNotificationFilterStatusOnline = 'status_online';
export const StatusNotificationFilterStatusAway = 'status_away';
export const StatusNotificationFilterStatusDND = 'status_dnd';
export const StatusNotificationFilterStatusOffline = 'status_offline';
export const StatusNotificationFilterStatusAny = 'status_any';
export const StatusNotificationFilterActivityMessage = 'activity_message';
export const StatusNotificationFilterActivityChannelView = 'activity_channel_view';
export const StatusNotificationFilterActivityWindowFocus = 'activity_window_focus';
export const StatusNotificationFilterActivityAny = 'activity_any';
export const StatusNotificationFilterAll = 'all';

export const StatusNotificationFilters = [
    StatusNotificationFilterStatusOnline,
    StatusNotificationFilterStatusAway,
    StatusNotificationFilterStatusDND,
    StatusNotificationFilterStatusOffline,
    StatusNotificationFilterStatusAny,
    StatusNotificationFilterActivityMessage,
    StatusNotificationFilterActivityChannelView,
    StatusNotificationFilterActivityWindowFocus,
    StatusNotificationFilterActivityAny,
    StatusNotificationFilterAll,
] as const;

export type StatusNotificationFilter = typeof StatusNotificationFilters[number];
