// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import {EmbargoedEntityTrialError} from 'components/admin_console/license_settings/trial_banner/trial_banner';
import AlertBanner from 'components/alert_banner';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';
import StartTrialBtn from 'components/learn_more_trial_modal/start_trial_btn';
import PurchaseLink from 'components/announcement_bar/purchase_link/purchase_link';
import ContactUsButton from 'components/announcement_bar/contact_sales/contact_us';
import PurchaseModal from 'components/purchase_modal';
import ExternalLink from 'components/external_link';

import {ModalIdentifiers, TELEMETRY_CATEGORIES, AboutLinks, LicenseLinks, LicenseSkus} from 'utils/constants';
import * as Utils from 'utils/utils';
import {goToMattermostContactSalesForm} from 'utils/contact_support_sales';

import {trackEvent} from 'actions/telemetry_actions';

import {ModalData} from 'types/actions';

import {ClientLicense} from '@mattermost/types/config';
import {AnalyticsRow} from '@mattermost/types/admin';
import {CloudCustomer} from '@mattermost/types/cloud';

import './feature_discovery.scss';

type Props = {
    featureName: string;
    minimumSKURequiredForFeature: LicenseSkus;

    titleID: string;
    titleDefault: string;

    copyID: string;
    copyDefault: string;

    learnMoreURL: string;

    featureDiscoveryImage: JSX.Element;

    prevTrialLicense: ClientLicense;

    stats?: Record<string, number | AnalyticsRow[]>;
    actions: {
        getPrevTrialLicense: () => void;
        getCloudSubscription: () => void;
        openModal: <P>(modalData: ModalData<P>) => void;
    };
    isCloud: boolean;
    isCloudTrial: boolean;
    hadPrevCloudTrial: boolean;
    isSubscriptionLoaded: boolean;
    isPaidSubscription: boolean;
    customer?: CloudCustomer;
}

type State = {
    gettingTrial: boolean;
    gettingTrialError: string | null;
    gettingTrialResponseCode: number | null;
}

export default class FeatureDiscovery extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            gettingTrial: false,
            gettingTrialError: null,
            gettingTrialResponseCode: null,
        };
    }

    componentDidMount() {
        this.props.actions.getPrevTrialLicense();
    }

    openUpgradeModal = (e: React.MouseEvent) => {
        e.preventDefault();

        trackEvent(
            TELEMETRY_CATEGORIES.CLOUD_ADMIN,
            'click_subscribe_from_feature_discovery',
        );

        this.props.actions.openModal({
            modalId: ModalIdentifiers.CLOUD_PURCHASE,
            dialogType: PurchaseModal,
            dialogProps: {
                callerCTA: 'feature_discovery_subscribe_button',
            },
        });
    };

    contactSalesFunc = () => {
        const {customer, isCloud} = this.props;
        const customerEmail = customer?.email || '';
        const firstName = customer?.contact_first_name || '';
        const lastName = customer?.contact_last_name || '';
        const companyName = customer?.name || '';
        const utmMedium = isCloud ? 'in-product-cloud' : 'in-product';
        goToMattermostContactSalesForm(firstName, lastName, companyName, customerEmail, 'mattermost', utmMedium);
    };

    renderPostTrialCta = () => {
        const {
            minimumSKURequiredForFeature,
            learnMoreURL,
        } = this.props;
        if (minimumSKURequiredForFeature === LicenseSkus.Enterprise) {
            return (
                <div className='purchase-card'>
                    <button
                        className='btn btn-primary'
                        data-testid='featureDiscovery_primaryCallToAction'
                        onClick={() => {
                            trackEvent(TELEMETRY_CATEGORIES.SELF_HOSTED_ADMIN, 'click_enterprise_contact_sales_feature_discovery');
                            this.contactSalesFunc();
                        }}
                    >
                        <FormattedMessage
                            id='admin.ldap_feature_discovery_cloud.call_to_action.primary_sales'
                            defaultMessage='Contact sales'
                        />
                    </button>
                    <ExternalLink
                        location='feature_discovery'
                        className='btn btn-secondary'
                        href={learnMoreURL}
                        data-testid='featureDiscovery_secondaryCallToAction'
                    >
                        <FormattedMessage
                            id='admin.ldap_feature_discovery.call_to_action.secondary'
                            defaultMessage='Learn more'
                        />
                    </ExternalLink>
                </div>
            );
        }

        return (
            <div className='purchase-card'>
                <>
                    <PurchaseLink
                        eventID='post_trial_purchase_license'
                        buttonTextElement={
                            <FormattedMessage
                                id='admin.license.trialCard.purchase_license'
                                defaultMessage='Purchase a license'
                            />
                        }
                    />
                    <ContactUsButton
                        eventID='post_trial_contact_sales'
                    />
                </>

            </div>
        );
    };

    renderStartTrial = (learnMoreURL: string, gettingTrialError: React.ReactNode) => {
        // by default we assume is not cloud, so the cta button is Start Trial (which will request a trial license)
        const ctaPrimaryButton = (
            <StartTrialBtn
                message={Utils.localizeMessage(
                    'admin.ldap_feature_discovery.call_to_action.primary',
                    'Start trial',
                )}
                telemetryId={`start_self_hosted_trial_from_${this.props.featureName}`}
                btnClass='btn btn-primary'
                renderAsButton={true}
                trackingPage={this.props.featureName}
            />
        );

        return (
            <>
                {ctaPrimaryButton}
                <ExternalLink
                    location='feature_discovery'
                    className='btn btn-secondary'
                    href={learnMoreURL}
                    data-testid='featureDiscovery_secondaryCallToAction'
                >
                    <FormattedMessage
                        id='admin.ldap_feature_discovery.call_to_action.secondary'
                        defaultMessage='Learn more'
                    />
                </ExternalLink>
                {gettingTrialError}
                {(!this.props.isCloud) && (<p className='trial-legal-terms'>

                    <FormattedMessage
                        id='admin.feature_discovery.trial-request.accept-terms'
                        defaultMessage='By clicking <highlight>Start trial</highlight>, I agree to the <linkEvaluation>Mattermost Software and Services License Agreement</linkEvaluation>, <linkPrivacy>Privacy Policy</linkPrivacy> and receiving product emails.'
                        values={{
                            highlight: (msg: React.ReactNode) => (
                                <strong>{msg}</strong>
                            ),
                            linkEvaluation: (msg: React.ReactNode) => (
                                <ExternalLink
                                    location='feature_discovery'
                                    href={LicenseLinks.SOFTWARE_SERVICES_LICENSE_AGREEMENT}
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                            linkPrivacy: (msg: React.ReactNode) => (
                                <ExternalLink
                                    location='feature_discovery'
                                    href={AboutLinks.PRIVACY_POLICY}
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        }}
                    />

                </p>)}
            </>
        );
    };

    render() {
        const {
            titleID,
            titleDefault,
            copyID,
            copyDefault,
            learnMoreURL,
            featureDiscoveryImage,
            isCloud,
            isCloudTrial,
            isSubscriptionLoaded,
        } = this.props;

        // on first load the license information is available and we can know if it is cloud license, but the subscription is not loaded yet
        // so on initial load we check if it is cloud license and in the case the subscription is still undefined we show the loading spinner to avoid
        // component change flashing
        if (isCloud && !isSubscriptionLoaded) {
            return (<LoadingSpinner/>);
        }

        let gettingTrialError: React.ReactNode = '';
        if (this.state.gettingTrialError && this.state.gettingTrialResponseCode === 451) {
            gettingTrialError = (
                <p className='trial-error'>
                    <EmbargoedEntityTrialError/>
                </p>
            );
        } else if (this.state.gettingTrialError) {
            gettingTrialError = (
                <p className='trial-error'>
                    <FormattedMessage
                        id='admin.feature_discovery.trial-request.error'
                        defaultMessage='Trial license could not be retrieved. Visit <link>{trialInfoLink}</link> to request a license.'
                        values={{
                            link: (msg: React.ReactNode) => (
                                <ExternalLink
                                    location='feature_discovery'
                                    href={LicenseLinks.TRIAL_INFO_LINK}
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                            trialInfoLink: LicenseLinks.TRIAL_INFO_LINK,
                        }}
                    />
                </p>
            );
        }

        // if it is cloud and is in trial, in the case this component get's shown that means that the license hasn't been updated yet
        // so let's notify to the user that the license is being updated
        if (isCloud && isCloudTrial && isSubscriptionLoaded) {
            return (
                <div className='FeatureDiscovery'>
                    <AlertBanner
                        mode='info'
                        title={
                            <FormattedMessage
                                id='admin.featureDiscovery.WarningTitle'
                                defaultMessage='Your trial has started and updates are being made to your license.'
                            />
                        }
                        message={
                            <>
                                <FormattedMarkdownMessage
                                    id='admin.featureDiscovery.WarningDescription'
                                    defaultMessage='Your License is being updated to give you full access to all the Enterprise Features. This page will automatically refresh once the license update is complete. Please wait '
                                />
                                <LoadingSpinner/>
                            </>
                        }
                    />
                </div>
            );
        }

        return (
            <div className='FeatureDiscovery'>
                <div className='FeatureDiscovery_copyWrapper'>
                    <div
                        className='FeatureDiscovery_title'
                        data-testid='featureDiscovery_title'
                    >
                        <FormattedMessage
                            id={titleID}
                            defaultMessage={titleDefault}
                        />
                    </div>
                    <div className='FeatureDiscovery_copy'>
                        <FormattedMessage
                            id={copyID}
                            defaultMessage={copyDefault}
                        />
                    </div>
                    {this.props.prevTrialLicense?.IsLicensed === 'true' ? this.renderPostTrialCta() : this.renderStartTrial(learnMoreURL, gettingTrialError)}
                </div>
                <div className='FeatureDiscovery_imageWrapper'>
                    {featureDiscoveryImage}
                </div>
            </div>
        );
    }
}
