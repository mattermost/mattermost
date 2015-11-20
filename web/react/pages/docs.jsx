// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import Docs from '../components/docs.jsx';

function setupDocumentationPage(props) {
    ReactDOM.render(
        <Docs
            site={props.Site}
        />,
        document.getElementById('docs')
    );
}

global.window.mm_user = global.window.mm_user || {};
global.window.setup_documentation_page = setupDocumentationPage;
