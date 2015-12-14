// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {addLocaleData, IntlProvider} from 'react-intl';
import enLocaleData from '../utils/locales/en';
import esLocaleData from '../utils/locales/es';
import Docs from '../components/docs.jsx';

addLocaleData(enLocaleData);
addLocaleData(esLocaleData);

function setupDocumentationPage(props) {
    const lang = props.Locale;
    const messages = JSON.parse(props.Messages);

    ReactDOM.render(
        <IntlProvider
            locale={lang}
            messages={messages}
        >
            <Docs
                site={props.Site}
            />
        </IntlProvider>,
        document.getElementById('docs')
    );
}

global.window.mm_user = global.window.mm_user || {};
global.window.setup_documentation_page = setupDocumentationPage;
