// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import EmailVerify from '../components/email_verify.jsx';
import {addLocaleData, IntlProvider} from 'react-intl';
import enLocaleData from '../utils/locales/en';
import esLocaleData from '../utils/locales/es';

addLocaleData(enLocaleData);
addLocaleData(esLocaleData);

global.window.setupVerifyPage = function setupVerifyPage(props) {
    const lang = props.Locale;
    const messages = JSON.parse(props.Messages);

    ReactDOM.render(
        <IntlProvider
            locale={lang}
            messages={messages}
        >
            <EmailVerify
                isVerified={props.IsVerified}
                teamURL={props.TeamURL}
                userEmail={props.UserEmail}
                resendSuccess={props.ResendSuccess}
            />
        </IntlProvider>,
        document.getElementById('verify')
    );
};
