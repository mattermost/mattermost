// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import assert from 'assert';
import TestHelper from './test_helper.jsx';

describe('Client.Channels', function() {
    this.timeout(100000);

    it('createChannel', function(done) {
        TestHelper.initBasic(() => {
            var channel = TestHelper.fakeChannel();
            channel.team_id = TestHelper.basicTeam().id;
            TestHelper.basicClient().createChannel(
                channel,
                function(data) {
                    assert.equal(data.id.length > 0, true);
                    assert.equal(data.name, channel.name);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    /* TODO: FIX THIS TEST
    it('createDirectChannel', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().createUser(
                TestHelper.fakeUser(),
                function(user2) {
                    TestHelper.basicClient().addUserToTeam(
                        user2.id,
                        function() {
                            TestHelper.basicClient().createDirectChannel(
                                user2.id,
                                function(data) {
                                    assert.equal(data.id.length > 0, true);
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
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });
    */

    it('updateChannel', function(done) {
        TestHelper.initBasic(() => {
            var channel = TestHelper.basicChannel();
            channel.display_name = 'changed';
            TestHelper.basicClient().updateChannel(
                channel,
                function(data) {
                    assert.equal(data.id.length > 0, true);
                    assert.equal(data.display_name, 'changed');
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('updateChannelHeader', function(done) {
        TestHelper.initBasic(() => {
            var channel = TestHelper.basicChannel();
            channel.display_name = 'changed';
            TestHelper.basicClient().updateChannelHeader(
                channel.id,
                'new header',
                function(data) {
                    assert.equal(data.id.length > 0, true);
                    assert.equal(data.header, 'new header');
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('updateChannelPurpose', function(done) {
        TestHelper.initBasic(() => {
            var channel = TestHelper.basicChannel();
            channel.display_name = 'changed';
            TestHelper.basicClient().updateChannelPurpose(
                channel.id,
                'new purpose',
                function(data) {
                    assert.equal(data.id.length > 0, true);
                    assert.equal(data.purpose, 'new purpose');
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('updateChannelNotifyProps', function(done) {
        TestHelper.initBasic(() => {
            var props = {};
            props.channel_id = TestHelper.basicChannel().id;
            props.user_id = TestHelper.basicUser().id;
            props.desktop = 'all';
            TestHelper.basicClient().updateChannelNotifyProps(
                props,
                function(data) {
                    assert.equal(data.desktop, 'all');
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('leaveChannel', function(done) {
        TestHelper.initBasic(() => {
            var channel = TestHelper.basicChannel();
            TestHelper.basicClient().leaveChannel(
                channel.id,
                function(data) {
                    assert.equal(data.id, channel.id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('joinChannel', function(done) {
        TestHelper.initBasic(() => {
            var channel = TestHelper.basicChannel();
            TestHelper.basicClient().leaveChannel(
                channel.id,
                function() {
                    TestHelper.basicClient().joinChannel(
                        channel.id,
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

    it('joinChannelByName', function(done) {
        TestHelper.initBasic(() => {
            var channel = TestHelper.basicChannel();
            TestHelper.basicClient().leaveChannel(
                channel.id,
                function() {
                    TestHelper.basicClient().joinChannelByName(
                        channel.name,
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

    it('deleteChannel', function(done) {
        TestHelper.initBasic(() => {
            var channel = TestHelper.basicChannel();
            TestHelper.basicClient().deleteChannel(
                channel.id,
                function(data) {
                    assert.equal(data.id, channel.id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('updateLastViewedAt', function(done) {
        TestHelper.initBasic(() => {
            var channel = TestHelper.basicChannel();
            TestHelper.basicClient().updateLastViewedAt(
                channel.id,
                function(data) {
                    assert.equal(data.id, channel.id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getChannels', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getChannels(
                function(data) {
                    assert.equal(data.channels.length, 3);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getChannel', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getChannel(
                TestHelper.basicChannel().id,
                function(data) {
                    assert.equal(TestHelper.basicChannel().id, data.channel.id);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getMoreChannels', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getMoreChannels(
                function(data) {
                    assert.equal(data.channels.length, 0);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getChannelCounts', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getChannelCounts(
                function(data) {
                    assert.equal(data.counts[TestHelper.basicChannel().id], 1);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    it('getChannelExtraInfo', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().getChannelExtraInfo(
                TestHelper.basicChannel().id,
                5,
                function(data) {
                    assert.equal(data.member_count, 1);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });

    /* TODO FIX THIS TEST
    it('addChannelMember', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().createUser(
                TestHelper.fakeUser(),
                function(user2) {
                    TestHelper.basicClient().addUserToTeam(
                        user2.id,
                        function() {
                            TestHelper.basicClient().addChannelMember(
                                TestHelper.basicChannel().id,
                                user2.id,
                                function(data) {
                                    assert.equal(data.channel_id.length > 0, true);
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
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });
    */

    it('removeChannelMember', function(done) {
        TestHelper.initBasic(() => {
            TestHelper.basicClient().removeChannelMember(
                TestHelper.basicChannel().id,
                TestHelper.basicUser().id,
                function(data) {
                    assert.equal(data.channel_id.length > 0, true);
                    done();
                },
                function(err) {
                    done(new Error(err.message));
                }
            );
        });
    });
});

