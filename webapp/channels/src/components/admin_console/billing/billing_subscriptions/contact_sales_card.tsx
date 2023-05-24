// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {trackEvent} from 'actions/telemetry_actions';

import {CloudLinks, CloudProducts} from 'utils/constants';
import PrivateCloudSvg from 'components/common/svg_images_components/private_cloud_svg';
import CloudTrialSvg from 'components/common/svg_images_components/cloud_trial_svg';
import {TelemetryProps} from 'components/common/hooks/useOpenPricingModal';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';
import ExternalLink from 'components/external_link';

type Props = {
    isFreeTrial: boolean;
    subscriptionPlan: string | undefined;
    onUpgradeMattermostCloud: (telemetryProps?: TelemetryProps | undefined) => void;
}

const ContactSalesCard = (props: Props) => {
    const [openSalesLink, contactSalesLink] = useOpenSalesLink();
    const {
        isFreeTrial,
        subscriptionPlan,
        onUpgradeMattermostCloud,
    } = props;
    let title;
    let description;

    const pricingLink = (
        <ExternalLink
            location='contact_sales_card'
            href={CloudLinks.PRICING}
            rel='noopener noreferrer'
            onClick={() => trackEvent('cloud_admin', 'click_pricing_link')}
        >
            {CloudLinks.PRICING}
        </ExternalLink>
    );

    const isCloudLegacyPlan = subscriptionPlan === CloudProducts.LEGACY;

    if (isFreeTrial) {
        title = (
            <FormattedMessage
                id='admin.billing.subscription.privateCloudCard.freeTrial.title'
                defaultMessage='Questions about your trial?'
            />
        );
        description = (
            <FormattedMessage
                id='admin.billing.subscription.privateCloudCard.freeTrial.description'
                defaultMessage='We love to work with our customers and their needs. Contact sales for subscription, billing or trial-specific questions.'
            />
        );
    } else if (isCloudLegacyPlan) {
        title = (
            <FormattedMessage
                id='admin.billing.subscription.privateCloudCard.cloudEnterprise.title'
                defaultMessage='Looking to rollout Mattermost for your entire organization? '
            />
        );
        description = (
            <FormattedMessage
                id='admin.billing.subscription.privateCloudCard.cloudEnterprise.description'
                defaultMessage='At Mattermost, we work with you and your organization to meet your needs throughout the product. If you’re considering a wider rollout, talk to us.'
            />
        );
    } else {
        switch (subscriptionPlan) {
        case CloudProducts.STARTER:
            title = (
                <FormattedMessage
                    id='admin.billing.subscription.privateCloudCard.cloudFree.title'
                    defaultMessage='Upgrade to Cloud Professional'
                />
            );
            description = (
                <FormattedMessage
                    id='admin.billing.subscription.privateCloudCard.cloudFree.description'
                    defaultMessage='Optimize your processes with Guest Accounts, Office365 suite integrations, GitLab SSO and advanced permissions.'
                />
            );
            break;
        case CloudProducts.PROFESSIONAL:
            title = (
                <FormattedMessage
                    id='admin.billing.subscription.privateCloudCard.cloudProfessional.title'
                    defaultMessage='Upgrade to Cloud Enterprise'
                />
            );
            description = (
                <FormattedMessage
                    id='admin.billing.subscription.privateCloudCard.cloudProfessional.description'
                    defaultMessage='Advanced security and compliance features with premium support. See {pricingLink} for more details.'
                    values={{pricingLink}}
                />
            );
            break;
        case CloudProducts.ENTERPRISE:
            title = (
                <FormattedMessage
                    id='admin.billing.subscription.privateCloudCard.cloudEnterprise.title'
                    defaultMessage='Looking to rollout Mattermost for your entire organization? '
                />
            );
            description = (
                <FormattedMessage
                    id='admin.billing.subscription.privateCloudCard.cloudEnterprise.description'
                    defaultMessage='At Mattermost, we work with you and your organization to meet your needs throughout the product. If you’re considering a wider rollout, talk to us.'
                />
            );
            break;
        default:
            title = (
                <FormattedMessage
                    id='admin.billing.subscription.privateCloudCard.cloudProfessional.title'
                    defaultMessage='Upgrade to Cloud Enterprise'
                />
            );
            description = (
                <FormattedMessage
                    id='admin.billing.subscription.privateCloudCard.cloudProfessional.description'
                    defaultMessage='Advanced security and compliance features with premium support. See {pricingLink} for more details.'
                    values={{pricingLink}}
                />
            );
            break;
        }
    }

    return (
        <div className='PrivateCloudCard'>
            <div className='PrivateCloudCard__text'>
                <div className='PrivateCloudCard__text-title'>
                    {title}
                </div>
                <div className='PrivateCloudCard__text-description'>
                    {description}
                </div>
                {(isFreeTrial || subscriptionPlan === CloudProducts.ENTERPRISE || isCloudLegacyPlan) &&
                    <ExternalLink
                        location='contact_sales_card'
                        href={contactSalesLink}
                        className='PrivateCloudCard__actionButton'
                        onClick={() => trackEvent('cloud_admin', 'click_contact_sales')}
                    >
                        <FormattedMessage
                            id='admin.billing.subscription.privateCloudCard.contactSales'
                            defaultMessage='Contact Sales'
                        />

                    </ExternalLink>
                }
                {(!isFreeTrial && subscriptionPlan !== CloudProducts.ENTERPRISE && subscriptionPlan !== CloudProducts.LEGACY) &&
                    <button
                        type='button'
                        onClick={() => {
                            if (subscriptionPlan === CloudProducts.STARTER) {
                                onUpgradeMattermostCloud({trackingLocation: 'admin_console_subscription_card_upgrade_now_button'});
                            } else {
                                openSalesLink();
                            }
                        }}
                        className='PrivateCloudCard__actionButton'
                    >
                        {subscriptionPlan === CloudProducts.STARTER ? (
                            <FormattedMessage
                                id='admin.billing.subscription.privateCloudCard.upgradeNow'
                                defaultMessage='Upgrade Now'
                            />
                        ) : (
                            <FormattedMessage
                                id='admin.billing.subscription.privateCloudCard.contactSales'
                                defaultMessage='Contact Sales'
                            />
                        )

                        }

                    </button>
                }
            </div>
            <div className='PrivateCloudCard__image'>
                {isFreeTrial ? (
                    <CloudTrialSvg
                        width={170}
                        height={123}
                    />
                ) : (
                    <PrivateCloudSvg
                        width={170}
                        height={123}
                    />
                )
                }
            </div>
        </div>
    );
};

export default ContactSalesCard;
