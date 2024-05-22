// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getChannelHeaderMenuPluginComponents, getPluginUserSettings} from 'selectors/plugins';

describe('selectors/plugins', () => {
    describe('getPluginUserSettings', () => {
        it('has no settings', () => {
            const state = {
                plugins: {},
            };
            const settings = getPluginUserSettings(state);
            expect(settings).toEqual({});
        });
        it('has settings', () => {
            const stateSettings = {
                pluginId: {
                    id: 'pluginId',
                },
                pluginId2: {
                    id: 'pluginId2',
                },
            };
            const state = {
                plugins: {
                    userSettings: stateSettings,
                },
            };
            const settings = getPluginUserSettings(state);
            expect(settings).toEqual(stateSettings);
        });
    });

    describe('getChannelHeaderMenuPluginComponents', () => {
        test('no channel header components found', () => {
            const expectedComponents = [];

            const state = {
                entities: {
                    general: {
                        config: {},
                    },
                    preferences: {
                        myPreferences: {},
                    },
                },
                plugins: {
                    components: {
                        ChannelHeader: expectedComponents,
                    },
                },
            };
            const components = getChannelHeaderMenuPluginComponents(state);
            expect(components).toEqual(expectedComponents);
        });

        test('one channel header component found as shouldRender returns true', () => {
            const expectedComponents = [
                {
                    shouldRender: () => true,
                },
            ];

            const state = {
                entities: {
                    general: {
                        config: {},
                    },
                    preferences: {
                        myPreferences: {},
                    },
                },
                plugins: {
                    components: {
                        ChannelHeader: expectedComponents,
                    },
                },
            };

            const components = getChannelHeaderMenuPluginComponents(state);
            expect(components).toEqual(expectedComponents);
        });

        test('one channel header component found as shouldRender is not defined', () => {
            const expectedComponents = [
                {
                    id: 'testId',
                },
            ];

            const state = {
                entities: {
                    general: {
                        config: {},
                    },
                    preferences: {
                        myPreferences: {},
                    },
                },
                plugins: {
                    components: {
                        ChannelHeader: expectedComponents,
                    },
                },
            };

            const components = getChannelHeaderMenuPluginComponents(state);
            expect(components).toEqual(expectedComponents);
        });

        test('no channel header components found as shouldRender returns false', () => {
            const expectedComponents = [];

            const state = {
                entities: {
                    general: {
                        config: {},
                    },
                    preferences: {
                        myPreferences: {},
                    },
                },
                plugins: {
                    components: {
                        ChannelHeader: [{
                            shouldRender: () => false,
                        }],
                    },
                },
            };

            const components = getChannelHeaderMenuPluginComponents(state);
            expect(components).toEqual(expectedComponents);
        });

        test('memoization', () => {
            let shouldRenderResult = false;

            let state = {
                entities: {
                    general: {
                        config: {},
                    },
                    preferences: {
                        myPreferences: {},
                    },
                },
                plugins: {
                    components: {
                        ChannelHeader: [{
                            shouldRender: () => shouldRenderResult,
                        }],
                    },
                },
            };

            const firstResult = getChannelHeaderMenuPluginComponents(state);

            expect(firstResult).toEqual([]);

            // No changes to state
            const secondResult = getChannelHeaderMenuPluginComponents(state);

            expect(secondResult).toBe(firstResult);

            // Something unrelated changed in state
            state = {...state};

            const thirdResult = getChannelHeaderMenuPluginComponents(state);

            expect(thirdResult).toBe(firstResult);

            // shouldRender changed because something else in state changed
            state = {...state};
            shouldRenderResult = true;

            const fourthResult = getChannelHeaderMenuPluginComponents(state);

            expect(fourthResult).not.toBe(firstResult);
            expect(fourthResult).toEqual([
                state.plugins.components.ChannelHeader[0],
            ]);

            // A new plugin was added
            state = {
                ...state,
                plugins: {
                    ...state.plugins,
                    components: {
                        ...state.plugins.components,
                        ChannelHeader: [
                            ...state.plugins.components.ChannelHeader,
                            {
                                id: 'anotherPlugin',
                            },
                        ],
                    },
                },
            };

            const fifthResult = getChannelHeaderMenuPluginComponents(state);

            expect(fifthResult).not.toBe(fourthResult);
            expect(fifthResult).toEqual([
                state.plugins.components.ChannelHeader[0],
                state.plugins.components.ChannelHeader[1],
            ]);
        });
    });
});
