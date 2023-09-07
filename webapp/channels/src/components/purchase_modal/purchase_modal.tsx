// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import {Elements} from '@stripe/react-stripe-js';
import type {Stripe, StripeCardElementChangeEvent} from '@stripe/stripe-js';
import {loadStripe} from '@stripe/stripe-js/pure'; // https://github.com/stripe/stripe-js#importing-loadstripe-without-side-effects
import classnames from 'classnames';
import {isEmpty} from 'lodash';
import React from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import type {Address, CloudCustomer, Product, Invoice, Feedback} from '@mattermost/types/cloud';
import {areShippingDetailsValid} from '@mattermost/types/cloud';
import type {Team} from '@mattermost/types/teams';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {trackEvent, pageVisited} from 'actions/telemetry_actions';

import BillingHistoryModal from 'components/admin_console/billing/billing_history_modal';
import PaymentDetails from 'components/admin_console/billing/payment_details';
import PlanLabel from 'components/common/plan_label';
import ComplianceScreenFailedSvg from 'components/common/svg_images_components/access_denied_happy_svg';
import BackgroundSvg from 'components/common/svg_images_components/background_svg';
import UpgradeSvg from 'components/common/svg_images_components/upgrade_svg';
import ExternalLink from 'components/external_link';
import OverlayTrigger from 'components/overlay_trigger';
import AddressForm from 'components/payment_form/address_form';
import PaymentForm from 'components/payment_form/payment_form';
import {STRIPE_CSS_SRC} from 'components/payment_form/stripe';
import PricingModal from 'components/pricing_modal';
import RootPortal from 'components/root_portal';
import SeatsCalculator, {errorInvalidNumber} from 'components/seats_calculator';
import type {Seats} from 'components/seats_calculator';
import Consequences from 'components/seats_calculator/consequences';
import SwitchToYearlyPlanConfirmModal from 'components/switch_to_yearly_plan_confirm_modal';
import Tooltip from 'components/tooltip';
import StarMarkSvg from 'components/widgets/icons/star_mark_icon';
import FullScreenModal from 'components/widgets/modals/full_screen_modal';

import {
    Constants,
    TELEMETRY_CATEGORIES,
    CloudLinks,
    CloudProducts,
    BillingSchemes,
    ModalIdentifiers,
    RecurringIntervals,
} from 'utils/constants';
import {goToMattermostContactSalesForm} from 'utils/contact_support_sales';
import {t} from 'utils/i18n';
import {localizeMessage, getNextBillingDate, getBlankAddressWithCountry} from 'utils/utils';

import type {ModalData} from 'types/actions';
import type {BillingDetails} from 'types/cloud/sku';
import {areBillingDetailsValid} from 'types/cloud/sku';

import IconMessage from './icon_message';
import ProcessPaymentSetup from './process_payment_setup';

import 'components/payment_form/payment_form.scss';

import './purchase.scss';

let stripePromise: Promise<Stripe | null>;

export enum ButtonCustomiserClasses {
    grayed = 'grayed',
    active = 'active',
    special = 'special',
}

type ButtonDetails = {
    action: () => void;
    text: string;
    disabled?: boolean;
    customClass?: ButtonCustomiserClasses;
}

type DelinquencyCardProps = {
    topColor: string;
    price: string;
    buttonDetails: ButtonDetails;
    onViewBreakdownClick: () => void;
    isCloudDelinquencyGreaterThan90Days: boolean;
    users: number;
    cost: number;
};

type CardProps = {
    topColor?: string;
    plan: string;
    price?: string;
    rate?: ReactNode;
    buttonDetails: ButtonDetails;
    planBriefing?: JSX.Element | null; // can be removed once Yearly Subscriptions are available
    planLabel?: JSX.Element;
    preButtonContent?: React.ReactNode;
    afterButtonContent?: React.ReactNode;
}

type Props = {
    customer: CloudCustomer | undefined;
    show: boolean;
    cwsMockMode: boolean;
    products: Record<string, Product> | undefined;
    yearlyProducts: Record<string, Product>;
    contactSalesLink: string;
    isFreeTrial: boolean;
    productId: string | undefined;
    currentTeam: Team;
    intl: IntlShape;
    theme: Theme;
    isDelinquencyModal?: boolean;
    invoices?: Invoice[];
    isCloudDelinquencyGreaterThan90Days: boolean;
    usersCount: number;
    isComplianceBlocked: boolean;
    contactSupportLink: string;

    // callerCTA is information about the cta that opened this modal. This helps us provide a telemetry path
    // showing information about how the modal was opened all the way to more CTAs within the modal itself
    callerCTA?: string;

    stripePublicKey: string;
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
        closeModal: () => void;
        getCloudProducts: () => void;
        completeStripeAddPaymentMethod: (
            stripe: Stripe,
            billingDetails: BillingDetails,
            cwsMockMode: boolean
        ) => Promise<boolean | null>;
        subscribeCloudSubscription: (
            productId: string,
            shippingAddress: Address,
            seats?: number,
            downgradeFeedback?: Feedback,
        ) => Promise<ActionResult>;
        getClientConfig: () => void;
        getCloudSubscription: () => void;
        getInvoices: () => void;
    };
};

type State = {
    paymentInfoIsValid: boolean;
    billingDetails: BillingDetails | null;
    shippingAddress: Address | null;
    cardInputComplete: boolean;
    billingSameAsShipping: boolean;
    processing: boolean;
    editPaymentInfo: boolean;
    currentProduct: Product | null | undefined;
    selectedProduct: Product | null | undefined;
    isUpgradeFromTrial: boolean;
    buttonClickedInfo: string;
    selectedProductPrice: string | null;
    usersCount: number;
    seats: Seats;
    isSwitchingToAnnual: boolean;
}

/**
 *
 * @param products  Record<string, Product> | undefined - the list of current cloud products
 * @param productId String - a valid product id used to find a particular product in the dictionary
 * @param productSku String - the sku value of the product of type either cloud-starter | cloud-professional | cloud-enterprise
 * @returns Product
 */
function findProductInDictionary(products: Record<string, Product> | undefined, productId?: string | null, productSku?: string, productRecurringInterval?: string): Product | null {
    if (!products) {
        return null;
    }
    const keys = Object.keys(products);
    if (!keys.length) {
        return null;
    }
    if (!productId && !productSku) {
        return products[keys[0]];
    }
    let currentProduct = products[keys[0]];
    if (keys.length > 1) {
        // here find the product by the provided id or name, otherwise return the one with Professional in the name
        keys.forEach((key) => {
            if (productId && products[key].id === productId) {
                currentProduct = products[key];
            } else if (productSku && products[key].sku === productSku && products[key].recurring_interval === productRecurringInterval) {
                currentProduct = products[key];
            }
        });
    }
    return currentProduct;
}

function getSelectedProduct(
    products: Record<string, Product> | undefined,
    yearlyProducts: Record<string, Product>,
    currentProductId?: string | null,
    isDelinquencyModal?: boolean,
    isCloudDelinquencyGreaterThan90Days?: boolean) {
    if (isDelinquencyModal && !isCloudDelinquencyGreaterThan90Days) {
        const currentProduct = findProductInDictionary(products, currentProductId, undefined, RecurringIntervals.MONTH);

        // if the account hasn't been delinquent for more than 90 days, then we will allow them to settle up and stay on their current product
        return currentProduct;
    }

    // Otherwise, we will default to upgrading them to the yearly professional plan
    return findProductInDictionary(yearlyProducts, null, CloudProducts.PROFESSIONAL, RecurringIntervals.YEAR);
}

export function Card(props: CardProps) {
    const cardContent = (
        <div className='PlanCard'>
            {props.planLabel && props.planLabel}
            <div
                className='top'
                style={{backgroundColor: props.topColor}}
            />
            <div className='bottom'>
                <div className='plan_price_rate_section'>
                    <h4>{props.plan}</h4>
                    <h1 className={props.plan === 'Enterprise' ? 'enterprise_price' : ''}>{`$${props.price}`}</h1>
                    <p>{props.rate}</p>
                </div>
                {props.planBriefing}
                {props.preButtonContent}
                <div>
                    <button
                        className={'plan_action_btn ' + props.buttonDetails.customClass}
                        disabled={props.buttonDetails.disabled}
                        onClick={props.buttonDetails.action}
                    >{props.buttonDetails.text}</button>
                </div>
                {props.afterButtonContent}
            </div>
        </div>
    );

    return (
        cardContent
    );
}

function DelinquencyCard(props: DelinquencyCardProps) {
    const seeHowBillingWorks = (
        e: React.MouseEvent<HTMLAnchorElement, MouseEvent>,
    ) => {
        e.preventDefault();
        trackEvent(
            TELEMETRY_CATEGORIES.CLOUD_ADMIN,
            'click_see_how_billing_works',
        );
        window.open(CloudLinks.DELINQUENCY_DOCS, '_blank');
    };
    return (
        <div className='PlanCard'>
            <div
                className='top'
                style={{backgroundColor: props.topColor}}
            />
            <div className='bottom delinquency'>
                <div className='delinquency_summary_section'>
                    <div className={'summary-section'}>
                        <div className='summary-title'>
                            <FormattedMessage
                                id={'cloud_delinquency.cc_modal.card.totalOwed'}
                                defaultMessage={'Total Owed'}
                            />
                            {':'}
                        </div>
                        <div className='summary-total'>{props.price}</div>
                        <div
                            onClick={props.onViewBreakdownClick}
                            className='view-breakdown'
                        >
                            <FormattedMessage
                                defaultMessage={'View Breakdown'}
                                id={
                                    'cloud_delinquency.cc_modal.card.viewBreakdown'
                                }
                            />
                        </div>
                    </div>
                </div>
                <div>
                    <button
                        className={
                            'plan_action_btn ' + props.buttonDetails.customClass
                        }
                        disabled={props.buttonDetails.disabled}
                        onClick={props.buttonDetails.action}
                    >
                        {props.buttonDetails.text}
                    </button>
                </div>
                <div className='plan_billing_cycle delinquency'>
                    {Boolean(!props.isCloudDelinquencyGreaterThan90Days) && (
                        <FormattedMessage
                            defaultMessage={
                                'When you reactivate your subscription, you\'ll be billed the total outstanding amount immediately. Your bill is calculated at the end of the billing cycle based on the number of active users. {seeHowBillingWorks}'
                            }
                            id={'cloud_delinquency.cc_modal.disclaimer'}
                            values={{
                                seeHowBillingWorks: (
                                    <a onClick={seeHowBillingWorks}>
                                        <FormattedMessage
                                            defaultMessage={
                                                'See how billing works.'
                                            }
                                            id={
                                                'admin.billing.subscription.howItWorks'
                                            }
                                        />
                                    </a>
                                ),
                            }}
                        />
                    )}
                    {Boolean(props.isCloudDelinquencyGreaterThan90Days) && (
                        <FormattedMessage
                            defaultMessage={
                                'When you reactivate your subscription, you\'ll be billed the total outstanding amount immediately. You\'ll also be billed {cost} immediately for a 1 year subscription based on your current active user count of {users} users. {seeHowBillingWorks}'
                            }
                            id={
                                'cloud_delinquency.cc_modal.disclaimer_with_upgrade_info'
                            }
                            values={{
                                cost: `$${props.cost}`,
                                users: props.users,
                                seeHowBillingWorks: (
                                    <a onClick={seeHowBillingWorks}>
                                        <FormattedMessage
                                            defaultMessage={'See how billing works.'}
                                            id={
                                                'admin.billing.subscription.howItWorks'
                                            }
                                        />
                                    </a>
                                ),
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

class PurchaseModal extends React.PureComponent<Props, State> {
    modal = React.createRef();

    public constructor(props: Props) {
        super(props);
        this.state = {
            paymentInfoIsValid: false,
            billingDetails: null,
            billingSameAsShipping: true,
            shippingAddress: null,
            cardInputComplete: false,
            processing: false,
            editPaymentInfo: isEmpty(
                props.customer?.payment_method &&
                    props.customer?.billing_address,
            ),
            currentProduct: findProductInDictionary(
                props.products,
                props.productId,
            ),
            selectedProduct: getSelectedProduct(
                props.products,
                props.yearlyProducts,
                props.productId,
                props.isDelinquencyModal,
                props.isCloudDelinquencyGreaterThan90Days,
            ),
            isUpgradeFromTrial: props.isFreeTrial,
            buttonClickedInfo: '',
            selectedProductPrice: getSelectedProduct(props.products, props.yearlyProducts, props.productId, props.isDelinquencyModal, props.isCloudDelinquencyGreaterThan90Days)?.price_per_seat.toString() || null,
            usersCount: this.props.usersCount,
            seats: {
                quantity: this.props.usersCount.toString(),
                error: this.props.usersCount.toString() === '0' ? errorInvalidNumber : null,
            },
            isSwitchingToAnnual: false,
        };
    }

    async componentDidMount() {
        if (isEmpty(this.state.currentProduct || this.state.selectedProduct)) {
            await this.props.actions.getCloudProducts();
            this.setState({
                currentProduct: findProductInDictionary(this.props.products, this.props.productId),
                selectedProduct: getSelectedProduct(this.props.products, this.props.yearlyProducts, this.props.productId, this.props.isDelinquencyModal, this.props.isCloudDelinquencyGreaterThan90Days),
                selectedProductPrice: getSelectedProduct(this.props.products, this.props.yearlyProducts, this.props.productId, false)?.price_per_seat.toString() ?? null,
            });
        }

        if (this.props.isDelinquencyModal) {
            pageVisited(
                TELEMETRY_CATEGORIES.CLOUD_PURCHASING,
                'pageview_delinquency_cc_update',
            );
            this.props.actions.getInvoices();
        } else {
            pageVisited(TELEMETRY_CATEGORIES.CLOUD_PURCHASING, 'pageview_purchase');
        }

        this.props.actions.getClientConfig();
    }

    getDelinquencyTotalString = () => {
        let totalOwed = 0;
        this.props.invoices?.forEach((invoice) => {
            totalOwed += invoice.total;
        });
        return `$${totalOwed / 100}`;
    };

    onPaymentInput = (billing: BillingDetails) => {
        this.setState({billingDetails: billing}, this.isFormComplete);
    };

    isFormComplete = () => {
        let paymentInfoIsValid = areBillingDetailsValid(this.state.billingDetails) && this.state.cardInputComplete;
        if (!this.state.billingSameAsShipping) {
            paymentInfoIsValid = paymentInfoIsValid && areShippingDetailsValid(this.state.shippingAddress);
        }
        this.setState({paymentInfoIsValid});
    };

    handleShippingSameAsBillingChange(value: boolean) {
        this.setState({billingSameAsShipping: value}, this.isFormComplete);
    }

    onShippingInput = (address: Address) => {
        this.setState({shippingAddress: {...this.state.shippingAddress, ...address}}, this.isFormComplete);
    };

    handleCardInputChange = (event: StripeCardElementChangeEvent) => {
        this.setState({
            paymentInfoIsValid:
                areBillingDetailsValid(this.state.billingDetails) && event.complete,
        });
        this.setState({cardInputComplete: event.complete});
    };

    handleSubmitClick = async (callerInfo: string) => {
        const update = {
            selectedProduct: this.state.selectedProduct,
            paymentInfoIsValid: false,
            buttonClickedInfo: callerInfo,
            processing: true,
        } as unknown as Pick<State, keyof State>;
        this.setState(update);
    };

    confirmSwitchToAnnual = () => {
        const {customer} = this.props;
        this.props.actions.openModal({
            modalId: ModalIdentifiers.CONFIRM_SWITCH_TO_YEARLY,
            dialogType: SwitchToYearlyPlanConfirmModal,
            dialogProps: {
                confirmSwitchToYearlyFunc: () => {
                    this.handleSubmitClick(this.props.callerCTA + '> purchase_modal > confirm_switch_to_annual_modal > confirm_click');
                    this.setState({isSwitchingToAnnual: true});
                },
                contactSalesFunc: () => {
                    trackEvent(
                        TELEMETRY_CATEGORIES.CLOUD_ADMIN,
                        'confirm_switch_to_annual_click_contact_sales',
                    );
                    const customerEmail = customer?.email || '';
                    const firstName = customer?.contact_first_name || '';
                    const lastName = customer?.contact_last_name || '';
                    const companyName = customer?.name || '';
                    goToMattermostContactSalesForm(firstName, lastName, companyName, customerEmail, 'mattermost', 'in-product-cloud');
                },
            },
        });
    };

    setIsUpgradeFromTrialToFalse = () => {
        this.setState({isUpgradeFromTrial: false});
    };

    openPricingModal = (callerInfo: string) => {
        this.props.actions.openModal({
            modalId: ModalIdentifiers.PRICING_MODAL,
            dialogType: PricingModal,
            dialogProps: {
                callerCTA: callerInfo,
            },
        });
    };

    comparePlan = (
        <button
            className='ml-1'
            onClick={() => {
                trackEvent(TELEMETRY_CATEGORIES.CLOUD_PRICING, 'click_compare_plans');
                this.openPricingModal('purchase_modal_compare_plans_click');
            }}
        >
            <FormattedMessage
                id='cloud_subscribe.contact_support'
                defaultMessage='Compare plans'
            />
        </button>
    );

    contactSalesLink = (text: ReactNode) => {
        return (
            <ExternalLink
                className='footer-text'
                onClick={() => {
                    trackEvent(
                        TELEMETRY_CATEGORIES.CLOUD_PURCHASING,
                        'click_contact_sales',
                    );
                }}
                href={this.props.contactSalesLink}
                location='purchase_modal'
            >
                {text}
            </ExternalLink>
        );
    };

    learnMoreLink = () => {
        return (
            <ExternalLink
                className='footer-text'
                onClick={() => {
                    trackEvent(
                        TELEMETRY_CATEGORIES.CLOUD_PURCHASING,
                        'learn_more_prorated_payment',
                    );
                }}
                href={CloudLinks.PRORATED_PAYMENT}
                location='purchase_modal'
            >
                <FormattedMessage
                    defaultMessage={'Learn more'}
                    id={'admin.billing.subscription.LearnMore'}
                />
            </ExternalLink>
        );
    };

    editPaymentInfoHandler = () => {
        this.setState((prevState: State) => {
            return {
                ...prevState,
                editPaymentInfo: !prevState.editPaymentInfo,
            };
        });
    };

    paymentFooterText = () => {
        const normalPaymentText = (
            <div className='plan_payment_commencement'>
                <FormattedMessage
                    defaultMessage={'You\'ll be billed from: {beginDate}'}
                    id={'admin.billing.subscription.billedFrom'}
                    values={{
                        beginDate: getNextBillingDate(),
                    }}
                />
            </div>
        );

        let payment = normalPaymentText;
        if (!this.props.isFreeTrial && this.state.currentProduct?.billing_scheme === BillingSchemes.FLAT_FEE &&
            this.state.selectedProduct?.billing_scheme === BillingSchemes.PER_SEAT) {
            const announcementTooltip = (
                <Tooltip
                    id='proratedPayment__tooltip'
                    className='proratedTooltip'
                >
                    <div className='tooltipTitle'>
                        <FormattedMessage
                            defaultMessage={'Prorated Payments'}
                            id={'admin.billing.subscription.proratedPayment.tooltipTitle'}
                        />
                    </div>
                    <div className='tooltipText'>
                        <FormattedMessage
                            defaultMessage={'If you upgrade to {selectedProductName} from {currentProductName} mid-month, you will be charged a prorated amount for both plans.'}
                            id={'admin.billing.subscription.proratedPayment.tooltipText'}
                            values={{
                                beginDate: getNextBillingDate(),
                                selectedProductName: this.state.selectedProduct?.name,
                                currentProductName: this.state.currentProduct?.name,
                            }}
                        />
                    </div>
                </Tooltip>
            );

            const announcementIcon = (
                <OverlayTrigger
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='top'
                    overlay={announcementTooltip}
                >
                    <div className='content__icon'>{'\uF5D6'}</div>
                </OverlayTrigger>

            );
            const prorratedPaymentText = (
                <div className='prorrated-payment-text'>
                    {announcementIcon}
                    <FormattedMessage
                        defaultMessage={'Prorated payment begins: {beginDate}. '}
                        id={'admin.billing.subscription.proratedPaymentBegins'}
                        values={{
                            beginDate: getNextBillingDate(),
                        }}
                    />
                    {this.learnMoreLink()}
                </div>
            );
            payment = prorratedPaymentText;
        }
        return payment;
    };

    getPlanNameFromProductName = (productName: string): string => {
        if (productName.length > 0) {
            const [name] = productName.split(' ').slice(-1);
            return name;
        }

        return productName;
    };

    getShippingAddressForProcessing = (): Address => {
        if (this.state.billingSameAsShipping) {
            return {
                line1: this.state.billingDetails?.address || '',
                line2: this.state.billingDetails?.address2 || '',
                city: this.state.billingDetails?.city || '',
                state: this.state.billingDetails?.state || '',
                postal_code: this.state.billingDetails?.postalCode || '',
                country: this.state.billingDetails?.country || '',
            };
        }

        return this.state.shippingAddress as Address;
    };

    handleViewBreakdownClick = () => {
        this.props.actions.openModal({
            modalId: ModalIdentifiers.BILLING_HISTORY,
            dialogType: BillingHistoryModal,
            dialogProps: {
                invoices: this.props.invoices,
            },
        });
    };

    purchaseScreenCard = () => {
        if (this.props.isDelinquencyModal) {
            return (
                <>
                    {this.props.isCloudDelinquencyGreaterThan90Days ? null : (
                        <div className='plan_comparison'>
                            {this.comparePlan}
                        </div>
                    )}
                    <DelinquencyCard
                        topColor='#4A69AC'
                        price={this.getDelinquencyTotalString()}
                        buttonDetails={{
                            action: () => this.handleSubmitClick(this.props.callerCTA + '> purchase_modal > upgrade_button_click'),
                            text: localizeMessage(
                                'cloud_delinquency.cc_modal.card.reactivate',
                                'Re-active',
                            ),
                            customClass: this.state.paymentInfoIsValid ? ButtonCustomiserClasses.special : ButtonCustomiserClasses.grayed,
                            disabled: !this.state.paymentInfoIsValid,
                        }}
                        onViewBreakdownClick={this.handleViewBreakdownClick}
                        isCloudDelinquencyGreaterThan90Days={this.props.isCloudDelinquencyGreaterThan90Days}
                        cost={parseInt(this.state.selectedProductPrice || '', 10) * this.props.usersCount}
                        users={this.props.usersCount}
                    />
                </>
            );
        }

        const showPlanLabel = this.state.selectedProduct?.sku === CloudProducts.PROFESSIONAL;
        const {formatMessage, formatNumber} = this.props.intl;

        const checkIsYearlyProfessionalProduct = (product: Product | null | undefined) => {
            if (!product) {
                return false;
            }
            return product.recurring_interval === RecurringIntervals.YEAR && product.sku === CloudProducts.PROFESSIONAL;
        };

        const yearlyProductMonthlyPrice = formatNumber(parseInt(this.state.selectedProductPrice || '0', 10) / 12, {maximumFractionDigits: 2});

        const currentProductMonthly = this.state.currentProduct?.recurring_interval === RecurringIntervals.MONTH;
        const currentProductProfessional = this.state.currentProduct?.sku === CloudProducts.PROFESSIONAL;
        const currentProductMonthlyProfessional = currentProductMonthly && currentProductProfessional;

        const cardBtnText = currentProductMonthlyProfessional ? formatMessage({id: 'pricing_modal.btn.switch_to_annual', defaultMessage: 'Switch to annual billing'}) : formatMessage({id: 'pricing_modal.btn.upgrade', defaultMessage: 'Upgrade'});

        return (
            <>
                <div
                    className={showPlanLabel ? 'plan_comparison show_label' : 'plan_comparison'}
                >
                    {this.comparePlan}
                </div>
                <Card
                    topColor='#4A69AC'
                    plan={this.getPlanNameFromProductName(
                        this.state.selectedProduct ? this.state.selectedProduct.name : '',
                    )}
                    price={yearlyProductMonthlyPrice}
                    rate={formatMessage({id: 'pricing_modal.rate.seatPerMonth', defaultMessage: 'USD per seat/month {br}<b>(billed annually)</b>'}, {
                        br: <br/>,
                        b: (chunks: React.ReactNode | React.ReactNodeArray) => (
                            <span style={{fontSize: '14px'}}>
                                <b>{chunks}</b>
                            </span>
                        ),
                    })}
                    planBriefing={<></>}
                    buttonDetails={{
                        action: () => {
                            if (currentProductMonthlyProfessional) {
                                this.confirmSwitchToAnnual();
                            } else {
                                this.handleSubmitClick(this.props.callerCTA + '> purchase_modal > upgrade_button_click');
                            }
                        },
                        text: cardBtnText,
                        customClass:
                            !this.state.paymentInfoIsValid ||
                            this.state.selectedProduct?.billing_scheme === BillingSchemes.SALES_SERVE || this.state.seats.error !== null ||
                            (checkIsYearlyProfessionalProduct(this.state.currentProduct)) ? ButtonCustomiserClasses.grayed : ButtonCustomiserClasses.special,
                        disabled:
                            !this.state.paymentInfoIsValid ||
                            this.state.selectedProduct?.billing_scheme === BillingSchemes.SALES_SERVE ||
                            this.state.seats.error !== null ||
                            (checkIsYearlyProfessionalProduct(this.state.currentProduct)),
                    }}
                    planLabel={
                        showPlanLabel ? (
                            <PlanLabel
                                text={formatMessage({
                                    id: 'pricing_modal.planLabel.mostPopular',
                                    defaultMessage: 'MOST POPULAR',
                                })}
                                bgColor='var(--title-color-indigo-500)'
                                color='var(--button-color)'
                                firstSvg={<StarMarkSvg/>}
                                secondSvg={<StarMarkSvg/>}
                            />
                        ) : undefined
                    }
                    preButtonContent={(
                        <SeatsCalculator
                            price={parseInt(yearlyProductMonthlyPrice, 10)}
                            seats={this.state.seats}
                            existingUsers={this.props.usersCount}
                            isCloud={true}
                            onChange={(seats: Seats) => {
                                this.setState({seats});
                            }}
                        />
                    )}
                    afterButtonContent={
                        <Consequences
                            isCloud={true}
                            licenseAgreementBtnText={cardBtnText}
                        />
                    }
                />
            </>
        );
    };

    purchaseScreen = () => {
        const title = (
            <FormattedMessage
                defaultMessage={'Provide your payment details'}
                id={'admin.billing.subscription.providePaymentDetails'}
            />
        );

        let initialBillingDetails;
        let validBillingDetails = false;

        if (this.props.customer?.billing_address && this.props.customer?.payment_method) {
            initialBillingDetails = {
                address: this.props.customer?.billing_address.line1,
                address2: this.props.customer?.billing_address.line2,
                city: this.props.customer?.billing_address.city,
                state: this.props.customer?.billing_address.state,
                country: this.props.customer?.billing_address.country,
                postalCode: this.props.customer?.billing_address.postal_code,
                name: this.props.customer?.payment_method.name,
            } as BillingDetails;

            validBillingDetails = areBillingDetailsValid(initialBillingDetails);
        }

        return (
            <div className={classnames('PurchaseModal__purchase-body', {processing: this.state.processing})}>
                <div className='LHS'>
                    <h2 className='title'>{title}</h2>
                    <UpgradeSvg
                        width={267}
                        height={227}
                    />
                    <div className='footer-text'>{'Questions?'}</div>
                    {this.contactSalesLink('Contact Sales')}
                </div>
                <div className='central-panel'>
                    {this.state.editPaymentInfo || !validBillingDetails ? (
                        <PaymentForm
                            className='normal-text'
                            onInputChange={this.onPaymentInput}
                            onCardInputChange={this.handleCardInputChange}
                            initialBillingDetails={initialBillingDetails}
                            theme={this.props.theme}
                            customer={this.props.customer}
                        />
                    ) : (
                        <div className='PaymentDetails'>
                            <div className='title'>
                                <FormattedMessage
                                    defaultMessage='Your saved payment details'
                                    id='admin.billing.purchaseModal.savedPaymentDetailsTitle'
                                />
                            </div>
                            <PaymentDetails>
                                <button
                                    onClick={this.editPaymentInfoHandler}
                                    className='editPaymentButton'
                                >
                                    <FormattedMessage
                                        defaultMessage='Edit'
                                        id='admin.billing.purchaseModal.editPaymentInfoButton'
                                    />
                                </button>
                            </PaymentDetails>
                        </div>
                    )}
                    <div className='shipping-address-section'>
                        <input
                            id='address-same-than-billing-address'
                            className='Form-checkbox-input'
                            name='terms'
                            type='checkbox'
                            checked={this.state.billingSameAsShipping}
                            onChange={() =>
                                this.handleShippingSameAsBillingChange(
                                    !this.state.billingSameAsShipping,
                                )
                            }
                        />
                        <span className='Form-checkbox-label'>
                            <button
                                onClick={() =>
                                    this.handleShippingSameAsBillingChange(
                                        !this.state.billingSameAsShipping,
                                    )
                                }
                                type='button'
                                className='no-style'
                            >
                                <span className='billing_address_btn_text'>
                                    {this.props.intl.formatMessage({
                                        id: 'admin.billing.subscription.complianceScreenShippingSameAsBilling',
                                        defaultMessage:
                                            'My shipping address is the same as my billing address',
                                    })}
                                </span>
                            </button>
                        </span>
                    </div>
                    {!this.state.billingSameAsShipping && (
                        <AddressForm
                            onAddressChange={this.onShippingInput}
                            onBlur={() => {}}
                            title={{
                                id: 'payment_form.shipping_address',
                                defaultMessage: 'Shipping Address',
                            }}
                            formId={'shippingAddress'}

                            // Setup the initial country based on their billing country, or USA.
                            address={
                                this.state.shippingAddress ||
                                getBlankAddressWithCountry(
                                    this.state.billingDetails?.country || 'US',
                                )
                            }
                        />
                    )}
                </div>
                <div className='RHS'>{this.purchaseScreenCard()}</div>
            </div>
        );
    };

    render() {
        if (this.props.isComplianceBlocked) {
            return (
                <RootPortal>
                    <FullScreenModal
                        show={Boolean(this.props.show)}
                        onClose={() => {
                            trackEvent(
                                TELEMETRY_CATEGORIES.CLOUD_PURCHASING,
                                'click_close_purchasing_screen',
                            );
                            this.props.actions.getCloudSubscription();
                            this.props.actions.closeModal();
                        }}
                        ref={this.modal}
                        ariaLabelledBy='purchase_modal_title'
                    >
                        <div className='PurchaseModal'>
                            <IconMessage
                                title={t(
                                    'admin.billing.subscription.complianceScreenFailed.title',
                                )}
                                icon={
                                    <ComplianceScreenFailedSvg
                                        width={321}
                                        height={246}
                                    />
                                }
                                buttonText={t(
                                    'admin.billing.subscription.complianceScreenFailed.button',
                                )}
                                buttonHandler={() =>
                                    this.props.actions.closeModal()
                                }
                                linkText={t(
                                    'admin.billing.subscription.privateCloudCard.contactSupport',
                                )}
                                linkURL={this.props.contactSupportLink}
                                className={'failed'}
                            />
                        </div>
                    </FullScreenModal>
                </RootPortal>
            );
        }
        if (!stripePromise) {
            stripePromise = loadStripe(this.props.stripePublicKey);
        }

        return (
            <Elements
                options={{fonts: [{cssSrc: STRIPE_CSS_SRC}]}}
                stripe={stripePromise}
            >
                <RootPortal>
                    <FullScreenModal
                        show={Boolean(this.props.show)}
                        onClose={() => {
                            trackEvent(
                                TELEMETRY_CATEGORIES.CLOUD_PURCHASING,
                                'click_close_purchasing_screen',
                            );
                            this.props.actions.getCloudSubscription();
                            this.props.actions.closeModal();
                        }}
                        ref={this.modal}
                        ariaLabelledBy='purchase_modal_title'
                        overrideTargetEvent={false}
                    >
                        <div className='PurchaseModal'>
                            {this.state.processing ? (
                                <div>
                                    <ProcessPaymentSetup
                                        stripe={stripePromise}
                                        billingDetails={
                                            this.state.billingDetails
                                        }
                                        shippingAddress={
                                            this.getShippingAddressForProcessing()
                                        }
                                        addPaymentMethod={
                                            this.props.actions.
                                                completeStripeAddPaymentMethod
                                        }
                                        subscribeCloudSubscription={
                                            this.props.actions.
                                                subscribeCloudSubscription
                                        }
                                        cwsMockMode={this.props.cwsMockMode}
                                        onClose={() => {
                                            this.props.actions.getCloudSubscription();
                                            this.props.actions.closeModal();
                                        }}
                                        onBack={() => {
                                            this.setState({
                                                processing: false,
                                            });
                                        }}
                                        contactSupportLink={
                                            this.props.contactSupportLink
                                        }
                                        currentTeam={this.props.currentTeam}
                                        onSuccess={() => {
                                            // Success only happens if all invoices have been paid.
                                            if (this.props.isDelinquencyModal) {
                                                trackEvent(TELEMETRY_CATEGORIES.CLOUD_DELINQUENCY, 'paid_arrears');
                                            }
                                        }}
                                        selectedProduct={this.state.selectedProduct}
                                        currentProduct={this.state.currentProduct}
                                        isProratedPayment={(!this.props.isFreeTrial && this.state.currentProduct?.billing_scheme === BillingSchemes.FLAT_FEE) &&
                                        this.state.selectedProduct?.billing_scheme === BillingSchemes.PER_SEAT}
                                        setIsUpgradeFromTrialToFalse={this.setIsUpgradeFromTrialToFalse}
                                        isUpgradeFromTrial={this.state.isUpgradeFromTrial}
                                        isSwitchingToAnnual={this.state.isSwitchingToAnnual}
                                        telemetryProps={{
                                            callerInfo:
                                                this.state.buttonClickedInfo,
                                        }}
                                        usersCount={parseInt(this.state.seats.quantity, 10)}
                                    />
                                </div>
                            ) : null}
                            {this.purchaseScreen()}
                            <div className='background-svg'>
                                <BackgroundSvg/>
                            </div>
                        </div>
                    </FullScreenModal>
                </RootPortal>
            </Elements>
        );
    }
}

export default injectIntl(PurchaseModal);
