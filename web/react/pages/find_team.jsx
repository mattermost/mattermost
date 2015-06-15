// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var FindTeam = require('../components/find_team.jsx');

global.window.setup_find_team_page = function() {

    React.render(
        <FindTeam />,
        document.getElementById('find-team')
    );

};
