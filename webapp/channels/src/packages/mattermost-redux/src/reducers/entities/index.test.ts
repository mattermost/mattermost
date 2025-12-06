// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    PostTypes,
} from 'mattermost-redux/action_types';
import reducer from 'mattermost-redux/reducers/entities/index';

type EntitiesState = ReturnType<typeof reducer>;
describe('reducers.entities.search', () => {
    describe('PostTypes.RECEIVED_POST', () => {
        it('should remove file from file search results', () => {
            const inputState = {
                posts: {
                    posts: {
                        abcd: {id: 'abcd', file_ids: ['bdcf']},
                        efgh: {id: 'efgh'},
                    },
                },
                search: {
                    fileResults: ['bdcf']
                }
            };

            const action = {
                type: PostTypes.RECEIVED_POST,
                data: {
                    id: 'abcd',
                    file_ids: []
                },
            };
            const expectedState = {
                ...inputState,
                search: {
                    fileResults: []
                }
            };

            const actualState = reducer(inputState as EntitiesState, action);
            expect(actualState.search.fileResults).toEqual(expectedState.search.fileResults);
        });

        it('should not remove deleted file from file search results', () => {
            const inputState = {
                posts: {
                    posts: {
                        abcd: {id: 'abcd', file_ids: ['bdcf']},
                        efgh: {id: 'efgh', file_ids: ['hjkl']},
                    },
                },
                search: {
                    fileResults: ['bdcf']
                }
            };

            const action = {
                type: PostTypes.RECEIVED_POST,
                data: {
                    id: 'efgh',
                    file_ids: []
                },
            };
            const expectedState = {
                ...inputState,
                search: {
                    fileResults: ['bdcf']
                }
            };

            const actualState = reducer(inputState as EntitiesState, action);
            expect(actualState.search.fileResults).toEqual(expectedState.search.fileResults);
        });

        it('should remove only one deleted file in post from file search results', () => {
            const inputState = {
                posts: {
                    posts: {
                        abcd: {id: 'abcd', file_ids: ['bdcf', 'babb']},
                        efgh: {id: 'efgh'},
                    },
                },
                search: {
                    fileResults: ['bdcf', 'babb']
                }
            };

            const action = {
                type: PostTypes.RECEIVED_POST,
                data: {
                    id: 'abcd',
                    file_ids: ['babb']
                },
            };
            const expectedState = {
                posts: {
                    posts: {
                        abcd: {id: 'abcd', file_ids: ['babb']},
                        efgh: {id: 'efgh'},
                    },
                },
                search: {
                    fileResults: ['babb']
                }
            };

            const actualState = reducer(inputState as EntitiesState, action);
            expect(actualState.search.fileResults).toEqual(expectedState.search.fileResults);
            expect(actualState.posts.posts.abcd.file_ids).toEqual(expectedState.posts.posts.abcd.file_ids);
        });

        it('should remove multiple deleted files in post from file search results', () => {
            const inputState = {
                posts: {
                    posts: {
                        abcd: {id: 'abcd', file_ids: ['bdcf', 'babb']},
                        efgh: {id: 'efgh', file_ids: ['dbeb']},
                    },
                },
                search: {
                    fileResults: ['bdcf', 'babb', 'dbeb']
                }
            };

            const action = {
                type: PostTypes.RECEIVED_POST,
                data: {
                    id: 'abcd',
                    file_ids: []
                },
            };
            const expectedState = {
                posts: {
                    posts: {
                        abcd: {id: 'abcd', file_ids: []},
                        efgh: {id: 'efgh', file_ids: ['dbeb']},
                    },
                },
                search: {
                    fileResults: ['dbeb']
                }
            };

            const actualState = reducer(inputState as EntitiesState, action);
            expect(actualState.search.fileResults).toEqual(expectedState.search.fileResults);
            expect(actualState.posts.posts.abcd.file_ids).toEqual(expectedState.posts.posts.abcd.file_ids);
        });
    });

    describe('PostTypes.POST_DELETED', () => {
        it('should remove file from file search results when post is deleted', () => {
            const inputState = {
                posts: {
                    posts: {
                        abcd: {id: 'abcd', file_ids: ['bdcf']},
                        efgh: {id: 'efgh'},
                    },
                },
                search: {
                    fileResults: ['bdcf']
                }
            };

            const action = {
                type: PostTypes.POST_DELETED,
                data: {
                    id: 'abcd',
                    file_ids: ['bdcf']
                },
            };
            const expectedState = {
                ...inputState,
                search: {
                    fileResults: []
                }
            };

            const actualState = reducer(inputState as EntitiesState, action);
            expect(actualState.search.fileResults).toEqual(expectedState.search.fileResults);
        });

        it('should remove all files from file search results when post is deleted', () => {
            const inputState = {
                posts: {
                    posts: {
                        abcd: {id: 'abcd', file_ids: ['bdcf', 'gegh']},
                        efgh: {id: 'efgh'},
                    },
                },
                search: {
                    fileResults: ['bdcf', 'gegh']
                }
            };

            const action = {
                type: PostTypes.POST_DELETED,
                data: {
                    id: 'abcd',
                    file_ids: ['bdcf', 'gegh']
                },
            };
            const expectedState = {
                ...inputState,
                search: {
                    fileResults: []
                }
            };

            const actualState = reducer(inputState as EntitiesState, action);
            expect(actualState.search.fileResults).toEqual(expectedState.search.fileResults);
        });

        it('should not remove any file from file search results when post with file is deleted', () => {
            const inputState = {
                posts: {
                    posts: {
                        abcd: {id: 'abcd', file_ids: ['bdcf']},
                        bbbb: {id: 'bbbb', file_ids: ['abeb']},
                        efgh: {id: 'efgh'},
                    },
                },
                search: {
                    fileResults: ['bdcf']
                }
            };

            const action = {
                type: PostTypes.POST_DELETED,
                data: {
                    id: 'bbbb',
                    file_ids: ['abeb']
                },
            };
            const expectedState = {
                ...inputState,
                search: {
                    fileResults: ['bdcf']
                }
            };

            const actualState = reducer(inputState as EntitiesState, action);
            expect(actualState.search.fileResults).toEqual(expectedState.search.fileResults);
        });

        it('should not remove any file from file search results when post is deleted', () => {
            const inputState = {
                posts: {
                    posts: {
                        abcd: {id: 'abcd', file_ids: ['bdcf']},
                        bbbb: {id: 'bbbb', file_ids: ['abeb']},
                        efgh: {id: 'efgh'},
                    },
                },
                search: {
                    fileResults: ['bdcf']
                }
            };

            const action = {
                type: PostTypes.POST_DELETED,
                data: {
                    id: 'efgh',
                },
            };
            const expectedState = {
                ...inputState,
                search: {
                    fileResults: ['bdcf']
                }
            };

            const actualState = reducer(inputState as EntitiesState, action);
            expect(actualState.search.fileResults).toEqual(expectedState.search.fileResults);
        });
    })
})
