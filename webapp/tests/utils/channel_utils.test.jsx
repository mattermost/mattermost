// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as Utils from 'utils/channel_utils.jsx';
import Constants from 'utils/constants.jsx';

describe('Channel Utils', () => {
    describe('showDeleteOption', () => {
        test('all users can delete channels on unlicensed instances', () => {
            global.window.mm_license = {IsLicensed: 'false'};
            expect(Utils.showDeleteOptionForCurrentUser(null, true, true, true)).
                toEqual(true);
        });

        test('users cannot delete default channels', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            const channel = {name: Constants.DEFAULT_CHANNEL};
            expect(Utils.showDeleteOptionForCurrentUser(channel, true, true, true)).
                toEqual(false);
        });

        test('system admins can delete private channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelDeletion: Constants.PERMISSIONS_SYSTEM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, false, true)).
                toEqual(true);
        });

        test('system admins can delete private channels, user is not system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelDeletion: Constants.PERMISSIONS_SYSTEM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, false, false)).
                toEqual(false);
        });

        test('system admins can delete public channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelDeletion: Constants.PERMISSIONS_SYSTEM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, false, true)).
                toEqual(true);
        });

        test('system admins can delete public channels, user is not system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelDeletion: Constants.PERMISSIONS_SYSTEM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, false, false)).
                toEqual(false);
        });

        test('system admins or team admins can delete private channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelDeletion: Constants.PERMISSIONS_TEAM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, false, true)).
                toEqual(true);
        });

        test('system admins or team admins can delete private channels, user is not system admin or team admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelDeletion: Constants.PERMISSIONS_TEAM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, false, false)).
                toEqual(false);
        });

        test('system admins or team admins can delete public channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelDeletion: Constants.PERMISSIONS_TEAM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, false, true)).
                toEqual(true);
        });

        test('system admins or team admins can delete public channels, user is not system admin or team admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelDeletion: Constants.PERMISSIONS_TEAM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, false, false)).
                toEqual(false);
        });

        test('system admins or team admins can delete private channels, user is team admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelDeletion: Constants.PERMISSIONS_TEAM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, true, false)).
                toEqual(true);
        });

        test('system admins or team admins can delete public channels, user is team admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelDeletion: Constants.PERMISSIONS_TEAM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, true, false)).
                toEqual(true);
        });

        test('channel, team, and system admins can delete public channels, user is channel admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelDeletion: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, true, false, false)).
                toEqual(true);
        });

        test('channel, team, and system admins can delete private channels, user is channel admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelDeletion: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, true, false, false)).
                toEqual(true);
        });

        test('channel, team, and system admins can delete public channels, user is team admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelDeletion: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, true, false)).
                toEqual(true);
        });

        test('channel, team, and system admins can delete private channels, user is channel admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelDeletion: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, true, false)).
                toEqual(true);
        });

        test('channel, team, and system admins can delete public channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelDeletion: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, false, true)).
                toEqual(true);
        });

        test('channel, team, and system admins can delete private channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelDeletion: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, false, true)).
                toEqual(true);
        });

        test('channel, team, and system admins can delete public channels, user is not admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelDeletion: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, false, false)).
                toEqual(false);
        });

        test('channel, team, and system admins can delete private channels, user is channel admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelDeletion: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, false, false)).
                toEqual(false);
        });

        test('any member can delete public channels, user is not admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelDeletion: Constants.PERMISSIONS_ALL};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, false, false)).
                toEqual(true);
        });

        test('any member can delete private channels, user is not admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelDeletion: Constants.PERMISSIONS_ALL};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showDeleteOptionForCurrentUser(channel, false, false, false)).
                toEqual(true);
        });
    });

    describe('showManagementOptions', () => {
        test('all users can manage channel options on unlicensed instances', () => {
            global.window.mm_license = {IsLicensed: 'false'};
            expect(Utils.showManagementOptions(null, true, true, true)).
                toEqual(true);
        });

        test('system admins can manage channel options in private channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManagement: Constants.PERMISSIONS_SYSTEM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, false, true)).
                toEqual(true);
        });

        test('system admins can manage channel options in private channels, user is not system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManagement: Constants.PERMISSIONS_SYSTEM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, false, false)).
                toEqual(false);
        });

        test('system admins can manage channel options in public channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelManagement: Constants.PERMISSIONS_SYSTEM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, false, true)).
                toEqual(true);
        });

        test('system admins can manage channel options in public channels, user is not system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelManagement: Constants.PERMISSIONS_SYSTEM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, false, false)).
                toEqual(false);
        });

        test('system admins or team admins can manage channel options in private channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManagement: Constants.PERMISSIONS_TEAM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, false, true)).
                toEqual(true);
        });

        test('system admins or team admins can manage channel options in private channels, user is not system admin or team admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManagement: Constants.PERMISSIONS_TEAM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, false, false)).
                toEqual(false);
        });

        test('system admins or team admins can manage channel options in public channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelManagement: Constants.PERMISSIONS_TEAM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, false, true)).
                toEqual(true);
        });

        test('system admins or team admins can manage channel options in public channels, user is not system admin or team admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelManagement: Constants.PERMISSIONS_TEAM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, false, false)).
                toEqual(false);
        });

        test('system admins or team admins can manage channel options in private channels, user is team admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManagement: Constants.PERMISSIONS_TEAM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, true, false)).
                toEqual(true);
        });

        test('system admins or team admins can manage channel options in public channels, user is team admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelManagement: Constants.PERMISSIONS_TEAM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, true, false)).
                toEqual(true);
        });

        test('channel, team, and system admins can manage channel options in public channels, user is channel admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelManagement: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, true, false, false)).
                toEqual(true);
        });

        test('channel, team, and system admins can manage channel options in private channels, user is channel admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManagement: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, true, false, false)).
                toEqual(true);
        });

        test('channel, team, and system admins can manage channel options in public channels, user is team admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelManagement: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, true, false)).
                toEqual(true);
        });

        test('channel, team, and system admins can manage channel options in private channels, user is channel admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManagement: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, true, false)).
                toEqual(true);
        });

        test('channel, team, and system admins can manage channel options in public channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelManagement: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, false, true)).
                toEqual(true);
        });

        test('channel, team, and system admins can manage channel options in private channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManagement: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, false, true)).
                toEqual(true);
        });

        test('channel, team, and system admins can manage channel options in public channels, user is not admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelManagement: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, false, false)).
                toEqual(false);
        });

        test('channel, team, and system admins can manage channel options in private channels, user is channel admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManagement: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, false, false)).
                toEqual(false);
        });

        test('any member can manage channel options in public channels, user is not admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelManagement: Constants.PERMISSIONS_ALL};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, false, false)).
                toEqual(true);
        });

        test('any member can manage channel options in private channels, user is not admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManagement: Constants.PERMISSIONS_ALL};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.showManagementOptions(channel, false, false, false)).
                toEqual(true);
        });
    });

    describe('showCreateOption', () => {
        test('all users can create new channels on unlicensed instances', () => {
            global.window.mm_license = {IsLicensed: 'false'};
            expect(Utils.showCreateOption(null, true, true)).
                toEqual(true);
        });

        test('system admins can create new private channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelCreation: Constants.PERMISSIONS_SYSTEM_ADMIN};

            expect(Utils.showCreateOption(Constants.PRIVATE_CHANNEL, false, true)).
                toEqual(true);
        });

        test('system admins can create new private channels, user is not system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelCreation: Constants.PERMISSIONS_SYSTEM_ADMIN};

            expect(Utils.showCreateOption(Constants.PRIVATE_CHANNEL, false, false)).
                toEqual(false);
        });

        test('system admins can create new public channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelCreation: Constants.PERMISSIONS_SYSTEM_ADMIN};

            expect(Utils.showCreateOption(Constants.OPEN_CHANNEL, false, true)).
                toEqual(true);
        });

        test('system admins can create new public channels, user is not system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelCreation: Constants.PERMISSIONS_SYSTEM_ADMIN};

            expect(Utils.showCreateOption(Constants.OPEN_CHANNEL, false, false)).
                toEqual(false);
        });

        test('system admins or team admins can create new private channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelCreation: Constants.PERMISSIONS_TEAM_ADMIN};

            expect(Utils.showCreateOption(Constants.PRIVATE_CHANNEL, false, true)).
                toEqual(true);
        });

        test('system admins or team admins can create new private channels, user is not system admin or team admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelCreation: Constants.PERMISSIONS_TEAM_ADMIN};

            expect(Utils.showCreateOption(Constants.PRIVATE_CHANNEL, false, false)).
                toEqual(false);
        });

        test('system admins or team admins can create new public channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelCreation: Constants.PERMISSIONS_TEAM_ADMIN};

            expect(Utils.showCreateOption(Constants.OPEN_CHANNEL, false, true)).
                toEqual(true);
        });

        test('system admins or team admins can create new public channels, user is not system admin or team admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelCreation: Constants.PERMISSIONS_TEAM_ADMIN};

            expect(Utils.showCreateOption(Constants.OPEN_CHANNEL, false, false)).
                toEqual(false);
        });

        test('system admins or team admins can create new private channels, user is team admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelCreation: Constants.PERMISSIONS_TEAM_ADMIN};

            expect(Utils.showCreateOption(Constants.PRIVATE_CHANNEL, true, false)).
                toEqual(true);
        });

        test('system admins or team admins can create new public channels, user is team admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelCreation: Constants.PERMISSIONS_TEAM_ADMIN};

            expect(Utils.showCreateOption(Constants.OPEN_CHANNEL, true, false)).
                toEqual(true);
        });

        test('channel, team, and system admins can create new public channels, user is channel admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelCreation: Constants.PERMISSIONS_CHANNEL_ADMIN};

            expect(Utils.showCreateOption(Constants.OPEN_CHANNEL, false, false)).
                toEqual(true);
        });

        test('channel, team, and system admins can create new public channels, user is team admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelCreation: Constants.PERMISSIONS_CHANNEL_ADMIN};

            expect(Utils.showCreateOption(Constants.OPEN_CHANNEL, true, false)).
                toEqual(true);
        });

        test('channel, team, and system admins can create new private channels, user is channel admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelCreation: Constants.PERMISSIONS_CHANNEL_ADMIN};

            expect(Utils.showCreateOption(Constants.PRIVATE_CHANNEL, true, false)).
                toEqual(true);
        });

        test('channel, team, and system admins can create new public channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelCreation: Constants.PERMISSIONS_CHANNEL_ADMIN};

            expect(Utils.showCreateOption(Constants.OPEN_CHANNEL, false, true)).
                toEqual(true);
        });

        test('channel, team, and system admins can create new private channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelCreation: Constants.PERMISSIONS_CHANNEL_ADMIN};

            expect(Utils.showCreateOption(Constants.PRIVATE_CHANNEL, false, true)).
                toEqual(true);
        });

        test('any member can create new public channels, user is not admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPublicChannelCreation: Constants.PERMISSIONS_ALL};

            expect(Utils.showCreateOption(Constants.OPEN_CHANNEL, false, false)).
                toEqual(true);
        });

        test('any member can create new private channels, user is not admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelCreation: Constants.PERMISSIONS_ALL};

            expect(Utils.showCreateOption(Constants.PRIVATE_CHANNEL, false, false)).
                toEqual(true);
        });
    });

    describe('canManageMembers', () => {
        test('all users can manage channel members on unlicensed instances', () => {
            global.window.mm_license = {IsLicensed: 'false'};
            expect(Utils.canManageMembers(null, true, true, true)).
                toEqual(true);
        });

        test('system admins can manage channel members in private channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManageMembers: Constants.PERMISSIONS_SYSTEM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.canManageMembers(channel, false, false, true)).
                toEqual(true);
        });

        test('system admins can manage channel members in private channels, user is not system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManageMembers: Constants.PERMISSIONS_SYSTEM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.canManageMembers(channel, false, false, false)).
                toEqual(false);
        });

        test('system admins or team admins can manage channel members in private channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManageMembers: Constants.PERMISSIONS_TEAM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.canManageMembers(channel, false, false, true)).
                toEqual(true);
        });

        test('system admins or team admins can manage channel members in private channels, user is not system admin or team admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManageMembers: Constants.PERMISSIONS_TEAM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.canManageMembers(channel, false, false, false)).
                toEqual(false);
        });

        test('system admins or team admins can manage channel members in private channels, user is team admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManageMembers: Constants.PERMISSIONS_TEAM_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.canManageMembers(channel, false, true, false)).
                toEqual(true);
        });

        test('channel, team, and system admins can manage channel members in private channels, user is channel admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManageMembers: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.canManageMembers(channel, true, false, false)).
                toEqual(true);
        });

        test('channel, team, and system admins can manage channel members in private channels, user is channel admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManageMembers: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.canManageMembers(channel, false, true, false)).
                toEqual(true);
        });

        test('channel, team, and system admins can manage channel members in private channels, user is system admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManageMembers: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.canManageMembers(channel, false, false, true)).
                toEqual(true);
        });

        test('channel, team, and system admins can manage channel members in private channels, user is channel admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManageMembers: Constants.PERMISSIONS_CHANNEL_ADMIN};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.PRIVATE_CHANNEL
            };
            expect(Utils.canManageMembers(channel, false, false, false)).
                toEqual(false);
        });

        test('any member can manage channel members in public channels, user is not admin test', () => {
            global.window.mm_license = {IsLicensed: 'true'};
            global.window.mm_config = {RestrictPrivateChannelManageMembers: Constants.PERMISSIONS_ALL};

            const channel = {
                name: 'fakeChannelName',
                type: Constants.OPEN_CHANNEL
            };
            expect(Utils.canManageMembers(channel, false, false, false)).
                toEqual(true);
        });
    });
});