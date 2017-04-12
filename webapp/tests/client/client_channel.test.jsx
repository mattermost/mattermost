// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import TestHelper from 'tests/helpers/client-test-helper.jsx';

describe('Client.Channels', function() {
    test('createChannel', function(done) {
        TestHelper.initBasic(done, () => {
            var channel = TestHelper.fakeChannel();
            channel.team_id = TestHelper.basicTeam().id;
            TestHelper.basicClient().createChannel(
                channel,
                function(data) {
                    expect(data.id.length).toBeGreaterThan(0);
                    expect(data.name).toBe(channel.name);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('createDirectChannel', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().createUser(
                TestHelper.fakeUser(),
                function(user2) {
                    TestHelper.basicClient().createDirectChannel(
                        user2.id,
                        function(data) {
                            expect(data.id.length).toBeGreaterThan(0);
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

    test('createGroupChannel', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().createUser(
                TestHelper.fakeUser(),
                (user1) => {
                    TestHelper.basicClient().createUser(
                        TestHelper.fakeUser(),
                        function(user2) {
                            TestHelper.basicClient().createGroupChannel(
                                [user2.id, user1.id],
                                function(data) {
                                    expect(data.id.length).toBeGreaterThan(0);
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
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('updateChannel', function(done) {
        TestHelper.initBasic(done, () => {
            var channel = TestHelper.basicChannel();
            channel.display_name = 'changed';
            TestHelper.basicClient().updateChannel(
                channel,
                function(data) {
                    expect(data.id.length).toBeGreaterThan(0);
                    expect(data.display_name).toEqual('changed');
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('updateChannelHeader', function(done) {
        TestHelper.initBasic(done, () => {
            var channel = TestHelper.basicChannel();
            channel.display_name = 'changed';
            TestHelper.basicClient().updateChannelHeader(
                channel.id,
                'new header',
                function(data) {
                    expect(data.id.length).toBeGreaterThan(0);
                    expect(data.header).toBe('new header');
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('updateChannelPurpose', function(done) {
        TestHelper.initBasic(done, () => {
            var channel = TestHelper.basicChannel();
            channel.display_name = 'changed';
            TestHelper.basicClient().updateChannelPurpose(
                channel.id,
                'new purpose',
                function(data) {
                    expect(data.id.length).toBeGreaterThan(0);
                    expect(data.purpose).toEqual('new purpose');
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('updateChannelNotifyProps', function(done) {
        TestHelper.initBasic(done, () => {
            var props = {};
            props.channel_id = TestHelper.basicChannel().id;
            props.user_id = TestHelper.basicUser().id;
            props.desktop = 'all';
            TestHelper.basicClient().updateChannelNotifyProps(
                props,
                function(data) {
                    expect(data.desktop).toEqual('all');
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('leaveChannel', function(done) {
        TestHelper.initBasic(done, () => {
            var channel = TestHelper.basicChannel();
            TestHelper.basicClient().leaveChannel(
                channel.id,
                function(data) {
                    expect(data.id).toEqual(channel.id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('joinChannel', function(done) {
        TestHelper.initBasic(done, () => {
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

    test('joinChannelByName', function(done) {
        TestHelper.initBasic(done, () => {
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

    test('deleteChannel', function(done) {
        TestHelper.initBasic(done, () => {
            var channel = TestHelper.basicChannel();
            TestHelper.basicClient().deleteChannel(
                channel.id,
                function(data) {
                    expect(data.id).toEqual(channel.id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('viewChannel', function(done) {
        TestHelper.initBasic(done, () => {
            var channel = TestHelper.basicChannel();
            TestHelper.basicClient().viewChannel(
                channel.id,
                '',
                0,
                function() {
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getChannels', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getChannels(
                function(data) {
                    expect(data.length).toBe(3);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getChannel', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getChannel(
                TestHelper.basicChannel().id,
                function(data) {
                    expect(TestHelper.basicChannel().id).toEqual(data.channel.id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getMoreChannelsPage', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getMoreChannelsPage(
                0,
                100,
                function(data) {
                    expect(data.length).toBe(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('searchMoreChannels', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().searchMoreChannels(
                'blargh',
                function(data) {
                    expect(data.length).toBe(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('autocompleteChannels', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().autocompleteChannels(
                TestHelper.basicChannel().name,
                function(data) {
                    expect(data).not.toBeNull();
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getChannelCounts', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getChannelCounts(
                function(data) {
                    expect(data.counts[TestHelper.basicChannel().id]).toBe(1);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getMyChannelMembers', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getMyChannelMembers(
                function(data) {
                    expect(data.length).toBeGreaterThan(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getMyChannelMembersForTeam', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getMyChannelMembersForTeam(
                TestHelper.basicTeam().id,
                function(data) {
                    expect(data.length).toBeGreaterThan(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getChannelStats', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getChannelStats(
                TestHelper.basicChannel().id,
                function(data) {
                    expect(data.member_count).toBe(1);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getChannelMember', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getChannelMember(
                TestHelper.basicChannel().id,
                TestHelper.basicUser().id,
                function(data) {
                    expect(data.channel_id).toEqual(TestHelper.basicChannel().id);
                    expect(data.user_id).toEqual(TestHelper.basicUser().id);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('addChannelMember', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().createUserWithInvite(
                TestHelper.fakeUser(),
                null,
                null,
                TestHelper.basicTeam().invite_id,
                function(user2) {
                    TestHelper.basicClient().addChannelMember(
                        TestHelper.basicChannel().id,
                        user2.id,
                        function(data) {
                            expect(data.channel_id.length).toBeGreaterThan(0);
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

    test('removeChannelMember', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().removeChannelMember(
                TestHelper.basicChannel().id,
                TestHelper.basicUser().id,
                function(data) {
                    expect(data.channel_id.length).toBeGreaterThan(0);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });

    test('getChannelByName', function(done) {
        TestHelper.initBasic(done, () => {
            TestHelper.basicClient().getChannelByName(
                TestHelper.basicChannel().name,
                function(data) {
                    expect(data.name).toEqual(TestHelper.basicChannel().name);
                    done();
                },
                function(err) {
                    done.fail(new Error(err.message));
                }
            );
        });
    });
});

