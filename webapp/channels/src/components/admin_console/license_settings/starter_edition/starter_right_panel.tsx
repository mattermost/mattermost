// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import ContactUsButton from 'components/announcement_bar/contact_sales/contact_us';
import SetupSystemSvg from 'components/common/svg_images_components/setup_system';

const StarterRightPanel = () => {
    const upgradeAdvantages = [
        {
            id: 'admin.license.enterpriseToAdvancedAdvantage.attributeBasedAccess',
            defaultMessage: 'Attribute-based access control',
        },
        {
            id: 'admin.license.enterpriseToAdvancedAdvantage.channelWarningBanners',
            defaultMessage: 'Channel warning banners',
        },
        {
            id: 'admin.license.enterpriseToAdvancedAdvantage.adLdapGroupSync',
            defaultMessage: 'AD/LDAP group sync',
        },
        {
            id: 'admin.license.enterpriseToAdvancedAdvantage.advancedWorkflows',
            defaultMessage: 'Advanced workflows with Playbooks',
        },
        {
            id: 'admin.license.enterpriseToAdvancedAdvantage.highAvailability',
            defaultMessage: 'High availability',
        },
        {
            id: 'admin.license.enterpriseToAdvancedAdvantage.advancedCompliance',
            defaultMessage: 'Advanced compliance',
        },
        {
            id: 'admin.license.upgradeAdvantage.andMore',
            defaultMessage: 'And more...',
        },
    ];

    return (
        <div className='StarterEditionRightPannel'>
            <div className='svg-image'>
                <SetupSystemSvg
                    width={197}
                    height={120}
                />
            </div>
            <div className='upgrade-title'>
                <FormattedMessage
                    id='admin.license.upgradeTitle'
                    defaultMessage='Purchase one of our plans to unlock more features'
                />
            </div>
            <div className='advantages-list'>
                {upgradeAdvantages.map((item, i) => {
                    return (
                        <div
                            className='item'
                            key={i.toString()}
                        >
                            <i className='fa fa-lock'/>
                            <FormattedMessage
                                id={item.id}
                                defaultMessage={item.defaultMessage}
                            />
                        </div>
                    );
                })}
            </div>
            <div className='purchase_buttons'>
                <ContactUsButton
                    eventID='post_trial_contact_sales'
                />
            </div>
        </div>
    );
};

export default memo(StarterRightPanel);
