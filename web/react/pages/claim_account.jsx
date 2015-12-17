// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import ClaimAccount from '../components/claim/claim_account.jsx';

function setupClaimAccountPage(props) {
    ReactDOM.render(
        <ClaimAccount
            email={props.Email}
            currentType={props.CurrentType}
            newType={props.NewType}
            teamName={props.TeamName}
            teamDisplayName={props.TeamDisplayName}
        />,
        document.getElementById('claim')
    );
}

global.window.setup_claim_account_page = setupClaimAccountPage;
