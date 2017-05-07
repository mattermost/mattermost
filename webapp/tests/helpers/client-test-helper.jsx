// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Client from 'client/client.jsx';
import WebSocketClient from 'client/websocket_client.jsx';
import jqd from 'jquery-deferred';

var HEADER_TOKEN = 'token';

class TestHelperClass {
    basicClient = () => {
        return this.basicc;
    }

    basicWebSocketClient = () => {
        return this.basicwsc;
    }

    basicTeam = () => {
        return this.basict;
    }

    basicUser = () => {
        return this.basicu;
    }

    basicChannel = () => {
        return this.basicch;
    }

    basicPost = () => {
        return this.basicp;
    }

    generateId = () => {
        // implementation taken from http://stackoverflow.com/a/2117523
        var id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

        id = id.replace(/[xy]/g, function replaceRandom(c) {
            var r = Math.floor(Math.random() * 16);

            var v;
            if (c === 'x') {
                v = r;
            } else {
                v = (r & 0x3) | 0x8;
            }

            return v.toString(16);
        });

        return 'uid' + id;
    }

    createClient() {
        var c = new Client();
        c.setUrl('http://localhost:8065');
        c.useHeaderToken();
        c.enableLogErrorsToConsole(true);
        return c;
    }

    createWebSocketClient(token) {
        var ws = new WebSocketClient();
        ws.initialize('http://localhost:8065/api/v3/users/websocket', token);
        return ws;
    }

    fakeEmail = () => {
        return 'success' + this.generateId() + '@simulator.amazonses.com';
    }

    fakeUser = () => {
        var user = {};
        user.email = this.fakeEmail();
        user.allow_marketing = true;
        user.password = 'password1';
        user.username = this.generateId();
        return user;
    }

    fakeTeam = () => {
        var team = {};
        team.name = this.generateId();
        team.display_name = `Unit Test ${team.name}`;
        team.type = 'O';
        team.email = this.fakeEmail();
        team.allowed_domains = '';
        return team;
    }

    fakeChannel = () => {
        var channel = {};
        channel.name = this.generateId();
        channel.display_name = `Unit Test ${channel.name}`;
        channel.type = 'O'; // open channel
        return channel;
    }

    fakePost = () => {
        var post = {};
        post.message = `Unit Test ${this.generateId()}`;
        return post;
    }

    initBasic = (done, callback, connectWS) => {
        this.basicc = this.createClient();

        function throwerror(err) {
            done.fail(new Error(err.message));
        }

        var d1 = jqd.Deferred();
        var email = this.fakeEmail();
        var user = this.fakeUser();
        var team = this.fakeTeam();
        team.email = email;
        user.email = email;
        var self = this;

        this.basicClient().createUser(
            user,
            function(ruser) {
                self.basicu = ruser;
                self.basicu.password = user.password;
                self.basicClient().login(
                    self.basicu.email,
                    self.basicu.password,
                    null,
                    function(data, res) {
                        if (connectWS) {
                            self.basicwsc = self.createWebSocketClient(res.header[HEADER_TOKEN]);
                        }
                        self.basicClient().useHeaderToken();
                        self.basicClient().createTeam(team,
                            function(rteam) {
                                self.basict = rteam;
                                self.basicClient().setTeamId(rteam.id);
                                var channel = self.fakeChannel();
                                channel.team_id = self.basicTeam().id;
                                self.basicClient().createChannel(
                                    channel,
                                    function(rchannel) {
                                        self.basicch = rchannel;
                                        var post = self.fakePost();
                                        post.channel_id = rchannel.id;

                                        self.basicClient().createPost(
                                            post,
                                            function(rpost) {
                                                self.basicp = rpost;
                                                d1.resolve();
                                            },
                                            throwerror
                                        );
                                    },
                                    throwerror
                                );
                            },
                            throwerror
                        );
                    },
                    throwerror
                );
            },
            throwerror
        );

        jqd.when(d1).done(() => {
            callback();
        });
    }
}

var TestHelper = new TestHelperClass();
export default TestHelper;
