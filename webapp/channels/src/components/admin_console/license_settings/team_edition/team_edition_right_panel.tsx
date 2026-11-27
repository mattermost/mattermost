// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/compass-ui/components/button';

import SetupSystemSvg from 'components/common/svg_images_components/setup_system_svg';
import ExternalLink from 'components/external_link';

import {LicenseLinks} from 'utils/constants';

const TeamEditionRightPanel: React.FC = () => {
    const upgradeAdvantages = [
        'AD/LDAP Group Sync',
        'High Availability',
        'Advanced compliance',
        'And more...',
    ];

    return (
        <div className='TeamEditionRightPanel'>
            <div className='svg-image'>
                <SetupSystemSvg
                    width={197}
                    height={120}
                />
            </div>
            <div className='upgrade-title'>
                <FormattedMessage
                    id='admin.license.enterprise.upgrade'
                    defaultMessage='Upgrade to Enterprise Edition'
                />
            </div>
            <div className='upgrade-subtitle'>
                <FormattedMessage
                    id='admin.license.enterprise.license_required_upgrade'
                    defaultMessage='A license is required to unlock enterprise features'
                />
            </div>
            <div className='advantages-list'>
                {upgradeAdvantages.map((item: string, i: number) => {
                    return (
                        <div
                            className='item'
                            key={i.toString()}
                        >
                            <i className='fa fa-lock'/>{item}
                        </div>
                    );
                })}
            </div>
            <p>
                <Button
                    asChild={true}
                    emphasis='primary'
                >
                    <ExternalLink
                        href={LicenseLinks.UNSUPPORTED_UPGRADE_LINK}
                        location='team_edition_right_panel'
                        role='button'
                    >
                        <FormattedMessage
                            id='admin.licenseSettings.teamEdition.teamEditionRightPanel.learnMore'
                            defaultMessage='Learn more'
                        />
                    </ExternalLink>
                </Button>
            </p>
        </div>
    );
};

export default React.memo(TeamEditionRightPanel);
