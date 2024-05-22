// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {
    getCloudSubscription as selectCloudSubscription,
    getSubscriptionProduct as selectSubscriptionProduct,
    getCloudProducts as selectCloudProducts,
} from 'mattermost-redux/selectors/entities/cloud';
import {deprecateCloudFree} from 'mattermost-redux/selectors/entities/preferences';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import {trackEvent} from 'actions/telemetry_actions';

import {NotifyStatus} from 'components/common/hooks/useGetNotifyAdmin';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';
import PlanLabel from 'components/common/plan_label';
import {useNotifyAdmin} from 'components/notify_admin_cta/notify_admin_cta';
import CheckMarkSvg from 'components/widgets/icons/check_mark_icon';

import {CloudProducts, LicenseSkus, MattermostFeatures, TELEMETRY_CATEGORIES, RecurringIntervals} from 'utils/constants';
import {findOnlyYearlyProducts, findProductBySku} from 'utils/products';

import Card, {BlankCard, ButtonCustomiserClasses} from './card';
import ContactSalesCTA from './contact_sales_cta';
import StartTrialCaution from './start_trial_caution';

import './content.scss';

type ContentProps = {
    onHide: () => void;

    // callerCTA is information about the cta that opened this modal. This helps us provide a telemetry path
    // showing information about how the modal was opened all the way to more CTAs within the modal itself
    callerCTA?: string;
}

function Content(props: ContentProps) {
    const {formatMessage, formatNumber} = useIntl();

    const isAdmin = useSelector(isCurrentUserSystemAdmin);

    const subscription = useSelector(selectCloudSubscription);
    const currentProduct = useSelector(selectSubscriptionProduct);
    const products = useSelector(selectCloudProducts);

    const cloudFreeDeprecated = useSelector(deprecateCloudFree);
    const yearlyProducts = findOnlyYearlyProducts(products || {}); // pricing modal should now only show yearly products

    const currentSubscriptionIsMonthly = currentProduct?.recurring_interval === RecurringIntervals.MONTH;
    const isEnterprise = currentProduct?.sku === CloudProducts.ENTERPRISE;
    const isEnterpriseTrial = subscription?.is_free_trial === 'true';
    const yearlyProfessionalProduct = findProductBySku(yearlyProducts, CloudProducts.PROFESSIONAL);
    const professionalPrice = formatNumber((yearlyProfessionalProduct?.price_per_seat || 0) / 12, {maximumFractionDigits: 2});

    const isProfessional = currentProduct?.sku === CloudProducts.PROFESSIONAL;
    const currentSubscriptionIsMonthlyProfessional = currentSubscriptionIsMonthly && isProfessional;

    const isPreTrial = subscription?.trial_end_at === 0;

    let isPostTrial = false;
    if ((subscription && subscription.trial_end_at > 0) && !isEnterpriseTrial && isEnterprise) {
        isPostTrial = true;
    }

    const [notifyAdminBtnTextEnterprise, notifyAdminOnEnterpriseFeatures, enterpriseNotifyRequestStatus] = useNotifyAdmin({
        ctaText: formatMessage({id: 'pricing_modal.noitfy_cta.request', defaultMessage: 'Request admin to upgrade'}),
        successText: (
            <>
                <i className='icon icon-check'/>
                {formatMessage({id: 'pricing_modal.noitfy_cta.request_success', defaultMessage: 'Request sent'})}
            </>),
    }, {
        required_feature: MattermostFeatures.ALL_ENTERPRISE_FEATURES,
        required_plan: LicenseSkus.Enterprise,
        trial_notification: isPreTrial,
    });

    const getAdminProfessionalBtnText = () => {
        if (currentSubscriptionIsMonthlyProfessional) {
            return formatMessage({id: 'pricing_modal.btn.switch_to_annual', defaultMessage: 'Switch to annual billing'});
        }

        return formatMessage({id: 'pricing_modal.btn.purchase', defaultMessage: 'Purchase'});
    };

    const adminProfessionalTierText = getAdminProfessionalBtnText();

    const [openContactSales] = useOpenSalesLink();

    const professionalBtnDetails = () => {
        return {
            action: () => { },
            text: adminProfessionalTierText,
            disabled: true,
            customClass: (isPostTrial) ? ButtonCustomiserClasses.special : ButtonCustomiserClasses.active,
        };
    };

    const enterpriseBtnDetails = () => {
        if (isAdmin) {
            return {
                action: () => {
                    trackEvent(TELEMETRY_CATEGORIES.CLOUD_PRICING, 'click_enterprise_contact_sales');
                    openContactSales();
                },
                text: formatMessage({id: 'pricing_modal.btn.contactSales', defaultMessage: 'Contact Sales'}),
                customClass: ButtonCustomiserClasses.special,
            };
        }

        let trialBtnClass = ButtonCustomiserClasses.special;
        if (isPostTrial) {
            trialBtnClass = ButtonCustomiserClasses.special;
        } else {
            trialBtnClass = ButtonCustomiserClasses.active;
        }

        if (enterpriseNotifyRequestStatus === NotifyStatus.Success) {
            trialBtnClass = ButtonCustomiserClasses.green;
        }
        return {
            action: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
                notifyAdminOnEnterpriseFeatures(e, 'enterprise_plan_pricing_modal_card');
            },
            text: notifyAdminBtnTextEnterprise,
            disabled: isEnterprise,
            customClass: trialBtnClass,
        };
    };

    const professionalPlanLabelText = () => {
        if (isProfessional || !isAdmin) {
            return formatMessage({id: 'pricing_modal.planLabel.currentPlan', defaultMessage: 'CURRENT PLAN'});
        }

        return formatMessage({id: 'pricing_modal.planLabel.currentPlanMonthly', defaultMessage: 'CURRENTLY ON MONTHLY BILLING'});
    };

    return (
        <div className='Content'>
            <Modal.Header className='PricingModal__header'>
                <div className='header_lhs'>
                    <h1 className='title'>
                        {formatMessage({id: 'pricing_modal.title', defaultMessage: 'Select a plan'})}
                    </h1>
                    <div>{formatMessage({id: 'pricing_modal.subtitle', defaultMessage: 'Choose a plan to get started'})}</div>
                </div>
                <button
                    id='closeIcon'
                    className='close'
                    aria-label='Close'
                    title='Close'
                    onClick={props.onHide}
                >
                    <span aria-hidden='true'>{'×'}</span>
                </button>
            </Modal.Header>
            <Modal.Body>
                <div
                    className='PricingModal__body'
                    style={{marginTop: '74px'}}
                >
                    {isProfessional &&
                    <Card
                        id='professional'
                        topColor='var(--denim-button-bg)'
                        plan='Professional'
                        planSummary={formatMessage({id: 'pricing_modal.planSummary.professional', defaultMessage: 'Scalable solutions {br} for growing teams'}, {
                            br: <br/>,
                        })}
                        price={`$${professionalPrice}`}
                        rate={formatMessage({id: 'pricing_modal.rate.seatPerMonth', defaultMessage: 'USD per seat/month {br}<b>(billed annually)</b>'}, {
                            br: <br/>,
                            b: (chunks: React.ReactNode | React.ReactNodeArray) => (
                                <span className='billed_annually'>
                                    {chunks}
                                </span>
                            ),
                        })}
                        isCloud={true}
                        planLabel={isProfessional ? (
                            <PlanLabel
                                text={professionalPlanLabelText()}
                                color='var(--denim-status-online)'
                                bgColor='var(--center-channel-bg)'
                                firstSvg={<CheckMarkSvg/>}
                            />) : undefined}
                        buttonDetails={professionalBtnDetails()}
                        briefing={{
                            title: formatMessage({id: 'pricing_modal.briefing.title_no_limit', defaultMessage: 'No limits on your team’s usage'}),
                            items: [
                                formatMessage({id: 'pricing_modal.briefing.professional.messageBoardsIntegrationsCalls', defaultMessage: 'Unlimited access to messages and files'}),
                                formatMessage({id: 'pricing_modal.briefing.professional.unLimitedTeams', defaultMessage: 'Unlimited teams'}),
                                formatMessage({id: 'pricing_modal.briefing.professional.advancedPlaybook', defaultMessage: 'Advanced Playbook workflows with retrospectives'}),
                                formatMessage({id: 'pricing_modal.extra_briefing.professional.ssoSaml', defaultMessage: 'SSO with SAML 2.0, including Okta, OneLogin, and ADFS'}),
                                formatMessage({id: 'pricing_modal.extra_briefing.professional.ssoadLdap', defaultMessage: 'SSO support with AD/LDAP, Google, O365, OpenID'}),
                                formatMessage({id: 'pricing_modal.extra_briefing.professional.guestAccess', defaultMessage: 'Guest access with MFA enforcement'}),
                            ],
                        }}
                    />}

                    <Card
                        id='enterprise'
                        topColor='#E07315'
                        plan='Enterprise'
                        planSummary={formatMessage({id: 'pricing_modal.planSummary.enterprise', defaultMessage: 'Administration, security, and compliance for large teams'})}
                        isCloud={true}
                        planLabel={
                            isEnterprise ? (
                                <PlanLabel
                                    text={formatMessage({id: 'pricing_modal.planLabel.currentPlan', defaultMessage: 'CURRENT PLAN'})}
                                    color='var(--denim-status-online)'
                                    bgColor='var(--center-channel-bg)'
                                    firstSvg={<CheckMarkSvg/>}
                                    renderLastDaysOnTrial={true}
                                />) : undefined}
                        buttonDetails={enterpriseBtnDetails()}
                        planTrialDisclaimer={(!isPostTrial && isAdmin && !cloudFreeDeprecated) ? <StartTrialCaution/> : undefined}
                        contactSalesCTA={(isPostTrial || !isAdmin || cloudFreeDeprecated) ? undefined : <ContactSalesCTA/>}
                        briefing={{
                            title: cloudFreeDeprecated ? formatMessage({id: 'pricing_modal.briefing.title_large_scale', defaultMessage: 'Large scale collaboration'}) : formatMessage({id: 'pricing_modal.briefing.title', defaultMessage: 'Top features'}),
                            items: [
                                formatMessage({id: 'pricing_modal.briefing.enterprise.groupSync', defaultMessage: 'AD/LDAP group sync'}),
                                formatMessage({id: 'pricing_modal.briefing.enterprise.rolesAndPermissions', defaultMessage: 'Advanced roles and permissions'}),
                                formatMessage({id: 'pricing_modal.briefing.enterprise.advancedComplianceManagement', defaultMessage: 'Advanced compliance management'}),
                                formatMessage({id: 'pricing_modal.briefing.enterprise.mobileSecurity', defaultMessage: 'Advanced mobile security via ID-only push notifications'}),
                                formatMessage({id: 'pricing_modal.extra_briefing.enterprise.playBookAnalytics', defaultMessage: 'Playbook analytics dashboard'}),
                            ],
                        }}
                        planAddonsInfo={{
                            title: formatMessage({id: 'pricing_modal.addons.title', defaultMessage: 'Available Add-ons'}),
                            items: [
                                {title: formatMessage({id: 'pricing_modal.addons.premiumSupport', defaultMessage: 'Premium support'})},
                                {title: formatMessage({id: 'pricing_modal.addons.missionCritical', defaultMessage: 'Mission-critical 24x7'})},
                                {title: '1hr-L1, 2hr-L2'},
                                {title: formatMessage({id: 'pricing_modal.addons.USSupport', defaultMessage: 'U.S.- only based support'})},
                                {title: formatMessage({id: 'pricing_modal.addons.dedicatedDeployment', defaultMessage: 'Dedicated virtual secure cloud deployment (Cloud)'})},
                                {title: formatMessage({id: 'pricing_modal.addons.dedicatedK8sCluster', defaultMessage: 'Dedicated Kubernetes cluster'})},
                                {title: formatMessage({id: 'pricing_modal.addons.dedicatedDB', defaultMessage: 'Dedicated database'})},
                                {title: formatMessage({id: 'pricing_modal.addons.dedicatedEncryption', defaultMessage: 'Dedicated encryption keys'})},
                                {title: formatMessage({id: 'pricing_modal.addons.uptimeGuarantee', defaultMessage: '99% uptime guarantee'})},
                            ],
                        }}
                    />
                    <BlankCard/>
                </div>
            </Modal.Body>
        </div>
    );
}

export default Content;
