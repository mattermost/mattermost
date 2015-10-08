// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var ErrorBar = require('../components/error_bar.jsx');
var SelectTeamModal = require('../components/admin_console/select_team_modal.jsx');
var AdminController = require('../components/admin_console/admin_controller.jsx');

export function setupAdminConsolePage() {
    React.render(
        <AdminController />,
        document.getElementById('admin_controller')
    );

    React.render(
        <SelectTeamModal />,
        document.getElementById('select_team_modal')
    );

    React.render(
        <ErrorBar/>,
        document.getElementById('error_bar')
    );
}

global.window.setup_admin_console_page = setupAdminConsolePage;
