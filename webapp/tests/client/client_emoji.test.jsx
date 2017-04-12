// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TestHelper from 'tests/helpers/client-test-helper.jsx';

const fs = require('fs');

describe('Client.Emoji', function() {
    const testGifFileName = 'testEmoji.gif';

    beforeAll(function() {
        // write a temporary file so that we have something to upload for testing
        const buffer = new Buffer('R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=', 'base64');
        const testGif = fs.openSync(testGifFileName, 'w+');
        fs.writeFileSync(testGif, buffer);
    });

    afterAll(function() {
        fs.unlinkSync(testGifFileName);
    });

    test('addEmoji', function(done) {
        TestHelper.initBasic(done, () => {
            const name = TestHelper.generateId();

            TestHelper.basicClient().addEmoji(
                {creator_id: TestHelper.basicUser().id, name},
                fs.createReadStream(testGifFileName),
                function(data) {
                    expect(data.name).toEqual(name);
                    expect(data.id).not.toBeNull();

                    //TestHelper.basicClient().deleteEmoji(data.id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('deleteEmoji', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().addEmoji(
                {creator_id: TestHelper.basicUser().id, name: TestHelper.generateId()},
                fs.createReadStream(testGifFileName),
                function(data) {
                    TestHelper.basicClient().deleteEmoji(
                        data.id,
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

    test('listEmoji', function(done) {
        TestHelper.initBasic(done, () => {
            const name = TestHelper.generateId();
            TestHelper.basicClient().addEmoji(
                {creator_id: TestHelper.basicUser().id, name},
                fs.createReadStream(testGifFileName),
                function() {
                    TestHelper.basicClient().listEmoji(
                        function(data) {
                            expect(data.length).toBeGreaterThan(0);

                            let found = false;
                            for (const emoji of data) {
                                if (emoji.name === name) {
                                    found = true;
                                    break;
                                }
                            }

                            if (found) {
                                done();
                            } else {
                                done.fail(new Error('test emoji wasn\'t returned'));
                            }
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
});
