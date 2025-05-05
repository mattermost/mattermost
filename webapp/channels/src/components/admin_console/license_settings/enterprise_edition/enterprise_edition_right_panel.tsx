// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import type {ClientLicense} from '@mattermost/types/config';

import ContactUsButton from 'components/announcement_bar/contact_sales/contact_us';
import SetupSystemSvg from 'components/common/svg_images_components/setup_system';

import {LicenseSkus} from 'utils/constants';

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

    const enterpriseToAdvancedAdvantages = [
        'Attribute-based access control',
        'Channel warning banners',
        'AD/LDAP group sync',
        'Advanced workflows with Playbooks',
        'High availability',
        'Advanced compliance',
        'And more...',
    ];

    const isEnterpriseAdvanced = license?.SkuShortName === LicenseSkus.EnterpriseAdvanced;
    const isEnterprise = license?.SkuShortName === LicenseSkus.Enterprise;
    const isProfessional = license?.SkuShortName === LicenseSkus.Professional;

    const contactSalesBtn = (
        <div className='purchase-card'>
            <ContactUsButton
                eventID='post_trial_contact_sales'
                customClass='light-blue-btn'
            />
        </div>
    );

    const title = () => {
        if (isTrialLicense) {
            return (
                <FormattedMessage
                    id='admin.license.purchaseEnterprisePlanTitle'
                    defaultMessage='Purchase Enterprise Advanced'
                />
            );
        }
        if (isEnterpriseAdvanced) {
            return (
                <FormattedMessage
                    id='admin.license.enterprisePlanTitle'
                    defaultMessage='Need to increase your headcount?'
                />
            );
        }
        if (isEnterprise) {
            return (
                <FormattedMessage
                    id='admin.license.upgradeToEnterpriseAdvanced'
                    defaultMessage='Upgrade to Enterprise Advanced'
                />
            );
        }
        if (isProfessional) {
            return (
                <FormattedMessage
                    id='admin.license.upgradeToEnterprise'
                    defaultMessage='Upgrade to Enterprise'
                />
            );
        }
        return (
            <FormattedMessage
                id='admin.license.upgradeToEnterprise'
                defaultMessage='Upgrade to Enterprise'
            />
        );
    };

    const svgImage = () => {
        if (isEnterpriseAdvanced) {
            return null; //No image
        }
        return (
            <SetupSystemSvg
                width={197}
                height={120}
            />
        );
    };

    const subtitle = () => {
        if (isTrialLicense) {
            return (
                <FormattedMessage
                    id='admin.license.purchaseEnterprisePlanSubtitle'
                    defaultMessage='Continue your access to Enterprise Advanced features by purchasing a license.'
                />
            );
        }
        if (isEnterpriseAdvanced) {
            return (
                <FormattedMessage
                    id='admin.license.enterprisePlanSubtitle'
                    defaultMessage="We're here to work with you and your needs. Contact us today to get more seats on your plan."
                />
            );
        }
        const advantages = isEnterprise ? enterpriseToAdvancedAdvantages : upgradeAdvantages;

        return (
            <div className='advantages-list'>
                {advantages.map((item: string, i: number) => {
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
