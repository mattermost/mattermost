// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ErrorBar from '../components/error_bar.jsx';
import SelectTeamModal from '../components/admin_console/select_team_modal.jsx';
import AdminController from '../components/admin_console/admin_controller.jsx';

export function setupAdminConsolePage(props) {
    ReactDOM.render(
        <AdminController
            tab={props.ActiveTab}
            teamId={props.TeamId}
        />,
        document.getElementById('admin_controller')
    );

    ReactDOM.render(
        <SelectTeamModal />,
        document.getElementById('select_team_modal')
    );

    ReactDOM.render(
        <ErrorBar/>,
        document.getElementById('error_bar')
    );
}

global.window.setup_admin_console_page = setupAdminConsolePage;
