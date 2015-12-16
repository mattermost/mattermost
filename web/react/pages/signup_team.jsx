// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SignupTeam from '../components/signup_team.jsx';
import {addLocaleData, IntlProvider} from 'react-intl';
import enLocaleData from '../utils/locales/en';
import esLocaleData from '../utils/locales/es';

addLocaleData(enLocaleData);
addLocaleData(esLocaleData);

function setupSignupTeamPage(props) {
    let teams = [];
    const lang = props.Locale;
    const messages = JSON.parse(props.Messages);

    for (let prop in props) {
        if (props.hasOwnProperty(prop)) {
            if (prop !== 'Title' && prop.indexOf('Footer') === -1 && prop !== 'Locale' && prop !== 'Messages') {
                teams.push({name: prop, display_name: props[prop]});
            }
        }
    }

    ReactDOM.render(
        <IntlProvider
            locale={lang}
            messages={messages}
        >
            <SignupTeam teams={teams} />
        </IntlProvider>,
        document.getElementById('signup-team')
    );
}

global.window.setup_signup_team_page = setupSignupTeamPage;
