// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DeepPartial} from '@mattermost/types/utilities';

import type {GlobalState} from 'types/store';
import type {ChannelSettingsTabComponent} from 'types/store/plugins';

import {getChannelSettingsTabs} from './plugins';

describe('Selectors.Plugins', () => {
    const DummyChannelSettingsTab = () => null;

    function makeChannelSettingsTab(overrides: Partial<ChannelSettingsTabComponent> = {}): ChannelSettingsTabComponent {
        return {
            id: 'tab-1',
            pluginId: 'plugin-a',
            kind: 'custom',
            uiName: 'Plugin Tab',
            shouldRender: jest.fn(() => true),
            component: DummyChannelSettingsTab,
            ...overrides,
        } as ChannelSettingsTabComponent;
    }

    function makeState(channelSettingsTabs: ChannelSettingsTabComponent[] = []): GlobalState {
        const state: DeepPartial<GlobalState> = {
            plugins: {
                channelSettingsTabs,
            },
        };

        return state as GlobalState;
    }

    it('returns channel settings tab registrations', () => {
        const registration = makeChannelSettingsTab({
            shouldRender: jest.fn(() => true),
        });
        const state = makeState([registration]);

        expect(getChannelSettingsTabs(state)).toEqual([registration]);
    });

    it('does not call shouldRender while returning channel settings tab registrations', () => {
        const shouldRender = jest.fn(() => false);
        const registration = makeChannelSettingsTab({
            shouldRender,
        });
        const state = makeState([registration]);

        expect(getChannelSettingsTabs(state)).toEqual([registration]);
        expect(shouldRender).not.toHaveBeenCalled();
    });

    it('preserves registration order', () => {
        const firstRegistration = makeChannelSettingsTab({
            id: 'tab-1',
            uiName: 'First Plugin Tab',
            shouldRender: jest.fn(() => false),
        });
        const secondRegistration = makeChannelSettingsTab({
            id: 'tab-2',
            pluginId: 'plugin-b',
            uiName: 'Second Plugin Tab',
            shouldRender: jest.fn(() => true),
        });
        const thirdRegistration = makeChannelSettingsTab({
            id: 'tab-3',
            pluginId: 'plugin-c',
            uiName: 'Third Plugin Tab',
            shouldRender: jest.fn(() => true),
        });
        const state = makeState([firstRegistration, secondRegistration, thirdRegistration]);

        expect(getChannelSettingsTabs(state)).toEqual([firstRegistration, secondRegistration, thirdRegistration]);
    });
});
