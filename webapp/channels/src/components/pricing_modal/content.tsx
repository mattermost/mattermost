// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {Feedback} from '@mattermost/types/cloud';

import {
    getCloudSubscription as selectCloudSubscription,
    getSubscriptionProduct as selectSubscriptionProduct,
    getCloudProducts as selectCloudProducts,
} from 'mattermost-redux/selectors/entities/cloud';
import {deprecateCloudFree} from 'mattermost-redux/selectors/entities/preferences';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';
import type {DispatchFunc} from 'mattermost-redux/types/actions';

import {subscribeCloudSubscription} from 'actions/cloud';
import {trackEvent} from 'actions/telemetry_actions';
import {closeModal, openModal} from 'actions/views/modals';

import CloudStartTrialButton from 'components/cloud_start_trial/cloud_start_trial_btn';
import ErrorModal from 'components/cloud_subscribe_result_modal/error';
import SuccessModal from 'components/cloud_subscribe_result_modal/success';
import useGetLimits from 'components/common/hooks/useGetLimits';
import {NotifyStatus} from 'components/common/hooks/useGetNotifyAdmin';
import useOpenCloudPurchaseModal from 'components/common/hooks/useOpenCloudPurchaseModal';
import useOpenDowngradeModal from 'components/common/hooks/useOpenDowngradeModal';
import useOpenPricingModal from 'components/common/hooks/useOpenPricingModal';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';
import {useOpenCloudZendeskSupportForm} from 'components/common/hooks/useOpenZendeskForm';
import PlanLabel from 'components/common/plan_label';
import ExternalLink from 'components/external_link';
import DowngradeFeedbackModal from 'components/feedback_modal/downgrade_feedback';
import {useNotifyAdmin} from 'components/notify_admin_cta/notify_admin_cta';
import CheckMarkSvg from 'components/widgets/icons/check_mark_icon';

import {CloudLinks, CloudProducts, LicenseSkus, ModalIdentifiers, MattermostFeatures, TELEMETRY_CATEGORIES, RecurringIntervals} from 'utils/constants';
import {fallbackStarterLimits, asGBString, hasSomeLimits} from 'utils/limits';
import {findOnlyYearlyProducts, findProductBySku} from 'utils/products';

import Card, {BlankCard, ButtonCustomiserClasses} from './card';
import ContactSalesCTA from './contact_sales_cta';
import StartTrialCaution from './start_trial_caution';
import StarterDisclaimerCTA from './starter_disclaimer_cta';

import './content.scss';

type ContentProps = {
    onHide: () => void;

    // callerCTA is information about the cta that opened this modal. This helps us provide a telemetry path
    // showing information about how the modal was opened all the way to more CTAs within the modal itself
    callerCTA?: string;
}

function Content(props: ContentProps) {
    const {formatMessage, formatNumber} = useIntl();
    const dispatch = useDispatch<DispatchFunc>();
    const [limits] = useGetLimits();
    const openPricingModalBackAction = useOpenPricingModal();

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

    const starterProduct = Object.values(products || {}).find(((product) => {
        return product.sku === CloudProducts.STARTER;
    }));

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

    const getAdminProfessionalBtnText = () => {
        if (currentSubscriptionIsMonthlyProfessional) {
            return formatMessage({id: 'pricing_modal.btn.switch_to_annual', defaultMessage: 'Switch to annual billing'});
        }

        if (cloudFreeDeprecated) {
            return formatMessage({id: 'pricing_modal.btn.purchase', defaultMessage: 'Purchase'});
        }

        return formatMessage({id: 'pricing_modal.btn.upgrade', defaultMessage: 'Upgrade'});
    };

    const freeTierText = (!isStarter && !currentSubscriptionIsMonthly) ? formatMessage({id: 'pricing_modal.btn.contactSupport', defaultMessage: 'Contact Support'}) : formatMessage({id: 'pricing_modal.btn.downgrade', defaultMessage: 'Downgrade'});
    const adminProfessionalTierText = getAdminProfessionalBtnText();

    const [openContactSales] = useOpenSalesLink();
    const [openContactSupport] = useOpenCloudZendeskSupportForm('Workspace downgrade', '');
    const openCloudPurchaseModal = useOpenCloudPurchaseModal({});
    const openCloudDelinquencyModal = useOpenCloudPurchaseModal({
        isDelinquencyModal: true,
    });
    const openDowngradeModal = useOpenDowngradeModal();
    const openPurchaseModal = (callerInfo: string) => {
        props.onHide();
        const telemetryInfo = props.callerCTA + ' > ' + callerInfo;
        if (subscription?.delinquent_since) {
            openCloudDelinquencyModal({trackingLocation: telemetryInfo});
        }
        openCloudPurchaseModal({trackingLocation: telemetryInfo});
    };

    const closePricingModal = () => {
        dispatch(closeModal(ModalIdentifiers.PRICING_MODAL));
    };

    const handleClickDowngrade = (downgradeFeedback?: Feedback) => {
        downgrade('click_pricing_modal_free_card_downgrade_button', downgradeFeedback);
    };

    const downgrade = async (callerInfo: string, downgradeFeedback?: Feedback) => {
        if (!starterProduct) {
            return;
        }

        const telemetryInfo = props.callerCTA + ' > ' + callerInfo;
        openDowngradeModal({trackingLocation: telemetryInfo});
        dispatch(closeModal(ModalIdentifiers.PRICING_MODAL));

        const result = await dispatch(subscribeCloudSubscription(starterProduct.id, undefined, 0, downgradeFeedback));

        if (result.error) {
            dispatch(closeModal(ModalIdentifiers.DOWNGRADE_MODAL));
            dispatch(closeModal(ModalIdentifiers.CLOUD_DOWNGRADE_CHOOSE_TEAM));
            dispatch(closeModal(ModalIdentifiers.PRICING_MODAL));

            dispatch(
                openModal({
                    modalId: ModalIdentifiers.ERROR_MODAL,
                    dialogType: ErrorModal,
                    dialogProps: {
                        backButtonAction: openPricingModalBackAction,
                    },
                }),
            );
            return;
        }

        dispatch(closeModal(ModalIdentifiers.DOWNGRADE_MODAL));
        dispatch(closeModal(ModalIdentifiers.CLOUD_DOWNGRADE_CHOOSE_TEAM));
        dispatch(
            openModal({
                modalId: ModalIdentifiers.SUCCESS_MODAL,
                dialogType: SuccessModal,
            }),
        );

        props.onHide();
    };

    const hasLimits = hasSomeLimits(limits);

    const starterBriefing = [
        formatMessage({id: 'pricing_modal.briefing.free.recentMessageBoards', defaultMessage: 'Access to {messages} most recent messages'}, {messages: formatNumber(fallbackStarterLimits.messages.history)}),
        formatMessage({id: 'pricing_modal.briefing.storageStarter', defaultMessage: '{storage} file storage limit'}, {storage: asGBString(fallbackStarterLimits.files.totalStorage, formatNumber)}),
        formatMessage({id: 'pricing_modal.briefing.free.noLimitBoards', defaultMessage: 'Unlimited board cards'}),
        formatMessage({id: 'pricing_modal.briefing.free.oneTeamPerWorkspace', defaultMessage: 'One team per workspace'}),
        formatMessage({id: 'pricing_modal.briefing.free.gitLabGitHubGSuite', defaultMessage: 'GitLab, GitHub, and GSuite SSO'}),
        formatMessage({id: 'pricing_modal.extra_briefing.cloud.free.calls', defaultMessage: 'Group calls of up to 8 people, 1:1 calls, and screen share'}),
    ];

    const legacyStarterBriefing = [
        formatMessage({id: 'admin.billing.subscription.planDetails.features.groupAndOneToOneMessaging', defaultMessage: 'Group and one-to-one messaging, file sharing, and search'}),
        formatMessage({id: 'admin.billing.subscription.planDetails.features.incidentCollaboration', defaultMessage: 'Incident collaboration'}),
        formatMessage({id: 'admin.billing.subscription.planDetails.features.unlimittedUsersAndMessagingHistory', defaultMessage: 'Unlimited users & message history'}),
        formatMessage({id: 'admin.billing.subscription.planDetails.features.mfa', defaultMessage: 'Multi-Factor Authentication (MFA)'}),
    ];

    const professionalBtnDetails = () => {
        if (isAdmin) {
            return {
                action: () => openPurchaseModal('click_pricing_modal_professional_card_upgrade_button'),
                text: adminProfessionalTierText,
                disabled: isProfessionalAnnual || (isEnterprise && !isEnterpriseTrial),
                customClass: (cloudFreeDeprecated || isPostTrial) ? ButtonCustomiserClasses.special : ButtonCustomiserClasses.active,
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
        if (cloudFreeDeprecated || (isPostTrial && isAdmin)) {
            return {
                action: () => {
                    trackEvent(TELEMETRY_CATEGORIES.CLOUD_PRICING, 'click_enterprise_contact_sales');
                    openContactSales();
                },
                text: formatMessage({id: 'pricing_modal.btn.contactSales', defaultMessage: 'Contact Sales'}),
                customClass: ButtonCustomiserClasses.active,
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

    const enterpriseCustomBtnDetails = () => {
        if (!isPostTrial && isAdmin && !cloudFreeDeprecated) {
            return (
                <CloudStartTrialButton
                    message={formatMessage({id: 'pricing_modal.btn.tryDays', defaultMessage: 'Try free for {days} days'}, {days: '30'})}
                    telemetryId='start_cloud_trial_from_pricing_modal'
                    disabled={isEnterprise || isEnterpriseTrial || isProfessional}
                    extraClass={`plan_action_btn ${(isEnterprise || isEnterpriseTrial || isProfessional) ? ButtonCustomiserClasses.grayed : ButtonCustomiserClasses.special}`}
                    afterTrialRequest={closePricingModal}
                />
            );
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
                {!cloudFreeDeprecated && (
                    <div className='pricing-options-container'>
                        <div className='alert-option-container'>
                            <div className='alert-option'>
                                <span>{formatMessage({id: 'pricing_modal.lookingToSelfHost', defaultMessage: 'Looking to self-host?'})}</span>
                                <ExternalLink
                                    onClick={() =>
                                        trackEvent(
                                            TELEMETRY_CATEGORIES.CLOUD_PURCHASING,
                                            'click_looking_to_self_host',
                                        )
                                    }
                                    href={CloudLinks.DEPLOYMENT_OPTIONS}
                                    location='pricing_modal_content'
                                >{formatMessage({id: 'pricing_modal.reviewDeploymentOptions', defaultMessage: 'Review deployment options'})}</ExternalLink>
                            </div>
                        </div>
                    </div>
                )}

                <div
                    className='PricingModal__body'
                    style={{marginTop: cloudFreeDeprecated ? '74px' : ''}}
                >
                    {!cloudFreeDeprecated && (
                        <Card
                            id='free'
                            topColor='#339970'
                            plan='Free'
                            planSummary={formatMessage({id: 'pricing_modal.planSummary.free', defaultMessage: 'Increased productivity for small teams'})}
                            price='$0'
                            rate={formatMessage({id: 'pricing_modal.price.freeForever', defaultMessage: 'Free forever'})}
                            isCloud={true}
                            cloudFreeDeprecated={cloudFreeDeprecated}
                            planLabel={
                                isStarter ? (
                                    <PlanLabel
                                        text={formatMessage({id: 'pricing_modal.planLabel.currentPlan', defaultMessage: 'CURRENT PLAN'})}
                                        color='var(--denim-status-online)'
                                        bgColor='var(--center-channel-bg)'
                                        firstSvg={<CheckMarkSvg/>}
                                    />) : undefined}
                            planExtraInformation={<StarterDisclaimerCTA/>}
                            buttonDetails={{
                                action: () => {
                                    if (!isStarter && !currentSubscriptionIsMonthly) {
                                        openContactSupport();
                                        return;
                                    }

                                    if (!starterProduct) {
                                        return;
                                    }
                                    dispatch(
                                        openModal({
                                            modalId: ModalIdentifiers.FEEDBACK,
                                            dialogType: DowngradeFeedbackModal,
                                            dialogProps: {
                                                onSubmit: handleClickDowngrade,
                                            },
                                        }),
                                    );
                                },
                                text: freeTierText,
                                disabled: isStarter || isEnterprise || !isAdmin,
                                customClass: (isStarter || isEnterprise || !isAdmin) ? ButtonCustomiserClasses.grayed : ButtonCustomiserClasses.secondary,
                            }}
                            briefing={{
                                title: formatMessage({id: 'pricing_modal.briefing.title', defaultMessage: 'Top features'}),
                                items: hasLimits ? starterBriefing : legacyStarterBriefing,
                            }}
                        />

                    )

                    }

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
                                    {
                                        cloudFreeDeprecated ? chunks : (<b>{chunks}</b>)
                                    }
                                </span>
                            ),
                        })}
                        isCloud={true}
                        cloudFreeDeprecated={cloudFreeDeprecated}
                        planLabel={isProfessional ? (
                            <PlanLabel
                                text={professionalPlanLabelText()}
                                color='var(--denim-status-online)'
                                bgColor='var(--center-channel-bg)'
                                firstSvg={<CheckMarkSvg/>}
                            />) : undefined}
                        buttonDetails={professionalBtnDetails()}
                        briefing={{
                            title: cloudFreeDeprecated ? formatMessage({id: 'pricing_modal.briefing.title_no_limit', defaultMessage: 'No limits on your team’s usage'}) : formatMessage({id: 'pricing_modal.briefing.title', defaultMessage: 'Top features'}),
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
                        topColor='#E07315'
                        plan='Enterprise'
                        planSummary={formatMessage({id: 'pricing_modal.planSummary.enterprise', defaultMessage: 'Administration, security, and compliance for large teams'})}
                        isCloud={true}
                        cloudFreeDeprecated={cloudFreeDeprecated}
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
                        customButtonDetails={enterpriseCustomBtnDetails()}
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
                    {cloudFreeDeprecated && <BlankCard/>}
                </div>
            </Modal.Body>
        </div>
    );
}

export default Content;
