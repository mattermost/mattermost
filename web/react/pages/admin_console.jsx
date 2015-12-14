// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {addLocaleData, IntlProvider} from 'react-intl';
import enLocaleData from '../utils/locales/en';
import esLocaleData from '../utils/locales/es';
import ErrorBar from '../components/error_bar.jsx';
import SelectTeamModal from '../components/admin_console/select_team_modal.jsx';
import AdminController from '../components/admin_console/admin_controller.jsx';

addLocaleData(enLocaleData);
addLocaleData(esLocaleData);

export function setupAdminConsolePage(props) {
    const lang = props.Locale;
    const messages = JSON.parse(props.Messages);

    ReactDOM.render(
        <IntlProvider
            locale={lang}
            messages={messages}
        >
            <AdminController
                tab={props.ActiveTab}
                teamId={props.TeamId}
            />
        </IntlProvider>,
        document.getElementById('admin_controller')
    );

    ReactDOM.render(
        <IntlProvider
            locale={lang}
            messages={messages}
        >
            <SelectTeamModal />
        </IntlProvider>,
        document.getElementById('select_team_modal')
    );

    ReactDOM.render(
        <IntlProvider
            locale={lang}
            messages={messages}
        >
            <ErrorBar/>
        </IntlProvider>,
        document.getElementById('error_bar')
    );
}

global.window.setup_admin_console_page = setupAdminConsolePage;
