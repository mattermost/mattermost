// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';

import type {AdminConfig, License} from '@mattermost/types/config';
import type {DeepPartial} from '@mattermost/types/utilities';

import type BooleanSetting from '../boolean_setting';
import type AdminTextSetting from '../text_setting';

export type HandleSaveFunction = (config: DeepPartial<AdminConfig>, updateSettings: (id: string, value: unknown) => void) => void;
export type GetStateFromConfigFunction = (config: AdminConfig, license: License) => {[x: string]: any};
export type GetConfigFromStateFunction = (state: {[x: string]: any}) => DeepPartial<AdminConfig>;

export type MinimalBooleanSettingProps = Pick<ComponentProps<typeof BooleanSetting>, 'value' | 'onChange' | 'disabled'>;
export type MinimalTextSettingProps = Pick<ComponentProps<typeof AdminTextSetting>, 'value' | 'onChange' | 'disabled'>;
