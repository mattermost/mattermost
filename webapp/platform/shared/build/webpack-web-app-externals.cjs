// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This script is intended to be used by Mattermost plugins to set up their Webpack externals to share their
// dependencies with the web app. It includes both third party dependencies (React, etc) and the MM Shared package.

const windowExternals = {
    react: 'React',
    'react-dom': 'ReactDOM',
    redux: 'Redux',
    luxon: 'Luxon',
    'react-redux': 'ReactRedux',
    'prop-types': 'PropTypes',
    'react-bootstrap': 'ReactBootstrap',
    'react-router-dom': 'ReactRouterDom',
    'react-intl': 'ReactIntl',
};

function webAppExternals() {
    return [
        windowExternals,
        ({request}, callback) => {
            if ((/^@mattermost\/shared\//).test(request)) {
                return callback(null, `promise globalThis.loadSharedDependency('${request}')`);
            }

            return callback();
        },
    ];
}
module.exports = webAppExternals;
