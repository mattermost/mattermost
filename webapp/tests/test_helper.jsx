// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Client from 'client/client.jsx';
import jqd from 'jquery-deferred';

class TestHelperClass {
    basicClient = () => {
        return this.basicc;
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

    initBasic = (callback) => {
        this.basicc = this.createClient();

        var d1 = jqd.Deferred();
        var email = this.fakeEmail();
        var outer = this;  // eslint-disable-line consistent-this

        this.basicClient().signupTeam(
            email,
            function(rsignUp) {
                var teamSignup = {};
                teamSignup.invites = [];
                teamSignup.data = decodeURIComponent(rsignUp.follow_link.split('&h=')[0].replace('/signup_team_complete/?d=', ''));
                teamSignup.hash = decodeURIComponent(rsignUp.follow_link.split('&h=')[1]);

                teamSignup.user = outer.fakeUser();
                teamSignup.team = outer.fakeTeam();
                teamSignup.team.email = email;
                teamSignup.user.email = email;
                var password = teamSignup.user.password;

                outer.basicClient().createTeamFromSignup(
                    teamSignup,
                    function(rteamSignup) {
                        outer.basict = rteamSignup.team;
                        outer.basicu = rteamSignup.user;
                        outer.basicu.password = password;
                        outer.basicClient().setTeamId(outer.basict.id);
                        outer.basicClient().login(
                            rteamSignup.user.email,
                            password,
                            null,
                            function() {
                                outer.basicClient().useHeaderToken();
                                var channel = outer.fakeChannel();
                                channel.team_id = outer.basicTeam().id;
                                outer.basicClient().createChannel(
                                    channel,
                                    function(rchannel) {
                                        outer.basicch = rchannel;
                                        var post = outer.fakePost();
                                        post.channel_id = rchannel.id;

                                        outer.basicClient().createPost(
                                            post,
                                            function(rpost) {
                                                outer.basicp = rpost;
                                                d1.resolve();
                                            },
                                            function(err) {
                                                throw err;
                                            }
                                        );
                                    },
                                    function(err) {
                                        throw err;
                                    }
                                );
                            },
                            function(err) {
                                throw err;
                            }
                        );
                    },
                    function(err) {
                        throw err;
                    }
                );
            },
            function(err) {
                throw err;
            }
        );

        jqd.when(d1).done(() => {
            callback();
        });
    }
}

var TestHelper = new TestHelperClass();
export default TestHelper;
