// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import assert from 'assert';
import TestHelper from './test_helper.jsx';

const fs = require('fs');

describe('Client.File', function() {
    this.timeout(100000);

    const testGifFileName = 'testFile.gif';

    before(function() {
        // write a temporary file so that we have something to upload for testing
        const buffer = new Buffer('R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=', 'base64');

        const testGif = fs.openSync(testGifFileName, 'w+');
        fs.writeFileSync(testGif, buffer);
    });

    after(function() {
        fs.unlinkSync(testGifFileName);
    });

    it('uploadFile', function(done) {
        TestHelper.initBasic(() => {
            const clientId = TestHelper.generateId();

            TestHelper.basicClient().uploadFile(
                fs.createReadStream(testGifFileName),
                testGifFileName,
                TestHelper.basicChannel().id,
                clientId,
                function(resp) {
                    assert.equal(resp.file_infos.length, 1);
                    assert.equal(resp.client_ids.length, 1);
                    assert.equal(resp.client_ids[0], clientId);

                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getFile', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().uploadFile(
                fs.createReadStream(testGifFileName),
                testGifFileName,
                TestHelper.basicChannel().id,
                '',
                function(resp) {
                    TestHelper.basicClient().getFile(
                        resp.file_infos[0].id,
                        function() {
                            done();
                        },
                        function(err2) {
                            done(new Error(err2.message));
                        }
                    );
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getFileThumbnail', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().uploadFile(
                fs.createReadStream(testGifFileName),
                testGifFileName,
                TestHelper.basicChannel().id,
                '',
                function(resp) {
                    TestHelper.basicClient().getFileThumbnail(
                        resp.file_infos[0].id,
                        function() {
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

    it('getFilePreview', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().uploadFile(
                fs.createReadStream(testGifFileName),
                testGifFileName,
                TestHelper.basicChannel().id,
                '',
                function(resp) {
                    TestHelper.basicClient().getFilePreview(
                        resp.file_infos[0].id,
                        function() {
                            done();
                        },
                        function(err2) {
                            done(new Error(err2.message));
                        }
                    );
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getFileInfo', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().uploadFile(
                fs.createReadStream(testGifFileName),
                testGifFileName,
                TestHelper.basicChannel().id,
                '',
                function(resp) {
                    const fileId = resp.file_infos[0].id;

                    TestHelper.basicClient().getFileInfo(
                        fileId,
                        function(info) {
                            assert.equal(info.id, fileId);
                            assert.equal(info.name, testGifFileName);

                            done();
                        },
                        function(err2) {
                            done(new Error(err2.message));
                        }
                    );
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getPublicLink', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().uploadFile(
                fs.createReadStream(testGifFileName),
                testGifFileName,
                TestHelper.basicChannel().id,
                '',
                function(resp) {
                    const post = TestHelper.fakePost();
                    post.channel_id = TestHelper.basicChannel().id;
                    post.file_ids = resp.file_infos.map((info) => info.id);

                    TestHelper.basicClient().createPost(
                        post,
                        function(data) {
                            assert.deepEqual(data.file_ids, post.file_ids);

                            TestHelper.basicClient().getPublicLink(
                                post.file_ids[0],
                                function() {
                                    done(new Error('public links should be disabled by default'));

                                    // request.
                                    //     get(link).
                                    //     end(TestHelper.basicChannel().handleResponse.bind(
                                    //         this,
                                    //         'getPublicLink',
                                    //         function() {
                                    //             done();
                                    //         },
                                    //         function(err4) {
                                    //             done(new Error(err4.message));
                                    //         }
                                    //     ));
                                },
                                function() {
                                    done();

                                    // done(new Error(err3.message));
                                }
                            );
                        },
                        function(err2) {
                            done(new Error(err2.message));
                        }
                    );
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getFileInfosForPost', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().uploadFile(
                fs.createReadStream(testGifFileName),
                testGifFileName,
                TestHelper.basicChannel().id,
                '',
                function(resp) {
                    const post = TestHelper.fakePost();
                    post.channel_id = TestHelper.basicChannel().id;
                    post.file_ids = resp.file_infos.map((info) => info.id);

                    TestHelper.basicClient().createPost(
                        post,
                        function(data) {
                            assert.deepEqual(data.file_ids, post.file_ids);

                            TestHelper.basicClient().getFileInfosForPost(
                                post.channel_id,
                                data.id,
                                function(files) {
                                    assert.equal(files.length, 1);
                                    assert.equal(files[0].id, resp.file_infos[0].id);

                                    done();
                                },
                                function(err3) {
                                    done(new Error(err3.message));
                                }
                            );
                        },
                        function(err2) {
                            done(new Error(err2.message));
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
