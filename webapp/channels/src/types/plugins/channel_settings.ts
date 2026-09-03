// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';

import type {Channel} from '@mattermost/types/channels';

import type {SettingsSchema} from 'plugins/settings_schema/types';

import type {GlobalState} from 'types/store';

/** Returns whether the tab should be visible for the current state and channel. */
export type ChannelSettingsTabShouldRender = (state: GlobalState, channel: Channel) => boolean;

/** Collected setting values keyed by setting name, passed to the schema `onSave`. */
export type ChannelSettingsValues = {[name: string]: string};

/**
 * A declarative channel settings schema. The host renders the controls, tracks
 * changes, and owns the save bar; on save it collects the current values and
 * calls `onSave`. The plugin owns persistence (its own KV / API). Reject in
 * `onSave` to keep the tab dirty and surface a plugin-owned error.
 */
export type ChannelSettingsSchema = SettingsSchema & {
    onSave: (values: ChannelSettingsValues, channel: Channel) => Promise<void>;

    /**
     * Optional hook to seed the initial (and reset) values for the tab from the
     * plugin's own store. Returned values override schema `default`s; may be
     * async. Omit to start from the schema defaults.
     */
    loadValues?: (channel: Channel) => ChannelSettingsValues | Promise<ChannelSettingsValues>;
};

/**
 * Handlers a custom tab provides to the host-owned save bar. The host calls
 * `save` when the user clicks Save (reject to stay dirty) and `reset` on Reset.
 */
export type ChannelSettingsTabHandlers = {
    save: () => Promise<void>;
    reset: () => void;
};

/**
 * Props passed to the body of a custom channel settings tab. The plugin drives
 * the host save bar by registering handlers and reporting unsaved changes.
 */
export type ChannelSettingsTabBodyProps = {

    /** The current channel being configured. */
    channel: Channel;

    /** Reports whether the tab currently has unsaved changes. */
    setUnsaved: (unsaved: boolean) => void;

    /** Registers (or clears, with `null`) handlers for the host save bar. */
    registerHandlers: (handlers: ChannelSettingsTabHandlers | null) => void;
};

type ChannelSettingsTabBase = {

    /** The plain string label shown for the tab in the UI. */
    uiName: string;

    /** An optional icon string, such as a CSS class name or URL/path. */
    icon?: string;

    /** An optional synchronous visibility predicate for the tab. */
    shouldRender?: ChannelSettingsTabShouldRender;
};

/** A declarative tab: the host renders the schema and owns the save bar. */
export type ChannelSettingsSchemaTab = ChannelSettingsTabBase & ChannelSettingsSchema & {
    component?: never;
};

/** A custom tab: the plugin renders the whole tab body (escape hatch). */
export type ChannelSettingsCustomTab = ChannelSettingsTabBase & {
    component: React.ComponentType<ChannelSettingsTabBodyProps>;
    sections?: never;
    onSave?: never;
    loadValues?: never;
};

/** The single registration accepted by `registerChannelSettingsTab`. */
export type ChannelSettingsTab = ChannelSettingsSchemaTab | ChannelSettingsCustomTab;
