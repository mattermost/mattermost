// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DeepPartial} from '@mattermost/types/utilities';

import type {GlobalState} from 'types/store';
import type {ChannelSettingsTabComponent} from 'types/store/plugins';

import {getVisibleChannelSettingsTabs} from './plugins';

describe('Selectors.Plugins', () => {
    const channelId = 'channel1';
    const channel = {
        id: channelId,
        team_id: 'team1',
        name: 'test-channel',
        type: 'O' as const,
    };
    const DummyChannelSettingsTab = () => null;

    function makeChannelSettingsTab(overrides: Partial<ChannelSettingsTabComponent> = {}): ChannelSettingsTabComponent {
        return {
            id: 'tab-1',
            pluginId: 'plugin-a',
            uiName: 'Plugin Tab',
            shouldRender: jest.fn(() => true),
            component: DummyChannelSettingsTab,
            ...overrides,
        };
    }

    function makeState(channelSettingsTabs: ChannelSettingsTabComponent[] = []): GlobalState {
        const state: DeepPartial<GlobalState> = {
            entities: {
                channels: {
                    channels: {
                        [channelId]: channel,
                    },
                },
            },
            plugins: {
                components: {
                    ChannelSettingsTab: channelSettingsTabs,
                },
            },
        };

        return state as GlobalState;
    }

    it('returns an empty array when the channel does not exist', () => {
        const shouldRender = jest.fn(() => true);
        const registration = makeChannelSettingsTab({shouldRender});
        const state = makeState([registration]);

        expect(getVisibleChannelSettingsTabs(state, 'missing-channel')).toEqual([]);
        expect(shouldRender).not.toHaveBeenCalled();
    });

    it('returns visible channel settings tabs when shouldRender is true', () => {
        const registration = makeChannelSettingsTab({
            shouldRender: jest.fn(() => true),
        });
        const state = makeState([registration]);

        expect(getVisibleChannelSettingsTabs(state, channelId)).toEqual([registration]);
    });

    it('filters out channel settings tabs when shouldRender is false', () => {
        const registration = makeChannelSettingsTab({
            shouldRender: jest.fn(() => false),
        });
        const state = makeState([registration]);

        expect(getVisibleChannelSettingsTabs(state, channelId)).toEqual([]);
    });

    it('treats channel settings tabs without shouldRender as visible', () => {
        const registration = {
            ...makeChannelSettingsTab(),
            shouldRender: undefined,
        } as unknown as ChannelSettingsTabComponent;
        const state = makeState([registration]);

        expect(getVisibleChannelSettingsTabs(state, channelId)).toEqual([registration]);
    });

    it('passes the resolved channel object into shouldRender', () => {
        const shouldRender = jest.fn(() => true);
        const registration = makeChannelSettingsTab({shouldRender});
        const state = makeState([registration]);

        getVisibleChannelSettingsTabs(state, channelId);

        expect(shouldRender).toHaveBeenCalledWith(state, state.entities.channels.channels[channelId]);
    });

    it('preserves registration order when filtering multiple tabs', () => {
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

        expect(getVisibleChannelSettingsTabs(state, channelId)).toEqual([secondRegistration, thirdRegistration]);
    });
});
