// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AdminConfig} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

export type HandleSaveFunction = (config: DeepPartial<AdminConfig>, updateSettings: (id: string, value: unknown) => void) => void;
export type GetStateFromConfigFunction = (config: AdminConfig, license: License) => {[x: string]: any};
export type GetConfigFromStateFunction = (state: {[x: string]: any}) => DeepPartial<AdminConfig>;
