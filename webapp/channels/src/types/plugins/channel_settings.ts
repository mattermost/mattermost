// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';

import type {Channel} from '@mattermost/types/channels';

import type {GlobalState} from 'types/store';

export type ChannelSettingsTabProps = {

    /** The current channel being configured in the modal. */
    channel: Channel;

    /** Notifies the modal when this tab has unsaved changes. */
    setAreThereUnsavedChanges?: (unsaved: boolean) => void;

    /** Indicates a tab switch was blocked until unsaved changes are resolved. */
    showTabSwitchError?: boolean;
};

/** Returns whether the tab should be visible for the current state and channel. */
export type ChannelSettingsTabShouldRender = (state: GlobalState, channel: Channel) => boolean;

export type ChannelSettingsTab = {

    /** The plain string label shown for the tab in the UI. */
    uiName: string;

    /** The plugin component rendered in the channel settings content pane. */
    component: React.ComponentType<ChannelSettingsTabProps>;

    /** An optional icon string, such as a CSS class name or URL/path. */
    icon?: string;

    /** An optional synchronous visibility predicate for the tab. */
    shouldRender?: ChannelSettingsTabShouldRender;
};
