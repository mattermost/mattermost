// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

export default {
    path: 'invite_members',
    indexRoute: {
        onEnter: (nextState, replace, callback) => {
            if (global.window.mm_config.EnableGuestAccounts !== 'true') {
                replace('/' + nextState.params.team + '/invite_members/full_members');
            }
            callback();
        },
        getComponents: (location, callback) => {
            Promise.all([
                System.import('components/sidebar.jsx'),
                System.import('components/invite_members/invite_members_index_container.jsx')
            ]).then(
            (comarr) => callback(null, {sidebar: comarr[0].default, center: comarr[1].default})
            );
        }
    },
    childRoutes: [
        {
            path: 'full_members',
            getComponents: (location, callback) => {
                Promise.all([
                    System.import('components/sidebar.jsx'),
                    System.import('components/invite_members/invite_full_members_container.jsx')
                ]).then(
                (comarr) => callback(null, {sidebar: comarr[0].default, center: comarr[1].default})
                );
            }
        },
        {
            path: 'single_channel_guest',
            getComponents: (location, callback) => {
                Promise.all([
                    System.import('components/sidebar.jsx'),
                    System.import('components/invite_members/invite_single_channel_guest_container.jsx')
                ]).then(
                (comarr) => callback(null, {sidebar: comarr[0].default, center: comarr[1].default})
                );
            }
        }
    ]
};
