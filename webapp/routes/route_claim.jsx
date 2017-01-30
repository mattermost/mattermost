import * as RouteUtils from 'routes/route_utils.jsx';

export default {
    path: 'claim',
    getComponents: (location, callback) => {
        System.import('components/claim/claim_controller.jsx').then(RouteUtils.importComponentSuccess(callback));
    },
    getChildRoutes: RouteUtils.createGetChildComponentsFunction(
        [
            {
                path: 'oauth_to_email',
                getComponents: (location, callback) => {
                    System.import('components/claim/components/oauth_to_email.jsx').then(RouteUtils.importComponentSuccess(callback));
                }
            },
            {
                path: 'email_to_oauth',
                getComponents: (location, callback) => {
                    System.import('components/claim/components/email_to_oauth.jsx').then(RouteUtils.importComponentSuccess(callback));
                }
            },
            {
                path: 'ldap_to_email',
                getComponents: (location, callback) => {
                    System.import('components/claim/components/ldap_to_email.jsx').then(RouteUtils.importComponentSuccess(callback));
                }
            },
            {
                path: 'email_to_ldap',
                getComponents: (location, callback) => {
                    System.import('components/claim/components/email_to_ldap.jsx').then(RouteUtils.importComponentSuccess(callback));
                }
            }
        ]
    )
};
