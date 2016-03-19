// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'react-intl';

import React from 'react';

export default class FinishedPage extends React.Component {
    render() {
        return (
            <FormattedMessage
                id='signup_team_complete.completed'
                defaultMessage="You've already completed the signup process for this invitation or this invitation has expired."
            />
        );
    }
}
