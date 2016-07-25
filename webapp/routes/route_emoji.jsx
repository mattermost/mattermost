// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import * as RouteUtils from 'routes/route_utils.jsx';

export default {
    path: 'emoji',
    getComponents: (location, callback) => {
        System.import('components/backstage/backstage_controller.jsx').then(RouteUtils.importComponentSuccess(callback));
    },
    indexRoute: {
        getComponents: (location, callback) => {
            System.import('components/emoji/components/emoji_list.jsx').then(RouteUtils.importComponentSuccess(callback));
        }
    },
    childRoutes: [
        {
            path: 'add',
            getComponents: (location, callback) => {
                System.import('components/emoji/components/add_emoji.jsx').then(RouteUtils.importComponentSuccess(callback));
            }
        }
    ]
};
