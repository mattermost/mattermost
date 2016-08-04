// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import assert from 'assert';
import TestHelper from './test_helper.jsx';

describe('Client.Posts', function() {
    this.timeout(100000);

    it('createPost', function(done) {
        TestHelper.initBasic(() => {
            var post = TestHelper.fakePost();
            post.channel_id = TestHelper.basicChannel().id;

            TestHelper.basicClient().createPost(
                post,
                function(data) {
                    assert.equal(data.id.length > 0, true);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getPostById', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getPostById(
                TestHelper.basicPost().id,
                function(data) {
                    assert.equal(data.order[0], TestHelper.basicPost().id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getPost', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getPost(
                TestHelper.basicChannel().id,
                TestHelper.basicPost().id,
                function(data) {
                    assert.equal(data.order[0], TestHelper.basicPost().id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('updatePost', function(done) {
        TestHelper.initBasic(() => {
            var post = TestHelper.basicPost();
            post.message = 'new message';
            post.channel_id = TestHelper.basicChannel().id;

            TestHelper.basicClient().updatePost(
                post,
                function(data) {
                    assert.equal(data.id.length > 0, true);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('deletePost', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().deletePost(
                TestHelper.basicChannel().id,
                TestHelper.basicPost().id,
                function(data) {
                    assert.equal(data.id, TestHelper.basicPost().id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('searchPost', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().search(
                'unit test',
                false,
                function(data) {
                    assert.equal(data.order[0], TestHelper.basicPost().id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getPostsPage', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getPostsPage(
                TestHelper.basicChannel().id,
                0,
                10,
                function(data) {
                    assert.equal(data.order[0], TestHelper.basicPost().id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getPosts', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getPosts(
                TestHelper.basicChannel().id,
                0,
                function(data) {
                    assert.equal(data.order[0], TestHelper.basicPost().id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getPostsBefore', function(done) {
        TestHelper.initBasic(() => {
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
                            assert.equal(data.order[0], TestHelper.basicPost().id);
                            done();
                        },
                        function(err) {
                            done(new Error(err.message));
                        }
                    );
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getPostsAfter', function(done) {
        TestHelper.initBasic(() => {
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
                            assert.equal(data.order[0], rpost.id);
                            done();
                        },
                        function(err) {
                            done(new Error(err.message));
                        }
                    );
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getFlaggedPosts', function(done) {
        TestHelper.initBasic(() => {
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
                            assert.equal(data.order[0], TestHelper.basicPost().id);
                            done();
                        },
                        function(err) {
                            done(new Error(err.message));
                        }
                    );
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });
});

