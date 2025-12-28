// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import ExternalLink from 'components/external_link';
import * as Menu from 'components/menu';
import Tag from 'components/widgets/tag/tag';

import {LicenseLinks, LicenseSkus} from 'utils/constants';

export default function ProductSwitcherEditionFooter() {
    const license = useSelector(getLicense);

    const {formatMessage} = useIntl();

    const isLicensedVersion = license?.IsLicensed === 'true';
    const isEntrySKU = license?.SkuShortName === LicenseSkus.Entry;

    if (isLicensedVersion && !isEntrySKU) {
        return null;
    }

    const isEntryLicense = isLicensedVersion && isEntrySKU;

    let badgeLable = 'TEAM EDITION';
    if (isEntryLicense) {
        badgeLable = 'ENTRY EDITION';
    }

    let label = formatMessage(
        {
            id: 'navbar_dropdown.versionText',
            defaultMessage: 'This is the free <link>unsupported</link> edition of Mattermost.',
        },
        {
            link: (msg: React.ReactNode) => (
                <ExternalLink
                    location='menu_start_trial.unsupported-link'
                    href={LicenseLinks.UNSUPPORTED}
                >
                    {msg}
                </ExternalLink>
            ),
        },
    );
    if (isEntryLicense) {
        label = formatMessage({
            id: 'navbar_dropdown.entryVersionText',
            defaultMessage: 'Entry offers Enterprise Advance capabilities <link>with limits</link> designed to support evaluation.',
        },
        {
            link: (msg: React.ReactNode) => (
                <ExternalLink
                    location='menu_start_trial.entry-link'
                    href={LicenseLinks.ENTRY_LIMITS_INFO}
                >
                    {msg}
                </ExternalLink>
            ),
        });
    }

    return (
        <>
            <Menu.Separator/>
            <li className='globalHeader-leftControls-productSwitcherMenu-editionFooter'>
                <Tag
                    text={badgeLable}
                    size='xs'
                    uppercase={true}
                />
                <div className='footerlabel'>
                    {label}
                </div>
            </li>
        </>
    );
}

