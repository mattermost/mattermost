// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

import BlockableLink from 'components/admin_console/blockable_link';
import BackIcon from 'components/widgets/icons/fa_back_icon';

type Props = {
    team?: Team;
    siteName?: string;
}

const BackstageNavbar = ({team, siteName}: Props) => {
    const teamExists = team?.delete_at === 0;

    return (
        <div className='backstage-navbar'>
            <BlockableLink
                className='backstage-navbar__back'
                to={`/${teamExists ? team?.name : ''}`}
            >
                <BackIcon/>
                <span>
                    {teamExists ? (
                        <FormattedMessage
                            id='backstage_navbar.backToMattermost'
                            defaultMessage='Back to {siteName}'
                            values={{siteName: siteName ?? team?.name}}
                        />
                    ) : (
                        <FormattedMessage
                            id='backstage_navbar.back'
                            defaultMessage='Back'
                        />
                    )}
                </span>
            </BlockableLink>
        </div>
    );
};

export default BackstageNavbar;
