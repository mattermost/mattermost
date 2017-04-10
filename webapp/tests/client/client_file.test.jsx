// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TestHelper from 'tests/helpers/client-test-helper.jsx';

const fs = require('fs');

describe('Client.File', function() {
    const testGifFileName = 'testFile.gif';

    beforeAll(function() {
        // write a temporary file so that we have something to upload for testing
        const buffer = new Buffer('R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=', 'base64');

        const testGif = fs.openSync(testGifFileName, 'w+');
        fs.writeFileSync(testGif, buffer);
    });

    afterAll(function() {
        fs.unlinkSync(testGifFileName);
    });

    test('uploadFile', function(done) {
        TestHelper.initBasic(done, () => {
            const clientId = TestHelper.generateId();

            TestHelper.basicClient().uploadFile(
                fs.createReadStream(testGifFileName),
                testGifFileName,
                TestHelper.basicChannel().id,
                clientId,
                function(resp) {
                    expect(resp.file_infos.length).toBe(1);
                    expect(resp.client_ids.length).toBe(1);
                    expect(resp.client_ids[0]).toEqual(clientId);

                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getFile', function(done) {
        TestHelper.initBasic(done, () => {
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
                            done.fail(new Error(err2.message));
                        }
                    );
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getFileThumbnail', function(done) {
        TestHelper.initBasic(done, () => {
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

    test('getFilePreview', function(done) {
        TestHelper.initBasic(done, () => {
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
                            done.fail(new Error(err2.message));
                        }
                    );
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getFileInfo', function(done) {
        TestHelper.initBasic(done, () => {
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
                            expect(info.id).toEqual(fileId);
                            expect(info.name).toEqual(testGifFileName);

                            done();
                        },
                        function(err2) {
                            done.fail(new Error(err2.message));
                        }
                    );
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getPublicLink', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().enableLogErrorsToConsole(false); // Disabling since this unit test causes an error
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
                            expect(data.file_ids).toEqual(post.file_ids);

                            TestHelper.basicClient().getPublicLink(
                                post.file_ids[0],
                                function() {
                                    done.fail(new Error('public links should be disabled by default'));

                                    // request.
                                    //     get(link).
                                    //     end(TestHelper.basicChannel().handleResponse.bind(
                                    //         this,
                                    //         'getPublicLink',
                                    //         function() {
                                    //             done();
                                    //         },
                                    //         function(err4) {
                                    //             done.fail(new Error(err4.message));
                                    //         }
                                    //     ));
                                },
                                function() {
                                    done();

                                    // done.fail(new Error(err3.message));
                                }
                            );
                        },
                        function(err2) {
                            done.fail(new Error(err2.message));
                        }
                    );
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getFileInfosForPost', function(done) {
        TestHelper.initBasic(done, () => {
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
                            expect(data.file_ids).toEqual(post.file_ids);

                            TestHelper.basicClient().getFileInfosForPost(
                                post.channel_id,
                                data.id,
                                function(files) {
                                    expect(files.length).toBe(1);
                                    expect(files[0].id).toEqual(resp.file_infos[0].id);

                                    done();
                                },
                                function(err3) {
                                    done.fail(new Error(err3.message));
                                }
                            );
                        },
                        function(err2) {
                            done.fail(new Error(err2.message));
                        }
                    );
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });
});
