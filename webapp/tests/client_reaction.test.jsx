// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TestHelper from './test_helper.jsx';

describe('Client.Reaction', function() {
    this.timeout(100000);

    it('saveListReaction', function(done) {
        TestHelper.initBasic(() => {
            const channelId = TestHelper.basicChannel().id;
            const postId = TestHelper.basicPost().id;

            const reaction = {
                post_id: postId,
                user_id: TestHelper.basicUser().id,
                emoji_name: 'upside_down_face'
            };

            TestHelper.basicClient().saveReaction(
                channelId,
                reaction,
                function() {
                    TestHelper.basicClient().listReactions(
                        channelId,
                        postId,
                        function(reactions) {
                            if (reactions.length === 1 &&
                                reactions[0].post_id === reaction.post_id &&
                                reactions[0].user_id === reaction.user_id &&
                                reactions[0].emoji_name === reaction.emoji_name) {
                                done();
                            } else {
                                done(new Error('test reaction wasn\'t returned'));
                            }
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

    it('deleteReaction', function(done) {
        TestHelper.initBasic(() => {
            const channelId = TestHelper.basicChannel().id;
            const postId = TestHelper.basicPost().id;

            const reaction = {
                post_id: postId,
                user_id: TestHelper.basicUser().id,
                emoji_name: 'upside_down_face'
            };

            TestHelper.basicClient().saveReaction(
                channelId,
                reaction,
                function() {
                    TestHelper.basicClient().deleteReaction(
                        channelId,
                        reaction,
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
});
