// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import React, {useEffect, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {trackEvent} from 'actions/telemetry_actions';
import {closeModal} from 'actions/views/modals';
import {getPrevTrialLicense} from 'mattermost-redux/actions/admin';
import {Client4} from 'mattermost-redux/client';
import {getConfig} from 'mattermost-redux/selectors/entities/admin';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import useCanSelfHostedSignup from 'components/common/hooks/useCanSelfHostedSignup';
import {
    useControlAirGappedSelfHostedPurchaseModal,
    useControlScreeningInProgressModal,
} from 'components/common/hooks/useControlModal';
import useControlSelfHostedPurchaseModal from 'components/common/hooks/useControlSelfHostedPurchaseModal';
import useFetchAdminConfig from 'components/common/hooks/useFetchAdminConfig';
import useGetSelfHostedProducts from 'components/common/hooks/useGetSelfHostedProducts';
import useOpenSalesLink from 'components/common/hooks/useOpenSalesLink';
import PlanLabel from 'components/common/plan_label';
import ExternalLink from 'components/external_link';
import StartTrialBtn from 'components/learn_more_trial_modal/start_trial_btn';
import CheckMarkSvg from 'components/widgets/icons/check_mark_icon';

import {CloudLinks, ModalIdentifiers, SelfHostedProducts, LicenseSkus, TELEMETRY_CATEGORIES, RecurringIntervals} from 'utils/constants';
import {findSelfHostedProductBySku} from 'utils/hosted_customer';

import Card, {ButtonCustomiserClasses} from './card';
import ContactSalesCTA from './contact_sales_cta';
import StartTrialCaution from './start_trial_caution';

import './content.scss';

type ContentProps = {
    onHide: () => void;
}

const FALL_BACK_PROFESSIONAL_PRICE = '10';

function SelfHostedContent(props: ContentProps) {
    const [professionalPrice, setProfessionalPrice] = useState(' ');
    useFetchAdminConfig();
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const signupAvailable = useCanSelfHostedSignup();

    const [products, productsLoaded] = useGetSelfHostedProducts();
    const professionalProductId = findSelfHostedProductBySku(products, SelfHostedProducts.PROFESSIONAL)?.id || '';

    const controlSelfHostedPurchaseModal = useControlSelfHostedPurchaseModal({productId: professionalProductId});
    const isSelfHostedPurchaseEnabled = useSelector(getConfig)?.ServiceSettings?.SelfHostedPurchase;

    useEffect(() => {
        dispatch(getPrevTrialLicense());
    }, []);

    useEffect(() => {
        async function fetchSelfHostedProducts() {
            try {
                const products = await Client4.getSelfHostedProducts();
                const professionalProduct = products.find((prod) => prod.sku === LicenseSkus.Professional && prod.recurring_interval === RecurringIntervals.YEAR);
                const price = professionalProduct ? professionalProduct.price_per_seat.toString() : FALL_BACK_PROFESSIONAL_PRICE;
                setProfessionalPrice(`$${price}`);
            } catch (error) {
                setProfessionalPrice(`$${FALL_BACK_PROFESSIONAL_PRICE}`);
            }
        }

        fetchSelfHostedProducts();
    }, []);

    const isAdmin = useSelector(isCurrentUserSystemAdmin);

    const license = useSelector(getLicense);
    const prevSelfHostedTrialLicense = useSelector((state: GlobalState) => state.entities.admin.prevTrialLicense);

    const isSelfHostedEnterpriseTrial = license.IsTrial === 'true';

    const isStarter = license.IsLicensed === 'false';
    const isProfessional = license.SkuShortName === LicenseSkus.Professional;
    const isEnterprise = license.SkuShortName === LicenseSkus.Enterprise;
    const isPostSelfHostedEnterpriseTrial = prevSelfHostedTrialLicense.IsLicensed === 'true';

    const [openContactSales] = useOpenSalesLink();
    const controlScreeningInProgressModal = useControlScreeningInProgressModal();
    const controlAirgappedModal = useControlAirGappedSelfHostedPurchaseModal();

    const closePricingModal = () => {
        dispatch(closeModal(ModalIdentifiers.PRICING_MODAL));
    };

    const starterBriefing = [
        formatMessage({id: 'pricing_modal.briefing.unlimitedWorkspaceTeams', defaultMessage: 'Unlimited workspace teams'}),
        formatMessage({id: 'pricing_modal.briefing.unlimitedPlaybookRuns', defaultMessage: 'Unlimited playbooks and runs'}),
        formatMessage({id: 'pricing_modal.extra_briefing.free.calls', defaultMessage: 'Voice calls and screen share'}),
        formatMessage({id: 'pricing_modal.briefing.fullMessageAndHistory', defaultMessage: 'Full message and file history'}),
        formatMessage({id: 'pricing_modal.briefing.ssoWithGitLab', defaultMessage: 'SSO with Gitlab'}),
    ];

    const professionalBriefing = [
        formatMessage({id: 'pricing_modal.briefing.customUserGroups', defaultMessage: 'Custom user groups'}),
        formatMessage({id: 'pricing_modal.extra_briefing.professional.ssoSaml', defaultMessage: 'SSO with SAML 2.0, including Okta, OneLogin, and ADFS'}),
        formatMessage({id: 'pricing_modal.extra_briefing.professional.ssoadLdap', defaultMessage: 'SSO support with AD/LDAP, Google, O365, OpenID'}),
        formatMessage({id: 'pricing_modal.extra_briefing.professional.guestAccess', defaultMessage: 'Guest access with MFA enforcement'}),

    ];

    const enterpriseBriefing = [
        formatMessage({id: 'pricing_modal.briefing.enterprise.groupSync', defaultMessage: 'AD/LDAP group sync'}),
        formatMessage({id: 'pricing_modal.briefing.enterprise.mobileSecurity', defaultMessage: 'Advanced mobile security via ID-only push notifications'}),
        formatMessage({id: 'pricing_modal.briefing.enterprise.rolesAndPermissions', defaultMessage: 'Advanced roles and permissions'}),
        formatMessage({id: 'pricing_modal.briefing.enterprise.advancedComplianceManagement', defaultMessage: 'Advanced compliance management'}),
        formatMessage({id: 'pricing_modal.extra_briefing.enterprise.playBookAnalytics', defaultMessage: 'Playbook analytics dashboard'}),
    ];

    const renderAlert = () => {
        return (
            <div className='alert-option'>
                <span>
                    {formatMessage({id: 'pricing_modal.lookingForCloudOption', defaultMessage: 'Looking for a cloud option?'})}
                </span>
                <ExternalLink
                    onClick={() => {
                        trackEvent(
                            TELEMETRY_CATEGORIES.SELF_HOSTED_PURCHASING,
                            'click_looking_for_a_cloud_option',
                        );
                    }
                    }
                    href={CloudLinks.CLOUD_SIGNUP_PAGE}
                    location='pricing_modal_self_hosted_content'
                >{formatMessage({id: 'pricing_modal.reviewDeploymentOptions', defaultMessage: 'Review deployment options'})}</ExternalLink>
            </div>
        );
    };

    const trialButton = () => {
        return (
            <StartTrialBtn
                message={formatMessage({id: 'pricing_modal.btn.tryDays', defaultMessage: 'Try free for {days} days'}, {days: '30'})}
                telemetryId='start_trial_from_self_hosted_pricing_modal'
                renderAsButton={true}
                disabled={isSelfHostedEnterpriseTrial}
                btnClass={`plan_action_btn ${isSelfHostedEnterpriseTrial ? ButtonCustomiserClasses.grayed : ButtonCustomiserClasses.special}`}
                onClick={closePricingModal}
            />
        );
    };

    return (
        <div className='Content Content--self-hosted'>
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
                    onClick={() => {
                        trackEvent('self_hosted_pricing', 'close_pricing_modal');
                        props.onHide();
                    }}
                />
            </Modal.Header>
            <Modal.Body>
                {renderAlert()}
                <div className='PricingModal__body'>
                    <Card
                        id='free'
                        topColor='#339970'
                        plan='Free'
                        planSummary={formatMessage({id: 'pricing_modal.planSummary.free', defaultMessage: 'Increased productivity for small teams'})}
                        price='$0'
                        rate={formatMessage({id: 'pricing_modal.price.freeForever', defaultMessage: 'Free forever'})}
                        isCloud={false}
                        cloudFreeDeprecated={false}
                        planLabel={
                            isStarter ? (
                                <PlanLabel
                                    text={formatMessage({id: 'pricing_modal.planLabel.currentPlan', defaultMessage: 'CURRENT PLAN'})}
                                    color='var(--denim-status-online)'
                                    bgColor='var(--center-channel-bg)'
                                    firstSvg={<CheckMarkSvg/>}
                                />) : undefined}
                        buttonDetails={{
                            action: () => {},
                            text: formatMessage({id: 'pricing_modal.btn.downgrade', defaultMessage: 'Downgrade'}),
                            disabled: true,
                            customClass: ButtonCustomiserClasses.secondary,
                        }}
                        briefing={{
                            title: formatMessage({id: 'pricing_modal.briefing.title', defaultMessage: 'Top features'}),
                            items: starterBriefing,
                        }}
                    />
                    <Card
                        id='professional'
                        topColor='var(--denim-button-bg)'
                        plan='Professional'
                        planSummary={formatMessage({id: 'pricing_modal.planSummary.professional', defaultMessage: 'Scalable solutions {br} for growing teams'}, {
                            br: <br/>,
                        })}
                        price={professionalPrice}
                        rate={formatMessage({id: 'pricing_modal.rate.seatPerMonth', defaultMessage: 'USD per seat/month {br}<b>(billed annually)</b>'}, {
                            br: <br/>,
                            b: (chunks: React.ReactNode | React.ReactNodeArray) => (
                                <span className='billed_annually'>
                                    <b>{chunks}</b>
                                </span>
                            ),
                        })}
                        isCloud={false}
                        cloudFreeDeprecated={false}
                        planLabel={
                            isProfessional ? (
                                <PlanLabel
                                    text={formatMessage({id: 'pricing_modal.planLabel.currentPlan', defaultMessage: 'CURRENT PLAN'})}
                                    color='var(--denim-status-online)'
                                    bgColor='var(--center-channel-bg)'
                                    firstSvg={<CheckMarkSvg/>}
                                />) : undefined}
                        buttonDetails={{
                            action: () => {
                                trackEvent('self_hosted_pricing', 'click_upgrade_button');

                                if (!isSelfHostedPurchaseEnabled) {
                                    window.open(CloudLinks.SELF_HOSTED_SIGNUP, '_blank');
                                    return;
                                }

                                if (!signupAvailable.ok) {
                                    if (signupAvailable.cwsContacted && !signupAvailable.cwsServiceOn) {
                                        window.open(CloudLinks.SELF_HOSTED_SIGNUP, '_blank');
                                        return;
                                    }
                                    if (signupAvailable.screeningInProgress) {
                                        controlScreeningInProgressModal.open();
                                    } else {
                                        controlAirgappedModal.open();
                                    }
                                    closePricingModal();
                                    return;
                                }

                                const professionalProduct = findSelfHostedProductBySku(products, SelfHostedProducts.PROFESSIONAL);
                                if (productsLoaded && professionalProduct) {
                                    // let the control modal close this modal
                                    // we need to wait for its timing,
                                    // it doesn't return a signal,
                                    // and we can not do this in a useEffect hook
                                    // at the top of this file easily because
                                    // sometimes we want both modals to be open if user is in purchase
                                    // modal and wants to compare plans
                                    controlSelfHostedPurchaseModal.open();
                                }
                            },
                            text: formatMessage({id: 'pricing_modal.btn.upgrade', defaultMessage: 'Upgrade'}),
                            disabled: !isAdmin || isProfessional,
                            customClass: isPostSelfHostedEnterpriseTrial ? ButtonCustomiserClasses.special : ButtonCustomiserClasses.active,
                        }}

                        briefing={{
                            title: formatMessage({id: 'pricing_modal.briefing.title', defaultMessage: 'Top features'}),
                            items: professionalBriefing,
                        }}
                    />
                    <Card
                        id='enterprise'
                        topColor='#E07315'
                        plan='Enterprise'
                        planSummary={formatMessage({id: 'pricing_modal.planSummary.enterprise', defaultMessage: 'Administration, security, and compliance for large teams'})}
                        isCloud={false}
                        cloudFreeDeprecated={false}
                        planLabel={
                            isEnterprise ? (
                                <PlanLabel
                                    text={formatMessage({id: 'pricing_modal.planLabel.currentPlan', defaultMessage: 'CURRENT PLAN'})}
                                    color='var(--denim-status-online)'
                                    bgColor='var(--center-channel-bg)'
                                    firstSvg={<CheckMarkSvg/>}
                                    renderLastDaysOnTrial={true}
                                />) : undefined}
                        buttonDetails={(isPostSelfHostedEnterpriseTrial || !isAdmin) ? {
                            action: () => {
                                trackEvent('self_hosted_pricing', 'click_enterprise_contact_sales');
                                openContactSales();
                            },
                            text: formatMessage({id: 'pricing_modal.btn.contactSales', defaultMessage: 'Contact Sales'}),
                            customClass: ButtonCustomiserClasses.active,
                        } : undefined}
                        customButtonDetails={(!isPostSelfHostedEnterpriseTrial && isAdmin) ? (
                            trialButton()
                        ) : undefined}
                        planTrialDisclaimer={(!isPostSelfHostedEnterpriseTrial && isAdmin) ? <StartTrialCaution/> : undefined}
                        contactSalesCTA={(isPostSelfHostedEnterpriseTrial || !isAdmin) ? undefined : <ContactSalesCTA/>}
                        briefing={{
                            title: formatMessage({id: 'pricing_modal.briefing.title', defaultMessage: 'Top features'}),
                            items: enterpriseBriefing,
                        }}
                    />
                </div>
            </Modal.Body>
        </div>
    );
}

export default SelfHostedContent;
