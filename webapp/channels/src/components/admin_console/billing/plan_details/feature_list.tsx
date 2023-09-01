// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {CloudProducts} from 'utils/constants';

import './feature_list.scss';

export interface FeatureListProps {
    subscriptionPlan?: string;
}

const FeatureList = (props: FeatureListProps) => {
    const intl = useIntl();

    const featuresCloudProfessional = [
        intl.formatMessage(
            {
                id: 'admin.billing.subscription.planDetails.features.fileStorage',
                defaultMessage: 'Unlimited file storage',
            },
        ),
        intl.formatMessage({
            id: 'admin.billing.subscription.planDetails.features.guestAccounts',
            defaultMessage: 'Guest Accounts',
        }),
        intl.formatMessage({
            id: 'admin.billing.subscription.planDetails.features.ldapUserSync',
            defaultMessage: 'AD/LDAP user sync',
        }),

        intl.formatMessage({
            id: 'admin.billing.subscription.planDetails.features.ssoSaml',
            defaultMessage: 'SSO w/ SAML (includes Okta and OneLogIn)',
        }),
        intl.formatMessage({
            id: 'admin.billing.subscription.planDetails.features.multiplatformSso',
            defaultMessage: 'SSO with Google, O365',
        }),
        intl.formatMessage({
            id: 'admin.billing.subscription.planDetails.features.openid',
            defaultMessage: 'OpenID',
        }),
        intl.formatMessage({
            id: 'admin.billing.subscription.planDetails.features.mfaEnforcement',
            defaultMessage: 'MFA enforcement',
        }),
        intl.formatMessage({
            id: 'admin.billing.subscription.planDetails.features.advanceTeamPermission',
            defaultMessage: 'Advanced team permissions',
        }),
        intl.formatMessage({
            id: 'admin.billing.subscription.planDetails.features.readOnlyChannels',
            defaultMessage: 'Read-only announcement channels',
        }),
        intl.formatMessage({
            id: 'admin.billing.subscription.planDetails.features.sharedChannels',
            defaultMessage: 'Shared channels (coming soon)',
        }),
    ];

    const featuresCloudEnterprise = [
        intl.formatMessage({
            id: 'admin.billing.subscription.planDetails.features.enterpriseAdminAndSso',
            defaultMessage: 'Enterprise administration & SSO',
        }),
        intl.formatMessage({
            id: 'admin.billing.subscription.planDetails.features.autoComplianceExports',
            defaultMessage: 'Automated compliance exports',
        }),
        intl.formatMessage({
            id: 'admin.billing.subscription.planDetails.features.customRetentionPolicies',
            defaultMessage: 'Custom data retention policies',
        }),
        intl.formatMessage({
            id: 'admin.billing.subscription.planDetails.features.ldapSync',
            defaultMessage: 'AD/LDAP group sync to teams & channels',
        }),
        intl.formatMessage({
            id: 'admin.billing.subscription.planDetails.features.premiumSupport',
            defaultMessage: 'Premium Support (optional upgrade)',
        }),
    ];

    let features: string[] = [];

    switch (props.subscriptionPlan) {
    case CloudProducts.PROFESSIONAL:
        features = featuresCloudProfessional;
        break;
    case CloudProducts.ENTERPRISE:
        features = featuresCloudEnterprise;
        break;
    default:
        // unknown product
        features = [];
        break;
    }

    const featureElements = features?.map((feature, i) => (
        <div
            key={`PlanDetailsFeature${i.toString()}`}
            className='PlanDetailsFeature'
        >
            <i className='icon-check'/>
            <span>{feature}</span>
        </div>
    ));

    return <>{featureElements}</>;
};

export default FeatureList;
