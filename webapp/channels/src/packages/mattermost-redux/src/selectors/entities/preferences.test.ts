// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import {PreferencesType} from '@mattermost/types/preferences';

import {General, Preferences} from 'mattermost-redux/constants';

import * as Selectors from 'mattermost-redux/selectors/entities/preferences';

import mergeObjects from '../../../test/merge_objects';

import * as ThemeUtils from 'mattermost-redux/utils/theme_utils';

import deepFreezeAndThrowOnMutation from 'mattermost-redux/utils/deep_freeze';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

describe('Selectors.Preferences', () => {
    const category1 = 'testcategory1';
    const category2 = 'testcategory2';
    const directCategory = Preferences.CATEGORY_DIRECT_CHANNEL_SHOW;
    const groupCategory = Preferences.CATEGORY_GROUP_CHANNEL_SHOW;

    const name1 = 'testname1';
    const value1 = 'true';
    const pref1 = {category: category1, name: name1, value: value1, user_id: ''};

    const name2 = 'testname2';
    const value2 = '42';
    const pref2 = {category: category2, name: name2, value: value2, user_id: ''};

    const dm1 = 'teammate1';
    const dmPref1 = {category: directCategory, name: dm1, value: 'true', user_id: ''};
    const dm2 = 'teammate2';
    const dmPref2 = {category: directCategory, name: dm2, value: 'false', user_id: ''};

    const gp1 = 'group1';
    const prefGp1 = {category: groupCategory, name: gp1, value: 'true', user_id: ''};
    const gp2 = 'group2';
    const prefGp2 = {category: groupCategory, name: gp2, value: 'false', user_id: ''};

    const currentUserId = 'currentuserid';

    const myPreferences: PreferencesType = {};
    myPreferences[`${category1}--${name1}`] = pref1;
    myPreferences[`${category2}--${name2}`] = pref2;
    myPreferences[`${directCategory}--${dm1}`] = dmPref1;
    myPreferences[`${directCategory}--${dm2}`] = dmPref2;
    myPreferences[`${groupCategory}--${gp1}`] = prefGp1;
    myPreferences[`${groupCategory}--${gp2}`] = prefGp2;

    const testState = deepFreezeAndThrowOnMutation({
        entities: {
            users: {
                currentUserId,
            },
            preferences: {
                myPreferences,
            },
        },
    });

    describe('get preference', () => {
        it('should return the requested value', () => {
            expect(Selectors.get(testState, category1, name1)).toEqual('true');
        });

        describe('should fallback to the default', () => {
            it('if name unknown', () => {
                expect(Selectors.get(testState, category1, 'unknown name')).toEqual('');
            });

            it('if category unknown', () => {
                expect(Selectors.get(testState, 'unknown category', name1)).toEqual('');
            });
        });

        describe('should fallback to the overridden default', () => {
            it('if name unknown', () => {
                expect(Selectors.get(testState, category1, 'unknown name', 'fallback')).toEqual('fallback');
            });

            it('if category unknown', () => {
                expect(Selectors.get(testState, 'unknown category', name1, 'fallback')).toEqual('fallback');
            });
        });
    });

    describe('get bool preference', () => {
        it('should return the requested value', () => {
            expect(Selectors.getBool(testState, category1, name1)).toEqual(value1 === 'true');
        });

        describe('should fallback to the default', () => {
            it('if name unknown', () => {
                expect(Selectors.getBool(testState, category1, 'unknown name')).toEqual(false);
            });

            it('if category unknown', () => {
                expect(Selectors.getBool(testState, 'unknown category', name1)).toEqual(false);
            });
        });

        describe('should fallback to the overridden default', () => {
            it('if name unknown', () => {
                expect(Selectors.getBool(testState, category1, 'unknown name', true)).toEqual(true);
            });

            it('if category unknown', () => {
                expect(Selectors.getBool(testState, 'unknown category', name1, true)).toEqual(true);
            });
        });
    });

    describe('get int preference', () => {
        it('should return the requested value', () => {
            expect(Selectors.getInt(testState, category2, name2)).toEqual(parseInt(value2, 10));
        });

        describe('should fallback to the default', () => {
            it('if name unknown', () => {
                expect(Selectors.getInt(testState, category2, 'unknown name')).toEqual(0);
            });

            it('if category unknown', () => {
                expect(Selectors.getInt(testState, 'unknown category', name2)).toEqual(0);
            });
        });

        describe('should fallback to the overridden default', () => {
            it('if name unknown', () => {
                expect(Selectors.getInt(testState, category2, 'unknown name', 100)).toEqual(100);
            });

            it('if category unknown', () => {
                expect(Selectors.getInt(testState, 'unknown category', name2, 100)).toEqual(100);
            });
        });
    });

    it('get preferences by category', () => {
        const getCategory = Selectors.makeGetCategory();
        expect(getCategory(testState, category1)).toEqual([pref1]);
    });

    it('get direct channel show preferences', () => {
        expect(Selectors.getDirectShowPreferences(testState)).toEqual([dmPref1, dmPref2]);
    });

    it('get group channel show preferences', () => {
        expect(Selectors.getGroupShowPreferences(testState)).toEqual([prefGp1, prefGp2]);
    });

    it('get teammate name display setting', () => {
        expect(
            Selectors.getTeammateNameDisplaySetting({
                entities: {
                    general: {
                        config: {
                            TeammateNameDisplay: General.TEAMMATE_NAME_DISPLAY.SHOW_NICKNAME_FULLNAME,
                        },
                    },
                    preferences: {
                        myPreferences: {},
                    },
                },
            } as unknown as GlobalState)).toEqual(
            General.TEAMMATE_NAME_DISPLAY.SHOW_NICKNAME_FULLNAME,
        );
    });

    describe('get theme', () => {
        it('default theme', () => {
            const currentTeamId = '1234';

            expect(Selectors.getTheme({
                entities: {
                    general: {
                        config: {
                            DefaultTheme: 'default',
                        },
                    },
                    teams: {
                        currentTeamId,
                    },
                    preferences: {
                        myPreferences: {
                        },
                    },
                },
            } as unknown as GlobalState)).toEqual(Preferences.THEMES.denim);
        });

        it('custom theme', () => {
            const currentTeamId = '1234';
            const theme = {sidebarBg: '#ff0000'};

            expect(Selectors.getTheme({
                entities: {
                    general: {
                        config: {
                            DefaultTheme: 'default',
                        },
                    },
                    teams: {
                        currentTeamId,
                    },
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_THEME, '')]: {
                                category: Preferences.CATEGORY_THEME, name: '', value: JSON.stringify(theme),
                            },
                        },
                    },
                },
            } as GlobalState).sidebarBg).toEqual(theme.sidebarBg);
        });

        it('team-specific theme', () => {
            const currentTeamId = '1234';
            const otherTeamId = 'abcd';
            const theme = {sidebarBg: '#ff0000'};

            expect(Selectors.getTheme({
                entities: {
                    general: {
                        config: {
                            DefaultTheme: 'default',
                        },
                    },
                    teams: {
                        currentTeamId,
                    },
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_THEME, '')]: {
                                category: Preferences.CATEGORY_THEME, name: '', value: JSON.stringify({}),
                            },
                            [getPreferenceKey(Preferences.CATEGORY_THEME, currentTeamId)]: {
                                category: Preferences.CATEGORY_THEME, name: currentTeamId, value: JSON.stringify(theme),
                            },
                            [getPreferenceKey(Preferences.CATEGORY_THEME, otherTeamId)]: {
                                category: Preferences.CATEGORY_THEME, name: otherTeamId, value: JSON.stringify({}),
                            },
                        },
                    },
                },
            } as GlobalState).sidebarBg).toEqual(theme.sidebarBg);
        });

        it('mentionBj backwards compatability theme', () => {
            const currentTeamId = '1234';
            const theme: {mentionBj: string; mentionBg?: string} = {mentionBj: '#ff0000'};

            expect(Selectors.getTheme({
                entities: {
                    general: {
                        config: {
                            DefaultTheme: 'default',
                        },
                    },
                    teams: {
                        currentTeamId,
                    },
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_THEME, '')]: {
                                category: Preferences.CATEGORY_THEME, name: '', value: JSON.stringify(theme),
                            },
                        },
                    },
                },
            } as GlobalState).mentionBg).toEqual(theme.mentionBj);

            theme.mentionBg = '#ff0001';
            expect(Selectors.getTheme({
                entities: {
                    general: {
                        config: {
                            DefaultTheme: 'default',
                        },
                    },
                    teams: {
                        currentTeamId,
                    },
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_THEME, '')]: {
                                category: Preferences.CATEGORY_THEME, name: '', value: JSON.stringify(theme),
                            },
                        },
                    },
                },
            } as GlobalState).mentionBg).toEqual(theme.mentionBg);
        });

        it('updates sideBarTeamBarBg variable when its not present', () => {
            const currentTeamId = '1234';
            const theme = {sidebarHeaderBg: '#ff0000'};

            expect(Selectors.getTheme({
                entities: {
                    general: {
                        config: {
                            DefaultTheme: 'default',
                        },
                    },
                    teams: {
                        currentTeamId,
                    },
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_THEME, '')]: {
                                category: Preferences.CATEGORY_THEME, name: '', value: JSON.stringify(theme),
                            },
                        },
                    },
                },
            } as GlobalState).sidebarTeamBarBg).toEqual(ThemeUtils.blendColors(theme.sidebarHeaderBg, '#000000', 0.2, true));
        });

        it('memoization', () => {
            const currentTeamId = '1234';
            const otherTeamId = 'abcd';

            let state = {
                entities: {
                    general: {
                        config: {
                            DefaultTheme: 'default',
                        },
                    },
                    teams: {
                        currentTeamId,
                    },
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_THEME, '')]: {
                                category: Preferences.CATEGORY_THEME, name: '', value: JSON.stringify({}),
                            },
                            [getPreferenceKey(Preferences.CATEGORY_THEME, currentTeamId)]: {
                                category: Preferences.CATEGORY_THEME, name: currentTeamId, value: JSON.stringify({sidebarBg: '#ff0000'}),
                            },
                            [getPreferenceKey(Preferences.CATEGORY_THEME, otherTeamId)]: {
                                category: Preferences.CATEGORY_THEME, name: otherTeamId, value: JSON.stringify({}),
                            },
                        },
                    },
                },
            } as GlobalState;

            const before = Selectors.getTheme(state);

            expect(before).toBe(Selectors.getTheme(state));

            state = {
                ...state,
                entities: {
                    ...state.entities,
                    preferences: {
                        ...state.entities.preferences,
                        myPreferences: {
                            ...state.entities.preferences.myPreferences,
                            somethingUnrelated: {
                                category: 'somethingUnrelated', name: '', value: JSON.stringify({}), user_id: '',
                            },
                        },
                    },
                },
            };

            expect(before).toBe(Selectors.getTheme(state));

            state = {
                ...state,
                entities: {
                    ...state.entities,
                    preferences: {
                        ...state.entities.preferences,
                        myPreferences: {
                            ...state.entities.preferences.myPreferences,
                            [getPreferenceKey(Preferences.CATEGORY_THEME, currentTeamId)]: {
                                category: Preferences.CATEGORY_THEME, name: currentTeamId, value: JSON.stringify({sidebarBg: '#0000ff'}), user_id: '',
                            },
                        },
                    },
                },
            };

            expect(before).not.toBe(Selectors.getTheme(state));
            expect(before).not.toEqual(Selectors.getTheme(state));
        });

        it('custom theme with upper case colours', () => {
            const currentTeamId = '1234';
            const theme = {sidebarBg: '#FF0000'};

            expect(Selectors.getTheme({
                entities: {
                    general: {
                        config: {
                            DefaultTheme: 'default',
                        },
                    },
                    teams: {
                        currentTeamId,
                    },
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_THEME, '')]: {
                                category: Preferences.CATEGORY_THEME, name: '', value: JSON.stringify(theme),
                            },
                        },
                    },
                },
            } as GlobalState).sidebarBg).toEqual(theme.sidebarBg.toLowerCase());
        });

        it('custom theme with missing colours', () => {
            const currentTeamId = '1234';
            const theme = {sidebarBg: '#ff0000'};

            expect(Selectors.getTheme({
                entities: {
                    general: {
                        config: {
                            DefaultTheme: 'default',
                        },
                    },
                    teams: {
                        currentTeamId,
                    },
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_THEME, '')]: {
                                category: Preferences.CATEGORY_THEME, name: '', value: JSON.stringify(theme),
                            },
                        },
                    },
                },
            } as GlobalState).mentionHighlightLink).toEqual(Preferences.THEMES.denim.mentionHighlightLink);
        });

        it('system theme with missing colours', () => {
            const currentTeamId = '1234';
            const theme = {
                type: Preferences.THEMES.indigo.type,
                sidebarBg: '#ff0000',
            };

            expect(Selectors.getTheme({
                entities: {
                    general: {
                        config: {
                            DefaultTheme: 'default',
                        },
                    },
                    teams: {
                        currentTeamId,
                    },
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_THEME, '')]: {
                                category: Preferences.CATEGORY_THEME, name: '', value: JSON.stringify(theme),
                            },
                        },
                    },
                },
            } as GlobalState).sidebarText).toEqual(Preferences.THEMES.indigo.sidebarText);
        });

        it('non-default system theme', () => {
            const currentTeamId = '1234';
            const theme = {
                type: Preferences.THEMES.onyx.type,
            };

            expect(Selectors.getTheme({
                entities: {
                    general: {
                        config: {
                            DefaultTheme: 'default',
                        },
                    },
                    teams: {
                        currentTeamId,
                    },
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_THEME, '')]: {
                                category: Preferences.CATEGORY_THEME, name: '', value: JSON.stringify(theme),
                            },
                        },
                    },
                },
            } as GlobalState).codeTheme).toEqual(Preferences.THEMES.onyx.codeTheme);
        });

        it('should return the server-configured theme by default', () => {
            expect(Selectors.getTheme({
                entities: {
                    general: {
                        config: {
                            DefaultTheme: 'indigo',
                        },
                    },
                    teams: {
                        currentTeamId: null,
                    },
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_THEME, '')]: null,
                        },
                    },
                },
            } as unknown as GlobalState).codeTheme).toEqual(Preferences.THEMES.indigo.codeTheme);

            // Opposite case
            expect(Selectors.getTheme({
                entities: {
                    general: {
                        config: {
                            DefaultTheme: 'onyx',
                        },
                    },
                    teams: {
                        currentTeamId: null,
                    },
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_THEME, '')]: null,
                        },
                    },
                },
            } as unknown as GlobalState).codeTheme).not.toEqual(Preferences.THEMES.indigo.codeTheme);
        });

        it('returns the "default" theme if the server-configured value is not present', () => {
            expect(Selectors.getTheme({
                entities: {
                    general: {
                        config: {
                            DefaultTheme: 'fakedoesnotexist',
                        },
                    },
                    teams: {
                        currentTeamId: null,
                    },
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_THEME, '')]: null,
                        },
                    },
                },
            } as unknown as GlobalState).codeTheme).toEqual(Preferences.THEMES.denim.codeTheme);
        });
    });

    it('get theme from style', () => {
        const theme = {themeColor: '#ffffff'};
        const currentTeamId = '1234';

        const state = {
            entities: {
                general: {
                    config: {
                        DefaultTheme: 'default',
                    },
                },
                teams: {
                    currentTeamId,
                },
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_THEME, '')]: {
                            category: Preferences.CATEGORY_THEME, name: '', value: JSON.stringify(theme),
                        },
                    },
                },
            },
        } as GlobalState;

        function testStyleFunction(myTheme: Selectors.Theme) {
            return {
                container: {
                    backgroundColor: myTheme.themeColor,
                    height: 100,
                },
            };
        }

        const expected = {
            container: {
                backgroundColor: theme.themeColor,
                height: 100,
            },
        };

        const getStyleFromTheme = Selectors.makeGetStyleFromTheme();

        expect(getStyleFromTheme(state, testStyleFunction)).toEqual(expected);
    });
});

describe('shouldShowUnreadsCategory', () => {
    test('should return value from the preference if set', () => {
        const state = {
            entities: {
                general: {
                    config: {},
                },
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.SHOW_UNREAD_SECTION)]: {value: 'true'},
                    },
                },
            },
        } as GlobalState;

        expect(Selectors.shouldShowUnreadsCategory(state)).toBe(true);
    });

    test('should fall back properly from the new preference to the old one and then to the server default', () => {
        // With the new preference set
        let state = {
            entities: {
                general: {
                    config: {
                        ExperimentalGroupUnreadChannels: 'default_off',
                    },
                },
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.SHOW_UNREAD_SECTION)]: {value: 'true'},
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, '')]: {value: JSON.stringify({unreads_at_top: 'false'})},
                    },
                },
            },
        } as GlobalState;

        expect(Selectors.shouldShowUnreadsCategory(state)).toBe(true);

        state = mergeObjects(state, {
            entities: {
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.SHOW_UNREAD_SECTION)]: {value: 'false'},
                    },
                },
            },
        });

        expect(Selectors.shouldShowUnreadsCategory(state)).toBe(false);

        // With only the old preference set
        state = {
            entities: {
                general: {
                    config: {
                        ExperimentalGroupUnreadChannels: 'default_off',
                    },
                },
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, '')]: {value: JSON.stringify({unreads_at_top: 'true'})},
                    },
                },
            },
        } as GlobalState;

        expect(Selectors.shouldShowUnreadsCategory(state)).toBe(true);

        state = mergeObjects(state, {
            entities: {
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, '')]: {value: JSON.stringify({unreads_at_top: 'false'})},
                    },
                },
            },
        });

        expect(Selectors.shouldShowUnreadsCategory(state)).toBe(false);

        // Fall back from there to the server default
        state = {
            entities: {
                general: {
                    config: {
                        ExperimentalGroupUnreadChannels: 'default_on',
                    },
                },
                preferences: {
                    myPreferences: {},
                },
            },
        } as GlobalState;

        expect(Selectors.shouldShowUnreadsCategory(state)).toBe(true);

        state = mergeObjects(state, {
            entities: {
                general: {
                    config: {
                        ExperimentalGroupUnreadChannels: 'default_off',
                    },
                },
            },
        });

        expect(Selectors.shouldShowUnreadsCategory(state)).toBe(false);
    });

    test('should not let admins fully disable the unread section', () => {
        // With the old sidebar, setting ExperimentalGroupUnreadChannels to disabled has an effect
        const state = {
            entities: {
                general: {
                    config: {
                        ExperimentalGroupUnreadChannels: 'disabled',
                    },
                },
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.SHOW_UNREAD_SECTION)]: {value: 'true'},
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, '')]: {value: JSON.stringify({unreads_at_top: 'true'})},
                    },
                },
            },
        } as GlobalState;

        expect(Selectors.shouldShowUnreadsCategory(state)).toBe(true);
    });
});
