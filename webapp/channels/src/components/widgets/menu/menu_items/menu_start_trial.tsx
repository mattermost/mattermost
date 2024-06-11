// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import ExternalLink from 'components/external_link';

import {LicenseLinks} from 'utils/constants';

import './menu_item.scss';

const FreeVersionBadge = styled.div`
     position: relative;
     top: 1px;
     display: flex;
     padding: 2px 6px;
     border-radius: var(--radius-s);
     margin-bottom: 6px;
     background: rgba(var(--center-channel-color-rgb), 0.08);
     color: rgba(var(--center-channel-color-rgb), 0.75);
     font-family: 'Open Sans', sans-serif;
     font-size: 10px;
     font-weight: 600;
     letter-spacing: 0.025em;
     line-height: 16px;
`;

type Props = {
    id: string;
}

const MenuStartTrial = (props: Props): JSX.Element | null => {
    const {formatMessage} = useIntl();

    const license = useSelector(getLicense);
    const isCurrentLicensed = license?.IsLicensed;

    if (isCurrentLicensed === 'true') {
        return null;
    }

    return (
        <li
            className={'MenuStartTrial'}
            role='menuitem'
            id={props.id}
        >
            <FreeVersionBadge>{'FREE EDITION'}</FreeVersionBadge>
            <div className='editionText'>
                {formatMessage(
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
                )}
            </div>
        </li>
    );
};

export default MenuStartTrial;
