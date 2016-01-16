// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SignupUserComplete from '../components/signup_user_complete.jsx';
import {addLocaleData, IntlProvider} from 'react-intl';
import enLocaleData from '../utils/locales/en';
import esLocaleData from '../utils/locales/es';

addLocaleData(enLocaleData);
addLocaleData(esLocaleData);

function setupSignupUserCompletePage(props) {
    var lang = props.Locale;
    var messages = JSON.parse(props.Messages);

    ReactDOM.render(
        <IntlProvider
            locale={lang}
            messages={messages}
        >
            <SignupUserComplete
                teamId={props.TeamId}
                teamName={props.TeamName}
                teamDisplayName={props.TeamDisplayName}
                email={props.Email}
                hash={props.Hash}
                data={props.Data}
            />
        </IntlProvider>,
        document.getElementById('signup-user-complete')
    );
}

global.window.setup_signup_user_complete_page = setupSignupUserCompletePage;
