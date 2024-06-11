// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    PostTypes,
    SearchTypes,
    UserTypes,
} from 'mattermost-redux/action_types';
import reducer from 'mattermost-redux/reducers/entities/search';

type SearchState = ReturnType<typeof reducer>;

describe('reducers.entities.search', () => {
    describe('results', () => {
        it('initial state', () => {
            const inputState = undefined;
            const action = {type: undefined};
            const expectedState: any = [];

            const actualState = reducer({results: inputState} as SearchState, action);
            expect(actualState.results).toEqual(expectedState);
        });

        describe('SearchTypes.RECEIVED_SEARCH_POSTS', () => {
            it('first results received', () => {
                const inputState: string[] = [];
                const action = {
                    type: SearchTypes.RECEIVED_SEARCH_POSTS,
                    data: {
                        order: ['abcd', 'efgh'],
                        posts: {
                            abcd: {id: 'abcd'},
                            efgh: {id: 'efgh'},
                        },
                    },
                };
                const expectedState = ['abcd', 'efgh'];

                const actualState = reducer({results: inputState} as SearchState, action);
                expect(actualState.results).toEqual(expectedState);
            });

            it('multiple results received', () => {
                const inputState = ['1234', '1235'];
                const action = {
                    type: SearchTypes.RECEIVED_SEARCH_POSTS,
                    data: {
                        order: ['abcd', 'efgh'],
                        posts: {
                            abcd: {id: 'abcd'},
                            efgh: {id: 'efgh'},
                        },
                    },
                };
                const expectedState = ['abcd', 'efgh'];

                const actualState = reducer({results: inputState} as SearchState, action);
                expect(actualState.results).toEqual(expectedState);
            });
        });

        describe('PostTypes.POST_REMOVED', () => {
            it('post in results', () => {
                const inputState = ['abcd', 'efgh'];
                const action = {
                    type: PostTypes.POST_REMOVED,
                    data: {
                        id: 'efgh',
                    },
                };
                const expectedState = ['abcd'];

                const actualState = reducer({results: inputState} as SearchState, action);
                expect(actualState.results).toEqual(expectedState);
            });

            it('post not in results', () => {
                const inputState = ['abcd', 'efgh'];
                const action = {
                    type: PostTypes.POST_REMOVED,
                    data: {
                        id: '1234',
                    },
                };
                const expectedState = ['abcd', 'efgh'];

                const actualState = reducer({results: inputState} as SearchState, action);
                expect(actualState.results).toEqual(expectedState);
                expect(actualState.results).toEqual(inputState);
            });
        });

        describe('SearchTypes.REMOVE_SEARCH_POSTS', () => {
            const inputState = ['abcd', 'efgh'];
            const action = {
                type: SearchTypes.REMOVE_SEARCH_POSTS,
            };
            const expectedState: string[] = [];

            const actualState = reducer({results: inputState} as SearchState, action);
            expect(actualState.results).toEqual(expectedState);
        });

        describe('UserTypes.LOGOUT_SUCCESS', () => {
            const inputState = ['abcd', 'efgh'];
            const action = {
                type: UserTypes.LOGOUT_SUCCESS,
            };
            const expectedState: string[] = [];

            const actualState = reducer({results: inputState} as SearchState, action);
            expect(actualState.results).toEqual(expectedState);
        });
    });

    describe('fileResults', () => {
        it('initial state', () => {
            const inputState = undefined;
            const action = {type: undefined};
            const expectedState: string[] = [];

            const actualState = reducer({fileResults: inputState} as SearchState, action);
            expect(actualState.fileResults).toEqual(expectedState);
        });

        describe('SearchTypes.RECEIVED_SEARCH_POSTS', () => {
            it('first file results received', () => {
                const inputState: string[] = [];
                const action = {
                    type: SearchTypes.RECEIVED_SEARCH_FILES,
                    data: {
                        order: ['abcd', 'efgh'],
                        file_infos: {
                            abcd: {id: 'abcd'},
                            efgh: {id: 'efgh'},
                        },
                    },
                };
                const expectedState = ['abcd', 'efgh'];

                const actualState = reducer({fileResults: inputState} as SearchState, action);
                expect(actualState.fileResults).toEqual(expectedState);
            });

            it('multiple file results received', () => {
                const inputState = ['1234', '1235'];
                const action = {
                    type: SearchTypes.RECEIVED_SEARCH_FILES,
                    data: {
                        order: ['abcd', 'efgh'],
                        file_infos: {
                            abcd: {id: 'abcd'},
                            efgh: {id: 'efgh'},
                        },
                    },
                };
                const expectedState = ['abcd', 'efgh'];

                const actualState = reducer({fileResults: inputState} as SearchState, action);
                expect(actualState.fileResults).toEqual(expectedState);
            });
        });

        describe('SearchTypes.REMOVE_SEARCH_FILES', () => {
            const inputState = ['abcd', 'efgh'];
            const action = {
                type: SearchTypes.REMOVE_SEARCH_FILES,
            };
            const expectedState: string[] = [];

            const actualState = reducer({fileResults: inputState} as SearchState, action);
            expect(actualState.fileResults).toEqual(expectedState);
        });

        describe('UserTypes.LOGOUT_SUCCESS', () => {
            const inputState = ['abcd', 'efgh'];
            const action = {
                type: UserTypes.LOGOUT_SUCCESS,
            };
            const expectedState: string[] = [];

            const actualState = reducer({fileResults: inputState} as SearchState, action);
            expect(actualState.fileResults).toEqual(expectedState);
        });
    });

    describe('matches', () => {
        it('initial state', () => {
            const inputState = undefined;
            const action = {type: undefined};
            const expectedState = {};

            const actualState = reducer({matches: inputState} as SearchState, action);
            expect(actualState.matches).toEqual(expectedState);
        });

        describe('SearchTypes.RECEIVED_SEARCH_POSTS', () => {
            it('no matches received', () => {
                const inputState = {};
                const action = {
                    type: SearchTypes.RECEIVED_SEARCH_POSTS,
                    data: {
                        order: ['abcd', 'efgh'],
                        posts: {
                            abcd: {id: 'abcd'},
                            efgh: {id: 'efgh'},
                        },
                    },
                };
                const expectedState = {};

                const actualState = reducer({matches: inputState} as SearchState, action);
                expect(actualState.matches).toEqual(expectedState);
            });

            it('first results received', () => {
                const inputState = {};
                const action = {
                    type: SearchTypes.RECEIVED_SEARCH_POSTS,
                    data: {
                        order: ['abcd', 'efgh'],
                        posts: {
                            abcd: {id: 'abcd'},
                            efgh: {id: 'efgh'},
                        },
                        matches: {
                            abcd: ['test', 'testing'],
                            efgh: ['tests'],
                        },
                    },
                };
                const expectedState = {
                    abcd: ['test', 'testing'],
                    efgh: ['tests'],
                };

                const actualState = reducer({matches: inputState} as SearchState, action);
                expect(actualState.matches).toEqual(expectedState);
            });

            it('multiple results received', () => {
                const inputState = {
                    1234: ['foo', 'bar'],
                    5678: ['foo'],
                };
                const action = {
                    type: SearchTypes.RECEIVED_SEARCH_POSTS,
                    data: {
                        order: ['abcd', 'efgh'],
                        posts: {
                            abcd: {id: 'abcd'},
                            efgh: {id: 'efgh'},
                        },
                        matches: {
                            abcd: ['test', 'testing'],
                            efgh: ['tests'],
                        },
                    },
                };
                const expectedState = {
                    abcd: ['test', 'testing'],
                    efgh: ['tests'],
                };

                const actualState = reducer({matches: inputState} as SearchState, action);
                expect(actualState.matches).toEqual(expectedState);
            });
        });

        describe('PostTypes.POST_REMOVED', () => {
            it('post in results', () => {
                const inputState = {
                    abcd: ['test', 'testing'],
                    efgh: ['tests'],
                };
                const action = {
                    type: PostTypes.POST_REMOVED,
                    data: {
                        id: 'efgh',
                    },
                };
                const expectedState = {
                    abcd: ['test', 'testing'],
                };

                const actualState = reducer({matches: inputState} as SearchState, action);
                expect(actualState.matches).toEqual(expectedState);
            });

            it('post not in results', () => {
                const inputState = {
                    abcd: ['test', 'testing'],
                    efgh: ['tests'],
                };
                const action = {
                    type: PostTypes.POST_REMOVED,
                    data: {
                        id: '1234',
                    },
                };
                const expectedState = {
                    abcd: ['test', 'testing'],
                    efgh: ['tests'],
                };

                const actualState = reducer({matches: inputState} as SearchState, action);
                expect(actualState.matches).toEqual(expectedState);
                expect(actualState.matches).toEqual(inputState);
            });
        });

        describe('SearchTypes.REMOVE_SEARCH_POSTS', () => {
            const inputState = {
                abcd: ['test', 'testing'],
                efgh: ['tests'],
            };
            const action = {
                type: SearchTypes.REMOVE_SEARCH_POSTS,
            };
            const expectedState = {};

            const actualState = reducer({matches: inputState} as SearchState, action);
            expect(actualState.matches).toEqual(expectedState);
        });

        describe('UserTypes.LOGOUT_SUCCESS', () => {
            const inputState = {
                abcd: ['test', 'testing'],
                efgh: ['tests'],
            };
            const action = {
                type: UserTypes.LOGOUT_SUCCESS,
            };
            const expectedState = {};

            const actualState = reducer({matches: inputState} as SearchState, action);
            expect(actualState.matches).toEqual(expectedState);
        });
    });

    describe('pinned', () => {
        it('do not show multiples of the same post', () => {
            const inputState = {
                abcd: ['1234', '5678'],
            };
            const action = {
                type: PostTypes.RECEIVED_POST,
                data: {
                    id: '5678',
                    is_pinned: true,
                    channel_id: 'abcd',
                },
            };

            const actualState = reducer({pinned: inputState} as unknown as SearchState, action);
            expect(actualState.pinned).toEqual(inputState);
        });
    });
});
