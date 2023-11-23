// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {General} from 'mattermost-redux/constants';

import {getCurrentLocale, getTranslations} from 'selectors/i18n';

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
            };

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
            };

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
            };

            expect(getCurrentLocale(state)).toEqual(General.DEFAULT_LOCALE);
        });

        describe('locale from query parameter', () => {
            // Helper function to mock window.location.search with locale query parameter
            const setWindowLocaleQueryParameter = (locale) => {
                window.location.search = `?locale=${locale}`;
            };

            // Helper function to reset window.location.search
            const resetWindowLocationSearch = () => {
                window.location.search = '';
            };

            afterEach(() => {
                resetWindowLocationSearch();
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
                };

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
                };

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
                };

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
        };

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
