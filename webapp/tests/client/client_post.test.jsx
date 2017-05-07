// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TestHelper from 'tests/helpers/client-test-helper.jsx';

describe('Client.Posts', function() {
    test('createPost', function(done) {
        TestHelper.initBasic(done, () => {
            var post = TestHelper.fakePost();
            post.channel_id = TestHelper.basicChannel().id;

            TestHelper.basicClient().createPost(
                post,
                function(data) {
                    expect(data.id.length).toBeGreaterThan(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getPostById', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getPostById(
                TestHelper.basicPost().id,
                function(data) {
                    expect(data.order[0]).toEqual(TestHelper.basicPost().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getPost', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getPost(
                TestHelper.basicChannel().id,
                TestHelper.basicPost().id,
                function(data) {
                    expect(data.order[0]).toEqual(TestHelper.basicPost().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('updatePost', function(done) {
        TestHelper.initBasic(done, () => {
            var post = TestHelper.basicPost();
            post.message = 'new message';
            post.channel_id = TestHelper.basicChannel().id;

            TestHelper.basicClient().updatePost(
                post,
                function(data) {
                    expect(data.id.length).toBeGreaterThan(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('deletePost', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().deletePost(
                TestHelper.basicChannel().id,
                TestHelper.basicPost().id,
                function(data) {
                    expect(data.id).toEqual(TestHelper.basicPost().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('searchPost', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().search(
                'unit test',
                false,
                function(data) {
                    expect(data.order[0]).toEqual(TestHelper.basicPost().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getPostsPage', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getPostsPage(
                TestHelper.basicChannel().id,
                0,
                10,
                function(data) {
                    expect(data.order[0]).toEqual(TestHelper.basicPost().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getPosts', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getPosts(
                TestHelper.basicChannel().id,
                0,
                function(data) {
                    expect(data.order[0]).toEqual(TestHelper.basicPost().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getPostsBefore', function(done) {
        TestHelper.initBasic(done, () => {
            var post = TestHelper.fakePost();
            post.channel_id = TestHelper.basicChannel().id;

            TestHelper.basicClient().createPost(
                post,
                function(rpost) {
                    TestHelper.basicClient().getPostsBefore(
                        TestHelper.basicChannel().id,
                        rpost.id,
                        0,
                        10,
                        function(data) {
                            expect(data.order[0]).toEqual(TestHelper.basicPost().id);
                            done();
                        },
                        function(err) {
                            done.fail(new Error(err.message));
                        }
                    );
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getPostsAfter', function(done) {
        TestHelper.initBasic(done, () => {
            var post = TestHelper.fakePost();
            post.channel_id = TestHelper.basicChannel().id;

            TestHelper.basicClient().createPost(
                post,
                function(rpost) {
                    TestHelper.basicClient().getPostsAfter(
                        TestHelper.basicChannel().id,
                        TestHelper.basicPost().id,
                        0,
                        10,
                        function(data) {
                            expect(data.order[0]).toEqual(rpost.id);
                            done();
                        },
                        function(err) {
                            done.fail(new Error(err.message));
                        }
                    );
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getFlaggedPosts', function(done) {
        TestHelper.initBasic(done, () => {
            var pref = {};
            pref.user_id = TestHelper.basicUser().id;
            pref.category = 'flagged_post';
            pref.name = TestHelper.basicPost().id;
            pref.value = 'true';

            var prefs = [];
            prefs.push(pref);

            TestHelper.basicClient().savePreferences(
                prefs,
                function() {
                    TestHelper.basicClient().getFlaggedPosts(
                        0,
                        2,
                        function(data) {
                            expect(data.order[0]).toEqual(TestHelper.basicPost().id);
                            done();
                        },
                        function(err) {
                            done.fail(new Error(err.message));
                        }
                    );
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    // getFileInfosForPost is tested in client_files.test.jsx
});

