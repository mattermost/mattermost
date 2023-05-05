// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Stripe} from '@stripe/stripe-js';
import {FormattedMessage, injectIntl, IntlShape} from 'react-intl';
import {RouteComponentProps, withRouter} from 'react-router-dom';

import ComplianceScreenFailedSvg from 'components/common/svg_images_components/access_denied_happy_svg';

import {Address, Feedback, Product} from '@mattermost/types/cloud';
import {ActionResult} from 'mattermost-redux/types/actions';

import {BillingDetails} from 'types/cloud/sku';
import {pageVisited, trackEvent} from 'actions/telemetry_actions';
import {RecurringIntervals, TELEMETRY_CATEGORIES} from 'utils/constants';
import {Team} from '@mattermost/types/teams';

import {t} from 'utils/i18n';
import {getNextBillingDate} from 'utils/utils';

import CreditCardSvg from 'components/common/svg_images_components/credit_card_svg';
import PaymentSuccessStandardSvg from 'components/common/svg_images_components/payment_success_standard_svg';
import PaymentFailedSvg from 'components/common/svg_images_components/payment_failed_svg';

import IconMessage from './icon_message';

import './process_payment.css';

type ComplianceError = {
    error: string;
    status: number;
}

type Props = RouteComponentProps & {
    billingDetails: BillingDetails | null;
    shippingAddress: Address | null;
    stripe: Promise<Stripe | null>;
    cwsMockMode: boolean;
    contactSupportLink: string;
    currentTeam: Team;
    addPaymentMethod: (
        stripe: Stripe,
        billingDetails: BillingDetails,
        cwsMockMode: boolean
    ) => Promise<boolean | null>;
    subscribeCloudSubscription:
    | ((productId: string, shippingAddress: Address, seats?: number, downgradeFeedback?: Feedback) => Promise<ActionResult<Subscription, ComplianceError>>)
    | null;
    onBack: () => void;
    onClose: () => void;
    selectedProduct?: Product | null | undefined;
    currentProduct?: Product | null | undefined;
    isProratedPayment?: boolean;
    isUpgradeFromTrial: boolean;
    setIsUpgradeFromTrialToFalse: () => void;
    telemetryProps?: { callerInfo: string };
    onSuccess?: () => void;
    intl: IntlShape;
    usersCount: number;
    isSwitchingToAnnual: boolean;
};

type State = {
    progress: number;
    error: boolean;
    state: ProcessState;
}

enum ProcessState {
    PROCESSING = 0,
    SUCCESS,
    FAILED,
    FAILED_COMPLIANCE_SCREEN,
}

const MIN_PROCESSING_MILLISECONDS = 5000;
const MAX_FAKE_PROGRESS = 95;

class ProcessPaymentSetup extends React.PureComponent<Props, State> {
    intervalId: NodeJS.Timeout;

    public constructor(props: Props) {
        super(props);

        this.intervalId = {} as NodeJS.Timeout;

        this.state = {
            progress: 0,
            error: false,
            state: ProcessState.PROCESSING,
        };
    }

    public componentDidMount() {
        this.savePaymentMethod();

        this.intervalId = setInterval(this.updateProgress, MIN_PROCESSING_MILLISECONDS / MAX_FAKE_PROGRESS);
    }

    public componentWillUnmount() {
        clearInterval(this.intervalId);
    }

    private updateProgress = () => {
        let {progress} = this.state;

        if (progress >= MAX_FAKE_PROGRESS) {
            clearInterval(this.intervalId);
            return;
        }

        progress += 1;
        this.setState({progress: progress > MAX_FAKE_PROGRESS ? MAX_FAKE_PROGRESS : progress});
    };

    private savePaymentMethod = async () => {
        const start = new Date();
        const {
            stripe,
            addPaymentMethod,
            billingDetails,
            cwsMockMode,
            subscribeCloudSubscription,
        } = this.props;
        const success = await addPaymentMethod((await stripe)!, billingDetails!, cwsMockMode);

        if (typeof success !== 'boolean' || !success) {
            trackEvent('cloud_admin', 'complete_payment_failed', {
                callerInfo: this.props.telemetryProps?.callerInfo,
            });
            this.setState({
                error: true,
                state: ProcessState.FAILED});
            return;
        }

        if (subscribeCloudSubscription) {
            const result = await subscribeCloudSubscription(this.props.selectedProduct?.id as string, this.props.shippingAddress as Address, this.props.usersCount);

            // the action subscribeCloudSubscription returns a true boolean when successful and an error when it fails
            if (result.error) {
                trackEvent('cloud_admin', 'complete_payment_failed_compliance_screen', {
                    callerInfo: this.props.telemetryProps?.callerInfo,
                });
                if (result.error.status === 422) {
                    this.setState({
                        error: true,
                        state: ProcessState.FAILED_COMPLIANCE_SCREEN,
                    });
                    return;
                }
                trackEvent('cloud_admin', 'complete_payment_failed', {
                    callerInfo: this.props.telemetryProps?.callerInfo,
                });
                this.setState({
                    error: true,
                    state: ProcessState.FAILED});
                return;
            }
        }

        const end = new Date();
        const millisecondsElapsed = end.valueOf() - start.valueOf();
        if (millisecondsElapsed < MIN_PROCESSING_MILLISECONDS) {
            setTimeout(this.completePayment, MIN_PROCESSING_MILLISECONDS - millisecondsElapsed);
            return;
        }

        this.completePayment();
    };

    private completePayment = () => {
        clearInterval(this.intervalId);
        trackEvent('cloud_admin', 'complete_payment_success', {
            callerInfo: this.props.telemetryProps?.callerInfo,
        });
        pageVisited(
            TELEMETRY_CATEGORIES.CLOUD_PURCHASING,
            'pageview_payment_success',
        );
        this.setState({state: ProcessState.SUCCESS, progress: 100});
    };

    private handleGoBack = () => {
        clearInterval(this.intervalId);
        this.setState({
            progress: 0,
            error: false,
            state: ProcessState.PROCESSING,
        });
        this.props.onBack();
    };

    private successPage = () => {
        const {error} = this.state;
        const formattedBtnText = (
            <FormattedMessage
                defaultMessage='Return to {team}'
                id='admin.billing.subscription.returnToTeam'
                values={{
                    team: this.props.currentTeam?.display_name || this.props.intl.formatMessage({
                        id: 'admin.sidebarHeader.systemConsole',
                        defaultMessage: 'System Console',
                    }),
                }}
            />
        );
        if (this.props.isProratedPayment) {
            const formattedTitle = (
                <FormattedMessage
                    defaultMessage={'You are now subscribed to {selectedProductName}'}
                    id={'admin.billing.subscription.proratedPayment.title'}
                    values={{selectedProductName: this.props.selectedProduct?.name}}
                />
            );
            const formattedSubtitle = (
                <FormattedMessage
                    defaultMessage={"Thank you for upgrading to {selectedProductName}. Check your workspace in a few minutes to access all the plan's features. You'll be charged a prorated amount for your {currentProductName} plan and {selectedProductName} plan based on the number of days left in the billing cycle and number of users you have."}
                    id={'admin.billing.subscription.proratedPayment.substitle'}
                    values={{selectedProductName: this.props.selectedProduct?.name, currentProductName: this.props.currentProduct?.name}}
                />
            );
            return (
                <>
                    <IconMessage
                        formattedTitle={formattedTitle}
                        formattedSubtitle={formattedSubtitle}
                        date={getNextBillingDate()}
                        error={error}
                        icon={
                            <PaymentSuccessStandardSvg
                                width={444}
                                height={313}
                            />
                        }
                        formattedButtonText={formattedBtnText}
                        buttonHandler={this.props.onClose}
                        className={'success'}
                    />
                </>
            );
        } else if (this.props.isSwitchingToAnnual) {
            const formattedTitle = (
                <FormattedMessage
                    defaultMessage={"You're now switched to {selectedProductName} annual"}
                    id={'admin.billing.subscription.switchedToAnnual.title'}
                    values={{selectedProductName: this.props.selectedProduct?.name}}
                />
            );
            return (
                <>
                    <IconMessage
                        formattedTitle={formattedTitle}
                        icon={
                            <PaymentSuccessStandardSvg
                                width={444}
                                height={313}
                            />
                        }
                        formattedButtonText={formattedBtnText}
                        buttonHandler={this.props.onClose}
                        tertiaryBtnText={t('admin.billing.subscription.viewBilling')}
                        tertiaryButtonHandler={() => {
                            this.props.onClose();
                            this.props.history.push('/admin_console/billing/subscription');
                        }}
                        className={'success'}
                    />
                </>
            );
        }
        const productName = this.props.selectedProduct?.name;
        const title = (
            <FormattedMessage
                id={'admin.billing.subscription.upgradedSuccess'}
                defaultMessage={'You\'re now upgraded to {productName}'}
                values={{productName}}
            />
        );

        let handleClose = () => {
            this.props.onClose();
        };

        if (typeof this.props.onSuccess === 'function') {
            this.props.onSuccess();
        }

        // if is the first purchase, show a different success purchasing title
        if (this.props.isUpgradeFromTrial) {
            handleClose = () => {
                // set the property isUpgrading to false onClose since we can not use directly isFreeTrial because of component rerendering
                this.props.setIsUpgradeFromTrialToFalse();
                this.props.onClose();
            };
        }

        const formattedSubtitle = this.props.selectedProduct?.recurring_interval === RecurringIntervals.YEAR ? (
            <FormattedMessage
                defaultMessage={'{productName} features are now available and ready to use.'}
                id={'admin.billing.subscription.featuresAvailable'}
                values={{productName}}
            />
        ) : (
            <FormattedMessage
                id='admin.billing.subscription.nextBillingDate'
                defaultMessage='Starting from {date}, you will be billed for the {productName} plan. You can change your plan whenever you like and we will pro-rate the charges.'
                values={{date: getNextBillingDate(), productName}}
            />
        );
        return (
            <IconMessage
                formattedTitle={title}
                formattedSubtitle={formattedSubtitle}
                error={error}
                icon={
                    <PaymentSuccessStandardSvg
                        width={444}
                        height={313}
                    />
                }
                formattedButtonText={formattedBtnText}
                buttonHandler={handleClose}
                className={'success'}
                tertiaryBtnText={t('admin.billing.subscription.viewBilling')}
                tertiaryButtonHandler={() => {
                    this.props.onClose();
                    this.props.history.push('/admin_console/billing/subscription');
                }}
            />
        );
    };

    public render() {
        const {state, progress, error} = this.state;

        const progressBar: JSX.Element | null = (
            <div className='ProcessPayment-progress'>
                <div
                    className='ProcessPayment-progress-fill'
                    style={{width: `${progress}%`}}
                />
            </div>
        );

        switch (state) {
        case ProcessState.PROCESSING:
            return (
                <IconMessage
                    title={t('admin.billing.subscription.verifyPaymentInformation')}
                    subtitle={''}
                    icon={
                        <CreditCardSvg
                            width={444}
                            height={313}
                        />
                    }
                    footer={progressBar}
                    className={'processing'}
                />
            );
        case ProcessState.SUCCESS:
            return this.successPage();
        case ProcessState.FAILED_COMPLIANCE_SCREEN:
            return (
                <IconMessage
                    title={t(
                        'admin.billing.subscription.complianceScreenFailed.title',
                    )}
                    icon={
                        <ComplianceScreenFailedSvg
                            width={444}
                            height={313}
                        />
                    }
                    error={error}
                    buttonText={t(
                        'admin.billing.subscription.complianceScreenFailed.button',
                    )}
                    buttonHandler={() => this.props.onClose()}
                    linkText={t(
                        'admin.billing.subscription.privateCloudCard.contactSupport',
                    )}
                    linkURL={this.props.contactSupportLink}
                    className={'failed'}
                />
            );
        case ProcessState.FAILED:
            return (
                <IconMessage
                    title={t('admin.billing.subscription.paymentVerificationFailed')}
                    subtitle={t('admin.billing.subscription.paymentFailed')}
                    icon={
                        <PaymentFailedSvg
                            width={444}
                            height={313}
                        />
                    }
                    error={error}
                    buttonText={t('admin.billing.subscription.goBackTryAgain')}
                    buttonHandler={this.handleGoBack}
                    linkText={t('admin.billing.subscription.privateCloudCard.contactSupport')}
                    linkURL={this.props.contactSupportLink}
                    className={'failed'}
                />
            );
        default:
            return null;
        }
    }
}

export default injectIntl(withRouter(ProcessPaymentSetup));
