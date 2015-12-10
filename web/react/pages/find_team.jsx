// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import FindTeam from '../components/find_team.jsx';
import {addLocaleData, IntlProvider} from 'react-intl';
import enLocaleData from '../utils/locales/en';
import esLocaleData from '../utils/locales/es';

addLocaleData(enLocaleData);
addLocaleData(esLocaleData);

function setupFindTeamPage(props) {
    const lang = props.Locale;
    const messages = JSON.parse(props.Messages);

    ReactDOM.render(
        <IntlProvider
            locale={lang}
            messages={messages}
        >
            <FindTeam />
        </IntlProvider>,
        document.getElementById('find-team')
    );
}

global.window.setup_find_team_page = setupFindTeamPage;
