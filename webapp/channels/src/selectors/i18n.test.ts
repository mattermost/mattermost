// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {General} from 'mattermost-redux/constants';

import {getCurrentLocale, getTranslations} from 'selectors/i18n';

import type {GlobalState} from 'types/store';

describe('selectors/i18n', () => {
    describe('getCurrentLocale', () => {
        test('not logged in', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            DefaultClientLocale: 'fr',
                        },
                    },
                    users: {
                        currentUserId: '',
                        profiles: {},
                    },
                },
            } as unknown as GlobalState;

            expect(getCurrentLocale(state)).toEqual('fr');
        });

        test('logged in', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            DefaultClientLocale: 'fr',
                        },
                    },
                    users: {
                        currentUserId: 'abcd',
                        profiles: {
                            abcd: {
                                locale: 'de',
                            },
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(getCurrentLocale(state)).toEqual('de');
        });

        test('returns default locale when invalid user locale specified', () => {
            const state = {
                entities: {
                    general: {
                        config: {
                            DefaultClientLocale: 'en',
                        },
                    },
                    users: {
                        currentUserId: 'abcd',
                        profiles: {
                            abcd: {
                                locale: 'not_valid',
                            },
                        },
                    },
                },
            } as unknown as GlobalState;

            expect(getCurrentLocale(state)).toEqual(General.DEFAULT_LOCALE);
        });

        describe('locale from query parameter', () => {
            const setWindowLocaleQueryParameter = (locale: string) => {
                const url = new URL(window.location.href);
                url.searchParams.set('locale', locale);
                window.history.replaceState({}, '', url.toString());
            };

            afterEach(() => {
                // Reset the URL
                window.history.replaceState({}, '', 'http://localhost:8065/');
            });

            test('returns locale from query parameter if provided and not logged in', () => {
                const state = {
                    entities: {
                        general: {
                            config: {
                                DefaultClientLocale: 'fr',
                            },
                        },
                        users: {
                            currentUserId: '',
                            profiles: {},
                        },
                    },
                } as unknown as GlobalState;

                setWindowLocaleQueryParameter('ko');

                expect(getCurrentLocale(state)).toEqual('ko');
            });

            test('returns DefaultClientLocale if locale from query parameter is not valid', () => {
                const state = {
                    entities: {
                        general: {
                            config: {
                                DefaultClientLocale: 'fr',
                            },
                        },
                        users: {
                            currentUserId: '',
                            profiles: {},
                        },
                    },
                } as unknown as GlobalState;

                setWindowLocaleQueryParameter('invalid_locale');

                expect(getCurrentLocale(state)).toEqual('fr');
            });

            test('returns user locale when logged in and locale is provided in query parameter', () => {
                const state = {
                    entities: {
                        general: {
                            config: {
                                DefaultClientLocale: 'fr',
                            },
                        },
                        users: {
                            currentUserId: 'abcd',
                            profiles: {
                                abcd: {
                                    locale: 'de',
                                },
                            },
                        },
                    },
                } as unknown as GlobalState;

                setWindowLocaleQueryParameter('ko');

                expect(getCurrentLocale(state)).toEqual('de');
            });
        });
    });

    describe('getTranslations', () => {
        const state = {
            views: {
                i18n: {
                    translations: {
                        en: {
                            'test.hello_world': 'Hello, World!',
                        },
                    },
                },
            },
        } as unknown as GlobalState;

        test('returns loaded translations', () => {
            expect(getTranslations(state, 'en')).toBe(state.views.i18n.translations.en);
        });

        test('returns null for unloaded translations', () => {
            expect(getTranslations(state, 'fr')).toEqual(undefined);
        });

        test('returns English translations for unsupported locale', () => {
            // This test will have to be changed if we add support for Gaelic
            expect(getTranslations(state, 'gd')).toBe(state.views.i18n.translations.en);
        });
    });
});
