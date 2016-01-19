// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PasswordReset from '../components/password_reset.jsx';
import {addLocaleData, IntlProvider} from 'react-intl';
import enLocaleData from '../utils/locales/en';
import esLocaleData from '../utils/locales/es';

addLocaleData(enLocaleData);
addLocaleData(esLocaleData);

function setupPasswordResetPage(props) {
    const lang = props.Locale;
    const messages = JSON.parse(props.Messages);

    ReactDOM.render(
        <IntlProvider
            locale={lang}
            messages={messages}
        >
            <PasswordReset
                isReset={props.IsReset}
                teamDisplayName={props.TeamDisplayName}
                teamName={props.TeamName}
                hash={props.Hash}
                data={props.Data}
            />
        </IntlProvider>,
        document.getElementById('reset')
    );
}

global.window.setup_password_reset_page = setupPasswordResetPage;
