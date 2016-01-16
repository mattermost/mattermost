// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {addLocaleData, IntlProvider} from 'react-intl';
import enLocaleData from '../utils/locales/en';
import esLocaleData from '../utils/locales/es';
import Authorize from '../components/authorize.jsx';

addLocaleData(enLocaleData);
addLocaleData(esLocaleData);

function setupAuthorizePage(props) {
    const lang = props.Locale;
    const messages = JSON.parse(props.Messages);

    ReactDOM.render(
        <IntlProvider
            locale={lang}
            messages={messages}
        >
            <Authorize
                teamName={props.TeamName}
                appName={props.AppName}
                responseType={props.ResponseType}
                clientId={props.ClientId}
                redirectUri={props.RedirectUri}
                scope={props.Scope}
                state={props.State}
            />,
        </IntlProvider>,
        document.getElementById('authorize')
    );
}

global.window.setup_authorize_page = setupAuthorizePage;
