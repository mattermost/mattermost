// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostTypes} from 'mattermost-redux/action_types';
import {
    files as filesReducer,
    filesFromSearch as filesFromSearchReducer,
    fileIdsByPostId as fileIdsByPostIdReducer,
} from 'mattermost-redux/reducers/entities/files';
import deepFreeze from 'mattermost-redux/utils/deep_freeze';

describe('reducers/entities/files', () => {
    describe('files', () => {
        const testForSinglePost = (actionType: string) => () => {
            it('no post metadata attribute', () => {
                const state = deepFreeze({});
                const action = {
                    type: actionType,
                    data: {
                        id: 'post',
                    },
                };

                const nextState = filesReducer(state, action);

                expect(nextState).toEqual(state);
            });

            it('empty post metadata attribute', () => {
                const state = deepFreeze({});
                const action = {
                    type: actionType,
                    data: {
                        id: 'post',
                    },
                    metadata: {},
                };

                const nextState = filesReducer(state, action);

                expect(nextState).toEqual(state);
            });

            it('no files in post metadata', () => {
                const state = deepFreeze({});
                const action = {
                    type: actionType,
                    data: {
                        id: 'post',
                        metadata: {
                            files: [],
                        },
                    },
                };

                const nextState = filesReducer(state, action);

                expect(nextState).toEqual(state);
            });

            it('should save files', () => {
                const state = deepFreeze({});
                const action = {
                    type: actionType,
                    data: {
                        id: 'post',
                        metadata: {
                            files: [{id: 'file1', post_id: 'post'}, {id: 'file2', post_id: 'post'}],
                        },
                    },
                };

                const nextState = filesReducer(state, action);

                expect(nextState).not.toEqual(state);
                expect(nextState).toEqual({
                    file1: {id: 'file1', post_id: 'post'},
                    file2: {id: 'file2', post_id: 'post'},
                });
            });

            it('should save files for permalinks', () => {
                const state = deepFreeze({});
                const action = {
                    type: actionType,
                    data: {
                        id: 'post',
                        metadata: {
                            embeds: [{
                                type: 'permalink',
                                data: {
                                    post: {
                                        id: 'post-2',
                                        metadata: {
                                            files: [{id: 'file1', post_id: 'post'}, {id: 'file2', post_id: 'post'}],
                                        },
                                    },
                                },
                            }],
                        },
                    },
                };

                const nextState = filesReducer(state, action);

                expect(nextState).not.toEqual(state);
                expect(nextState).toEqual({
                    file1: {id: 'file1', post_id: 'post'},
                    file2: {id: 'file2', post_id: 'post'},
                });
            });
        };

        describe('RECEIVED_NEW_POST', testForSinglePost(PostTypes.RECEIVED_NEW_POST));
        describe('RECEIVED_POST', testForSinglePost(PostTypes.RECEIVED_POST));

        describe('RECEIVED_POSTS', () => {
            it('no post metadata', () => {
                const state = deepFreeze({});
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post: {
                                id: 'post',
                            },
                        },
                    },
                };

                const nextState = filesReducer(state, action);

                expect(nextState).toEqual(state);
            });

            it('no files in post metadata', () => {
                const state = deepFreeze({});
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post: {
                                id: 'post',
                                metadata: {},
                            },
                        },
                    },
                };

                const nextState = filesReducer(state, action);

                expect(nextState).toEqual(state);
            });

            it('should save files', () => {
                const state = deepFreeze({});
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post: {
                                id: 'post',
                                metadata: {
                                    files: [{id: 'file1', post_id: 'post'}, {id: 'file2', post_id: 'post'}],
                                },
                            },
                        },
                    },
                };

                const nextState = filesReducer(state, action);

                expect(nextState).not.toEqual(state);
                expect(nextState).toEqual({
                    file1: {id: 'file1', post_id: 'post'},
                    file2: {id: 'file2', post_id: 'post'},
                });
            });

            it('should save files for multiple posts', () => {
                const state = deepFreeze({});
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post1: {
                                id: 'post1',
                                metadata: {
                                    files: [{id: 'file1', post_id: 'post1'}, {id: 'file2', post_id: 'post1'}],
                                },
                            },
                            post2: {
                                id: 'post2',
                                metadata: {
                                    files: [{id: 'file3', post_id: 'post2'}, {id: 'file4', post_id: 'post2'}],
                                },
                            },
                        },
                    },
                };

                const nextState = filesReducer(state, action);

                expect(nextState).not.toEqual(state);
                expect(nextState).toEqual({
                    file1: {id: 'file1', post_id: 'post1'},
                    file2: {id: 'file2', post_id: 'post1'},
                    file3: {id: 'file3', post_id: 'post2'},
                    file4: {id: 'file4', post_id: 'post2'},
                });
            });

            it('should save files for permalinks', () => {
                const state = deepFreeze({});
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post1: {
                                id: 'post',
                                metadata: {
                                    embeds: [{
                                        type: 'permalink',
                                        data: {
                                            post: {
                                                id: 'post-1-embed',
                                                metadata: {
                                                    files: [{id: 'file1', post_id: 'post'}, {id: 'file2', post_id: 'post'}],
                                                },
                                            },
                                        },
                                    }],
                                },
                            },
                            post2: {
                                id: 'post',
                                metadata: {
                                    embeds: [{
                                        type: 'permalink',
                                        data: {
                                            post: {
                                                id: 'post-2-embed',
                                                metadata: {
                                                    files: [{id: 'file3', post_id: 'post'}, {id: 'file4', post_id: 'post'}],
                                                },
                                            },
                                        },
                                    }],
                                },
                            },
                        },
                    },
                };

                const nextState = filesReducer(state, action);

                expect(nextState).not.toEqual(state);
                expect(nextState).toEqual({
                    file1: {id: 'file1', post_id: 'post'},
                    file2: {id: 'file2', post_id: 'post'},
                    file3: {id: 'file3', post_id: 'post'},
                    file4: {id: 'file4', post_id: 'post'},
                });
            });
        });
    });

    describe('filesFromSearch', () => {
        const state = deepFreeze({});
        const action = {
            type: 'RECEIVED_FILES_FOR_SEARCH',
            data: {
                file1: {id: 'file1', post_id: 'post'},
                file2: {id: 'file2', post_id: 'post'},
            },
        };
        const nextState = filesFromSearchReducer(state, action);
        expect(nextState).toEqual({
            file1: {id: 'file1', post_id: 'post'},
            file2: {id: 'file2', post_id: 'post'},
        });
    });

    describe('fileIdsByPostId', () => {
        const testForSinglePost = (actionType: string) => () => {
            describe('no post metadata', () => {
                const action = {
                    type: actionType,
                    data: {
                        id: 'post',
                    },
                };

                it('no previous state', () => {
                    const state = deepFreeze({});
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).toEqual(state);
                });

                it('with previous state', () => {
                    const state = deepFreeze({
                        post: ['file1'],
                    });
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).toEqual(state);
                });
            });

            describe('no files property in post metadata', () => {
                const action = {
                    type: actionType,
                    data: {
                        id: 'post',
                        metadata: {},
                    },
                };

                it('no previous state', () => {
                    const state = deepFreeze({});
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).toEqual(state);
                });

                it('with previous state', () => {
                    const state = deepFreeze({
                        post: ['file1'],
                    });
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).toEqual(state);
                });
            });

            describe('empty files property in post metadata', () => {
                const action = {
                    type: actionType,
                    data: {
                        id: 'post',
                        metadata: {
                            files: [],
                        },
                    },
                };

                it('no previous state', () => {
                    const state = deepFreeze({});
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).not.toEqual(state);
                    expect(nextState).toEqual({
                        post: [],
                    });
                });

                it('with previous state', () => {
                    const state = deepFreeze({
                        post: ['file1'],
                    });
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).not.toEqual(state);
                    expect(nextState).toEqual({
                        post: [],
                    });
                });
            });

            describe('new files', () => {
                const action = {
                    type: actionType,
                    data: {
                        id: 'post',
                        metadata: {
                            files: [{id: 'file1', post_id: 'post'}, {id: 'file2', post_id: 'post'}],
                        },
                    },
                };

                it('no previous state', () => {
                    const state = deepFreeze({});
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).not.toEqual(state);
                    expect(nextState).toEqual({
                        post: ['file1', 'file2'],
                    });
                });

                it('with previous state', () => {
                    const state = deepFreeze({
                        post: ['fileOld'],
                    });
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).not.toEqual(state);
                    expect(nextState).toEqual({
                        post: ['file1', 'file2'],
                    });
                });
            });

            describe('new files in permalink', () => {
                const action = {
                    type: actionType,
                    data: {
                        id: 'post1',
                        metadata: {
                            embeds: [{
                                type: 'permalink',
                                data: {
                                    post: {
                                        id: 'post',
                                        metadata: {
                                            files: [{id: 'file1', post_id: 'post'}, {id: 'file2', post_id: 'post'}],
                                        },
                                    },
                                },
                            }],
                        },
                    },
                };

                it('no previous state', () => {
                    const state = deepFreeze({});
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).not.toEqual(state);
                    expect(nextState).toEqual({
                        post: ['file1', 'file2'],
                    });
                });

                it('with previous state', () => {
                    const state = deepFreeze({
                        post: ['fileOld'],
                    });
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).not.toEqual(state);
                    expect(nextState).toEqual({
                        post: ['file1', 'file2'],
                    });
                });
            });
        };

        describe('RECEIVED_NEW_POST', testForSinglePost(PostTypes.RECEIVED_NEW_POST));
        describe('RECEIVED_POST', testForSinglePost(PostTypes.RECEIVED_POST));

        describe('RECEIVED_POSTS', () => {
            describe('no post metadata', () => {
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post: {
                                id: 'post',
                            },
                        },
                    },
                };

                it('no previous state', () => {
                    const state = deepFreeze({});
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).toEqual(state);
                });

                it('with previous state', () => {
                    const state = deepFreeze({
                        post: ['file1'],
                    });
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).toEqual(state);
                });
            });

            describe('no files property in post metadata', () => {
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post: {
                                id: 'post',
                                metadata: {},
                            },
                        },
                    },
                };

                it('no previous state', () => {
                    const state = deepFreeze({});
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).toEqual(state);
                });

                it('with previous state', () => {
                    const state = deepFreeze({
                        post: ['file1'],
                    });
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).toEqual(state);
                });
            });

            describe('empty files property in post metadata', () => {
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post: {
                                id: 'post',
                                metadata: {
                                    files: [],
                                },
                            },
                        },
                    },
                };

                it('no previous state', () => {
                    const state = deepFreeze({});
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).not.toEqual(state);
                    expect(nextState).toEqual({
                        post: [],
                    });
                });

                it('with previous state', () => {
                    const state = deepFreeze({
                        post: ['file1'],
                    });
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).not.toEqual(state);
                    expect(nextState).toEqual({
                        post: [],
                    });
                });
            });

            describe('new files for single post', () => {
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post: {
                                id: 'post',
                                metadata: {
                                    files: [{id: 'file1', post_id: 'post'}, {id: 'file2', post_id: 'post'}],
                                },
                            },
                        },
                    },
                };

                it('no previous state', () => {
                    const state = deepFreeze({});
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).not.toEqual(state);
                    expect(nextState).toEqual({
                        post: ['file1', 'file2'],
                    });
                });

                it('with previous state', () => {
                    const state = deepFreeze({
                        post: ['fileOld'],
                    });
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).not.toEqual(state);
                    expect(nextState).toEqual({
                        post: ['file1', 'file2'],
                    });
                });
            });

            describe('new files for single post in permalink', () => {
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post1: {
                                id: 'post1',
                                metadata: {
                                    embeds: [{
                                        type: 'permalink',
                                        data: {
                                            post: {
                                                id: 'post',
                                                metadata: {
                                                    files: [{id: 'file1', post_id: 'post'}, {id: 'file2', post_id: 'post'}],
                                                },
                                            },
                                        },
                                    }],
                                },
                            },
                        },

                    },
                };

                it('no previous state', () => {
                    const state = deepFreeze({});
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).not.toEqual(state);
                    expect(nextState).toEqual({
                        post: ['file1', 'file2'],
                    });
                });

                it('with previous state', () => {
                    const state = deepFreeze({
                        post: ['fileOld'],
                    });
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).not.toEqual(state);
                    expect(nextState).toEqual({
                        post: ['file1', 'file2'],
                    });
                });
            });

            describe('should save files for multiple posts', () => {
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post1: {
                                id: 'post1',
                                metadata: {
                                    files: [{id: 'file1', post_id: 'post1'}, {id: 'file2', post_id: 'post1'}],
                                },
                            },
                            post2: {
                                id: 'post2',
                                metadata: {
                                    files: [{id: 'file3', post_id: 'post2'}, {id: 'file4', post_id: 'post2'}],
                                },
                            },
                        },
                    },
                };

                it('no previous state for post1', () => {
                    const state = deepFreeze({
                        post2: ['fileOld2'],
                    });
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).not.toEqual(state);
                    expect(nextState).toEqual({
                        post1: ['file1', 'file2'],
                        post2: ['file3', 'file4'],
                    });
                });

                it('previous state for post1', () => {
                    const state = deepFreeze({
                        post1: ['fileOld1'],
                        post2: ['fileOld2'],
                    });
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).not.toEqual(state);
                    expect(nextState).toEqual({
                        post1: ['file1', 'file2'],
                        post2: ['file3', 'file4'],
                    });
                });
            });

            describe('should save files for multiple posts with permalinks', () => {
                const action = {
                    type: PostTypes.RECEIVED_POSTS,
                    data: {
                        posts: {
                            post3: {
                                id: 'post',
                                metadata: {
                                    embeds: [{
                                        type: 'permalink',
                                        data: {
                                            post: {
                                                id: 'post1',
                                                metadata: {
                                                    files: [{id: 'file1', post_id: 'post1'}, {id: 'file2', post_id: 'post1'}],
                                                },
                                            },
                                        },
                                    }],
                                },
                            },
                            post4: {
                                id: 'post',
                                metadata: {
                                    embeds: [{
                                        type: 'permalink',
                                        data: {
                                            post: {
                                                id: 'post2',
                                                metadata: {
                                                    files: [{id: 'file3', post_id: 'post2'}, {id: 'file4', post_id: 'post2'}],
                                                },
                                            },
                                        },
                                    }],
                                },
                            },
                        },
                    },
                };

                it('no previous state for post1', () => {
                    const state = deepFreeze({
                        post2: ['fileOld2'],
                    });
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).not.toEqual(state);
                    expect(nextState).toEqual({
                        post1: ['file1', 'file2'],
                        post2: ['file3', 'file4'],
                    });
                });

                it('previous state for post1', () => {
                    const state = deepFreeze({
                        post1: ['fileOld1'],
                        post2: ['fileOld2'],
                    });
                    const nextState = fileIdsByPostIdReducer(state, action);

                    expect(nextState).not.toEqual(state);
                    expect(nextState).toEqual({
                        post1: ['file1', 'file2'],
                        post2: ['file3', 'file4'],
                    });
                });
            });
        });
    });
});
