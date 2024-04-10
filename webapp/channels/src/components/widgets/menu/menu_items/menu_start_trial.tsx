// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import {isTrialLicense} from 'utils/license_utils';

import './menu_item.scss';

type Props = {
    id: string;
}

const MenuStartTrial = (props: Props): JSX.Element | null => {
    const {formatMessage} = useIntl();

    const license = useSelector(getLicense);
    const isCurrentLicensed = license?.IsLicensed;
    const isCurrentLicenseTrial = isTrialLicense(license);

    let editionName = "Free Edition";

    if (isCurrentLicenseTrial) {
        editionName = "Enterprise Edition (Trial)"
    } else if (isCurrentLicensed === 'true' && license.SkuName) {
        editionName = license.SkuName.charAt(0).toUpperCase() + license.SkuName.slice(1) + " Edition";
    } else if (isCurrentLicensed === 'true') {
        return null;
    }


    return (
        <li
            className={'MenuStartTrial'}
            role='menuitem'
            id={props.id}
        >
            <div className='free_version_badge'>{editionName.toUpperCase()}</div>
            <div className='start_trial_content'>
                {formatMessage({
                    id: 'navbar_dropdown.versionText',
                    defaultMessage: 'This server is currently on the {edition} of Mattermost.',
                }, {edition: editionName})}
            </div>
        </li>
    );
};

export default MenuStartTrial;
