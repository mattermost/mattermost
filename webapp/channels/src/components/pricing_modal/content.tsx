// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {CloudProducts, LicenseSkus, MattermostFeatures, RecurringIntervals} from 'utils/constants';
import {findOnlyYearlyProducts, findProductBySku} from 'utils/products';

import {
    getCloudSubscription as selectCloudSubscription,
    getSubscriptionProduct as selectSubscriptionProduct,
    getCloudProducts as selectCloudProducts,
} from 'mattermost-redux/selectors/entities/cloud';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import CheckMarkSvg from 'components/widgets/icons/check_mark_icon';
import PlanLabel from 'components/common/plan_label';
import {useNotifyAdmin} from 'components/notify_admin_cta/notify_admin_cta';
import {NotifyStatus} from 'components/common/hooks/useGetNotifyAdmin';
import useOpenCloudPurchaseModal from 'components/common/hooks/useOpenCloudPurchaseModal';

import StartTrialCaution from './start_trial_caution';
import Card, {ButtonCustomiserClasses, BlankCard} from './card';

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
    const yearlyProducts = findOnlyYearlyProducts(products || {}); // pricing modal should now only show yearly products

    const currentSubscriptionIsMonthly = currentProduct?.recurring_interval === RecurringIntervals.MONTH;
    const isEnterprise = currentProduct?.sku === CloudProducts.ENTERPRISE;
    const isEnterpriseTrial = subscription?.is_free_trial === 'true';
    const yearlyProfessionalProduct = findProductBySku(yearlyProducts, CloudProducts.PROFESSIONAL);
    const professionalPrice = formatNumber((yearlyProfessionalProduct?.price_per_seat || 0) / 12, {maximumFractionDigits: 2});

    const isStarter = currentProduct?.sku === CloudProducts.STARTER;
    const isProfessional = currentProduct?.sku === CloudProducts.PROFESSIONAL;
    const currentSubscriptionIsMonthlyProfessional = currentSubscriptionIsMonthly && isProfessional;
    const isProfessionalAnnual = isProfessional && currentProduct?.recurring_interval === RecurringIntervals.YEAR;

    const isPreTrial = subscription?.trial_end_at === 0;

    let isPostTrial = false;
    if ((subscription && subscription.trial_end_at > 0) && !isEnterpriseTrial && (isStarter || isEnterprise)) {
        isPostTrial = true;
    }

    const [notifyAdminBtnTextProfessional, notifyAdminOnProfessionalFeatures, professionalNotifyRequestStatus] = useNotifyAdmin({
        ctaText: formatMessage({id: 'pricing_modal.noitfy_cta.request', defaultMessage: 'Request admin to upgrade'}),
        successText: (
            <>
                <i className='icon icon-check'/>
                {formatMessage({id: 'pricing_modal.noitfy_cta.request_success', defaultMessage: 'Request sent'})}
            </>),
    }, {
        required_feature: MattermostFeatures.ALL_PROFESSIONAL_FEATURES,
        required_plan: LicenseSkus.Professional,
        trial_notification: false,
    });

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

    const adminProfessionalTierText = currentSubscriptionIsMonthlyProfessional ? formatMessage({id: 'pricing_modal.btn.switch_to_annual', defaultMessage: 'Switch to annual billing'}) : formatMessage({id: 'pricing_modal.btn.purchase', defaultMessage: 'Purchase'});

    const openCloudPurchaseModal = useOpenCloudPurchaseModal({});
    const openCloudDelinquencyModal = useOpenCloudPurchaseModal({
        isDelinquencyModal: true,
    });

    const openPurchaseModal = (callerInfo: string) => {
        props.onHide();
        const telemetryInfo = props.callerCTA + ' > ' + callerInfo;
        if (subscription?.delinquent_since) {
            openCloudDelinquencyModal({trackingLocation: telemetryInfo});
        }
        openCloudPurchaseModal({trackingLocation: telemetryInfo});
    };

    const professionalBtnDetails = () => {
        if (isAdmin) {
            return {
                action: () => openPurchaseModal('click_pricing_modal_professional_card_upgrade_button'),
                text: adminProfessionalTierText,
                disabled: isProfessionalAnnual || (isEnterprise && !isEnterpriseTrial),
                customClass: isPostTrial ? ButtonCustomiserClasses.special : ButtonCustomiserClasses.active,
            };
        }

        let trialBtnClass = ButtonCustomiserClasses.special;
        if (isPostTrial) {
            trialBtnClass = ButtonCustomiserClasses.special;
        } else {
            trialBtnClass = ButtonCustomiserClasses.active;
        }

        if (professionalNotifyRequestStatus === NotifyStatus.Success) {
            trialBtnClass = ButtonCustomiserClasses.green;
        }
        return {
            action: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
                notifyAdminOnProfessionalFeatures(e, 'professional_plan_pricing_modal_card');
            },
            text: notifyAdminBtnTextProfessional,
            disabled: isProfessional || (isEnterprise && !isEnterpriseTrial),
            customClass: trialBtnClass,
        };
    };

    const enterpriseBtnDetails = () => {
        if (isAdmin) {
            return {
                action: () => openPurchaseModal('click_pricing_modal_enterprise_card_upgrade_button'),
                text: formatMessage({id: 'pricing_modal.btn.purchase', defaultMessage: 'Purchase'}),
                disabled: (isEnterprise && !isEnterpriseTrial),
                customClass: isEnterpriseTrial ? ButtonCustomiserClasses.special : ButtonCustomiserClasses.active,
            };
        }

        if (!isAdmin) {
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
        }

        return undefined;
    };

    const professionalPlanLabelText = () => {
        if (isProfessionalAnnual || !isAdmin) {
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
                    className='icon icon-close'
                    aria-label='Close'
                    title='Close'
                    onClick={props.onHide}
                />
            </Modal.Header>
            <Modal.Body>
                <div className='PricingModal__body'>
                    <Card
                        id='professional'
                        plan='Professional'
                        planSummary={formatMessage({id: 'pricing_modal.planSummary.professional', defaultMessage: 'Scalable solutions for growing teams'})}
                        price={`$${professionalPrice}`}
                        rate={formatMessage({id: 'pricing_modal.rate.userPerMonth', defaultMessage: 'USD per user/month {br}<b>(billed annually)</b>'}, {
                            br: <br/>,
                            b: (chunks: React.ReactNode | React.ReactNodeArray) => (
                                <span style={{fontSize: '14px'}}>
                                    <b>{chunks}</b>
                                </span>
                            ),
                        })}
                        planLabel={isProfessional ? (
                            <PlanLabel
                                text={professionalPlanLabelText()}
                                color='var(--denim-status-online)'
                                bgColor='var(--center-channel-bg)'
                                firstSvg={<CheckMarkSvg/>}
                            />) : undefined}
                        buttonDetails={professionalBtnDetails()}
                        briefing={{
                            title: formatMessage({id: 'pricing_modal.briefing.title', defaultMessage: 'Top features'}),
                            items: [
                                formatMessage({id: 'pricing_modal.briefing.professional.messageBoardsIntegrationsCalls', defaultMessage: 'Unlimited access to messages and files'}),
                                formatMessage({id: 'pricing_modal.briefing.professional.unLimitedTeams', defaultMessage: 'Unlimited teams'}),
                                formatMessage({id: 'pricing_modal.briefing.professional.advancedPlaybook', defaultMessage: 'Advanced Playbook workflows with retrospectives'}),
                                formatMessage({id: 'pricing_modal.extra_briefing.professional.ssoSaml', defaultMessage: 'SSO with SAML 2.0, including Okta, OneLogin, and ADFS'}),
                                formatMessage({id: 'pricing_modal.extra_briefing.professional.ssoadLdap', defaultMessage: 'SSO support with AD/LDAP, Google, O365, OpenID'}),
                                formatMessage({id: 'pricing_modal.extra_briefing.professional.guestAccess', defaultMessage: 'Guest access with MFA enforcement'}),
                            ],
                        }}
                        planAddonsInfo={{
                            title: formatMessage({id: 'pricing_modal.addons.title', defaultMessage: 'Available Add-ons'}),
                            items: [
                                {
                                    title: formatMessage({id: 'pricing_modal.addons.professionalPlusSupport', defaultMessage: 'Professional-Plus Support'}),
                                    items: [
                                        formatMessage({id: 'pricing_modal.addons.247Coverage', defaultMessage: '24x7 coverage'}),
                                        formatMessage({id: 'pricing_modal.addons.4hourL1L2Response', defaultMessage: '4 hour L1&L2 response'}),
                                    ],
                                },
                            ],
                        }}
                    />

                    <Card
                        id='enterprise'
                        plan='Enterprise'
                        planSummary={formatMessage({id: 'pricing_modal.planSummary.enterprise', defaultMessage: 'Administration, security, and compliance for large teams'})}
                        price={`$${25}`}
                        rate={formatMessage({id: 'pricing_modal.rate.userPerMonth', defaultMessage: 'USD per user/month {br}<b>(billed annually)</b>'}, {
                            br: <br/>,
                            b: (chunks: React.ReactNode | React.ReactNodeArray) => (
                                <span style={{fontSize: '14px'}}>
                                    <b>{chunks}</b>
                                </span>
                            ),
                        })}
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
                        planTrialDisclaimer={(!isPostTrial && isAdmin) ? <StartTrialCaution/> : undefined}
                        briefing={{
                            title: formatMessage({id: 'pricing_modal.briefing.title', defaultMessage: 'Top features'}),
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
