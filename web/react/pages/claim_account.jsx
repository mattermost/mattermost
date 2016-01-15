// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {addLocaleData, IntlProvider} from 'react-intl';
import enLocaleData from '../utils/locales/en';
import esLocaleData from '../utils/locales/es';
import ClaimAccount from '../components/claim/claim_account.jsx';

function setupClaimAccountPage(props) {
    const lang = props.Locale;
    const messages = JSON.parse(props.Messages);

    ReactDOM.render(
        <IntlProvider
            locale={lang}
            messages={messages}
        >
            <ClaimAccount
                email={props.Email}
                currentType={props.CurrentType}
                newType={props.NewType}
                teamName={props.TeamName}
                teamDisplayName={props.TeamDisplayName}
            />
        </IntlProvider>,
        document.getElementById('claim')
    );
}

global.window.setup_claim_account_page = setupClaimAccountPage;
