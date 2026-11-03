// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {AlertOutlineIcon} from '@mattermost/compass-icons/components';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {AnnouncementBarTypes} from 'utils/constants';

import AnnouncementBar from '../default_announcement_bar';

const NonProductionLicenseAnnouncementBar: React.FC = () => {
    const license = useSelector(getLicense);

    if (license?.IsNonProduction !== 'true') {
        return null;
    }

    return (
        <AnnouncementBar
            type={AnnouncementBarTypes.ADVISOR}
            showCloseButton={false}
            message={
                <FormattedMessage
                    id='announcement_bar.non_production_license.message'
                    defaultMessage='Non-production license. Test or staging use only.'
                />
            }
            icon={<AlertOutlineIcon size={16}/>}
        />
    );
};

export default NonProductionLicenseAnnouncementBar;
