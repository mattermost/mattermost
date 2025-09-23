// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {ClientLicense} from '@mattermost/types/config';

import ContactUsButton from 'components/announcement_bar/contact_sales/contact_us';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';
import SetupSystemSvg from 'components/common/svg_images_components/setup_system';
import ExternalLink from 'components/external_link';

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
    const [openContactSales] = useOpenSalesLink();
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
    const isEntry = license?.SkuShortName === LicenseSkus.Entry;

    const contactSalesBtn = (
        <div className='purchase-card'>
            <ContactUsButton
                eventID='post_trial_contact_sales'
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
        if (isEntry) {
            return (
                <FormattedMessage
                    id='admin.license.entryPlanTitle'
                    defaultMessage='Get access to full message history, AI-powered coordination, and secure workflow continuity'
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

        // Show the setup system image for Entry SKU and other SKUs
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
        if (isEntry) {
            return (
                <FormattedMessage
                    id='admin.license.entryPlanSubtitle'
                    defaultMessage='Purchase a plan to unlock full access, or start a trial to remove limits while you evaluate Enterprise Advanced.'
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

    // For Entry SKU, render custom buttons
    if (isEntry) {
        return (
            <div className='EnterpriseEditionRightPannel entry'>
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
                    <button
                        className='btn btn-primary'
                        onClick={openContactSales}
                    >
                        <FormattedMessage
                            id='admin.license.contactSales'
                            defaultMessage='Contact sales'
                        />
                    </button>
                    <ExternalLink
                        href='https://mattermost.com/trial'
                        location='enterprise_edition_right_panel_entry_trial'
                        className='btn btn-tertiary trial-btn'
                    >
                        <FormattedMessage
                            id='admin.license.getFreeTrial'
                            defaultMessage='Get a free 30-day trial license'
                        />
                    </ExternalLink>
                </div>
            </div>
        );
    }

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
