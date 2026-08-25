// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// The surface Global Attributes' own "Applies to" card needs to render and save
// this row. Everything else stays module-private -- a smaller surface is easier
// to keep stable across the hand-off.
export {default} from './channels_resource_row';
export {buildChannelFieldAttrs, buildChannelFieldPatch, buildChannelFieldPayload, parseChannelFieldConfig} from './channel_field_payload';
export {DEFAULT_CHANNEL_RESOURCE_CONFIG, isOrderedChangePolicy} from './types';
export type {ChannelChangePolicy, ChannelResourceConfig} from './types';
