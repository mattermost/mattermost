// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import {ClientLicense} from '@mattermost/types/config';

import {isEnterpriseOrE20License} from 'utils/license_utils';
import WomanUpArrowsAndCloudsSvg from 'components/common/svg_images_components/woman_up_arrows_and_clouds_svg';
import ContactUsButton from 'components/announcement_bar/contact_sales/contact_us';
import WomanWithCardSvg from 'components/common/svg_images_components/woman_with_card_svg';
import TwoPeopleChattingSvg from 'components/common/svg_images_components/two_people_chatting_svg';

export interface EnterpriseEditionProps {
    isTrialLicense: boolean;
    license: ClientLicense;
}

const EnterpriseEditionRightPanel = ({
    isTrialLicense,
    license,

}: EnterpriseEditionProps) => {
    const upgradeAdvantages = [
        'AD/LDAP Group sync',
        'High Availability',
        'Advanced compliance',
        'Advanced roles and permissions',
        'And more...',
    ];

    const isEnterpriseOrE20 = isEnterpriseOrE20License(license);

    const contactSalesBtn = (
        <div className='purchase-card'>
            <ContactUsButton
                eventID='post_trial_contact_sales'
                customClass='light-blue-btn'
            />
        </div>
    );

    const isGovSku = license.IsGovSku === 'true';

    const title = () => {
        if (isTrialLicense) {
            if (isGovSku) {
                return (
                    <FormattedMessage
                        id='admin.license.purchaseEnterpriseGovPlanTitle'
                        defaultMessage='Purchase the Enterprise Gov Plan'
                    />
                );
            }
            return (
                <FormattedMessage
                    id='admin.license.purchaseEnterprisePlanTitle'
                    defaultMessage='Purchase the Enterprise Plan'
                />
            );
        }
        if (isEnterpriseOrE20) {
            return (
                <FormattedMessage
                    id='admin.license.enterprisePlanTitle'
                    defaultMessage='Need to increase your headcount?'
                />
            );
        }
        if (isGovSku) {
            return (
                <FormattedMessage
                    id='admin.license.upgradeToEnterpriseGov'
                    defaultMessage='Upgrade to the Enterprise Gov Plan'
                />
            );
        }
        return (
            <FormattedMessage
                id='admin.license.upgradeToEnterprise'
                defaultMessage='Upgrade to the Enterprise Plan'
            />
        );
    };

    const svgImage = () => {
        if (isTrialLicense) {
            return (
                <WomanWithCardSvg
                    width={200}
                    height={200}
                />
            );
        }
        if (isEnterpriseOrE20) {
            return (
                <TwoPeopleChattingSvg
                    width={200}
                    height={200}
                />
            );
        }
        return (
            <WomanUpArrowsAndCloudsSvg
                width={200}
                height={200}
            />
        );
    };

    const subtitle = () => {
        if (isTrialLicense) {
            return (
                <FormattedMessage
                    id='admin.license.purchaseEnterprisePlanSubtitle'
                    defaultMessage='Continue your access to Enterprise features by purchasing a license today.'
                />
            );
        }
        if (isEnterpriseOrE20) {
            return (
                <FormattedMessage
                    id='admin.license.enterprisePlanSubtitle'
                    defaultMessage='We’re here to work with you and your needs. Contact us today to get more seats on your plan.'
                />
            );
        }
        return (
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
        );
    };

    return (
        <div className='EnterpriseEditionRightPannel'>
            <div className='svg-image'>
                {svgImage()}
            </div>
            <div className='upgrade-title'>
                {title()}
            </div>
            <div className='upgrade-subtitle'>
                {subtitle()}
            </div>
            <div className='purchase_buttons'>
                {contactSalesBtn}
            </div>
        </div>
    );
};

export default memo(EnterpriseEditionRightPanel);
