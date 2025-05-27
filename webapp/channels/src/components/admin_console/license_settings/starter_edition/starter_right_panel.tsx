// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import ContactUsButton from 'components/announcement_bar/contact_sales/contact_us';
import SetupSystemSvg from 'components/common/svg_images_components/setup_system';

const StarterRightPanel = () => {
    const intl = useIntl();
    const upgradeAdvantages = [
        intl.formatMessage({
            id: 'admin.license.enterpriseToAdvancedAdvantage.attributeBasedAccess',
            defaultMessage: 'Attribute-based access control',
        }),
        intl.formatMessage({
            id: 'admin.license.enterpriseToAdvancedAdvantage.channelWarningBanners',
            defaultMessage: 'Channel warning banners',
        }),
        intl.formatMessage({
            id: 'admin.license.enterpriseToAdvancedAdvantage.adLdapGroupSync',
            defaultMessage: 'AD/LDAP group sync',
        }),
        intl.formatMessage({
            id: 'admin.license.enterpriseToAdvancedAdvantage.advancedWorkflows',
            defaultMessage: 'Advanced workflows with Playbooks',
        }),
        intl.formatMessage({
            id: 'admin.license.enterpriseToAdvancedAdvantage.highAvailability',
            defaultMessage: 'High availability',
        }),
        intl.formatMessage({
            id: 'admin.license.enterpriseToAdvancedAdvantage.advancedCompliance',
            defaultMessage: 'Advanced compliance',
        }),
        intl.formatMessage({
            id: 'admin.license.upgradeAdvantage.andMore',
            defaultMessage: 'And more...',
        }),
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
                            {item}
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
