// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ExternalLink from 'components/external_link';
import './learn_about_teams_link.scss';

const LearnAboutTeamsLink = () => {
    return (
        <div className='LearnAboutTeamsLink'>
            <FormattedMessage
                id='learn_about_teams'
                defaultMessage='<a>Learn about teams</a>'
                values={{
                    a: (chunks) => (
                        <ExternalLink
                            location='learn_about_teams'
                            href='https://mattermost.com/pl/mattermost-academy-team-training'
                        >
                            <i className='icon icon-lightbulb-outline'/>
                            <span>{chunks}</span>
                        </ExternalLink>
                    ),
                }}
            />
        </div>
    );
};
export default LearnAboutTeamsLink;
