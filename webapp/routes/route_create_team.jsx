import * as RouteUtils from 'routes/route_utils.jsx';

export default {
    path: 'create_team',
    getComponents: (location, callback) => {
        System.import('components/create_team/create_team_controller.jsx').then(RouteUtils.importComponentSuccess(callback));
    },
    indexRoute: {onEnter: (nextState, replace) => replace('/create_team/display_name')},
    getChildRoutes: RouteUtils.createGetChildComponentsFunction(
        [
            {
                path: 'display_name',
                getComponents: (location, callback) => {
                    System.import('components/create_team/components/display_name.jsx').then(RouteUtils.importComponentSuccess(callback));
                }
            },
            {
                path: 'team_url',
                getComponents: (location, callback) => {
                    System.import('components/create_team/components/team_url.jsx').then(RouteUtils.importComponentSuccess(callback));
                }
            }
        ]
    )
};
