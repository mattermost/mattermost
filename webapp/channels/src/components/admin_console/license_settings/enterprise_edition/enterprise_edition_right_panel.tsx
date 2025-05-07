// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

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
    const intl = useIntl();
    const upgradeAdvantages = [
        intl.formatMessage({
            id: 'admin.license.upgradeAdvantage.adLdapSync',
            defaultMessage: 'AD/LDAP Group sync',
        }),
        intl.formatMessage({
            id: 'admin.license.upgradeAdvantage.highAvailability',
            defaultMessage: 'High Availability',
        }),
        intl.formatMessage({
            id: 'admin.license.upgradeAdvantage.advancedCompliance',
            defaultMessage: 'Advanced compliance',
        }),
        intl.formatMessage({
            id: 'admin.license.upgradeAdvantage.advancedRoles',
            defaultMessage: 'Advanced roles and permissions',
        }),
        intl.formatMessage({
            id: 'admin.license.upgradeAdvantage.andMore',
            defaultMessage: 'And more...',
        }),
    ];

    const enterpriseToAdvancedAdvantages = [
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
                    defaultMessage='We’re here to work with you and your needs. Contact us today to get more seats on your plan.'
                />
            );
        }
        const advantages = isEnterprise ? enterpriseToAdvancedAdvantages : upgradeAdvantages;

        return (
            <div className='advantages-list'>
                {advantages.map((item, i) => {
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
