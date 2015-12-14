// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Login from '../components/login.jsx';
import {addLocaleData, IntlProvider} from 'react-intl';
import enLocaleData from '../utils/locales/en';
import esLocaleData from '../utils/locales/es';

addLocaleData(enLocaleData);
addLocaleData(esLocaleData);

function setupLoginPage(props) {
    const lang = props.Locale;
    const messages = JSON.parse(props.Messages);

    ReactDOM.render(
        <IntlProvider
            locale={lang}
            messages={messages}
        >
            <Login
                teamDisplayName={props.TeamDisplayName}
                teamName={props.TeamName}
                inviteId={props.InviteId}
            />
        </IntlProvider>,
        document.getElementById('login')
    );
}

global.window.setup_login_page = setupLoginPage;
