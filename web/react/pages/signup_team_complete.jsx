// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SignupTeamComplete from '../components/signup_team_complete.jsx';
import {addLocaleData, IntlProvider} from 'react-intl';
import enLocaleData from '../utils/locales/en';
import esLocaleData from '../utils/locales/es';

addLocaleData(enLocaleData);
addLocaleData(esLocaleData);

function setupSignupTeamCompletePage(props) {
    const lang = props.Locale;
    const messages = JSON.parse(props.Messages);

    ReactDOM.render(
        <IntlProvider
            locale={lang}
            messages={messages}
        >
            <SignupTeamComplete
                email={props.Email}
                hash={props.Hash}
                data={props.Data}
            />
        </IntlProvider>,
        document.getElementById('signup-team-complete')
    );
}

global.window.setup_signup_team_complete_page = setupSignupTeamCompletePage;
