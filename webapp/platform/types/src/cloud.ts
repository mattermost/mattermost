// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AllowedIPRange} from './config';
import type {ValueOf} from './utilities';

export type CloudState = {
    subscription?: Subscription;
    products?: Record<string, Product>;
    customer?: CloudCustomer;
    invoices?: Record<string, Invoice>;
    subscriptionStats?: LicenseSelfServeStatusReducer;
    limits: {
        limitsLoaded: boolean;
        limits: Limits;
    };
    errors: {
        subscription?: true;
        products?: true;
        customer?: true;
        invoices?: true;
        limits?: true;
        trueUpReview?: true;
    };
    selfHostedSignup: {
        progress: ValueOf<typeof SelfHostedSignupProgress>;
    };
}

export type Installation = {
    id: string;
    state: string;
    allowed_ip_ranges: AllowedIPRange[];
}

export type Subscription = {
    id: string;
    customer_id: string;
    product_id: string;
    add_ons: string[];
    start_at: number;
    end_at: number;
    create_at: number;
    seats: number;
    last_invoice?: Invoice;
    upcoming_invoice?: Invoice;
    trial_end_at: number;
    is_free_trial: string;
    delinquent_since?: number;
    compliance_blocked?: string;
    billing_type?: string;
    cancel_at?: number;
    will_renew?: string;
    simulated_current_time_ms?: number;
}

export type Product = {
    id: string;
    name: string;
    description: string;
    price_per_seat: number;
    add_ons: AddOn[];
    product_family: string;
    sku: string;
    billing_scheme: string;
    recurring_interval: string;
    cross_sells_to: string;
};

export type AddOn = {
    id: string;
    name: string;
    display_name: string;
    price_per_seat: number;
};

export const TypePurchases = {
    firstSelfHostLicensePurchase: 'first_purchase',
    renewalSelfHost: 'renewal_self',
    monthlySubscription: 'monthly_subscription',
    annualSubscription: 'annual_subscription',
} as const;

export const SelfHostedSignupProgress = {
    START: 'START',
    CREATED_CUSTOMER: 'CREATED_CUSTOMER',
    CREATED_INTENT: 'CREATED_INTENT',
    CONFIRMED_INTENT: 'CONFIRMED_INTENT',
    CREATED_SUBSCRIPTION: 'CREATED_SUBSCRIPTION',
    PAID: 'PAID',
    CREATED_LICENSE: 'CREATED_LICENSE',
} as const;

export type MetadataGatherWireTransferKeys = `${ValueOf<typeof TypePurchases>}_alt_payment_method`

export type CustomerMetadataGatherWireTransfer = Partial<Record<MetadataGatherWireTransferKeys, string>>

// Customer model represents a customer on the system.
export type CloudCustomer = {
    id: string;
    creator_id: string;
    create_at: number;
    email: string;
    name: string;
    num_employees: number;
    contact_first_name: string;
    contact_last_name: string;
    billing_address: Address;
    company_address: Address;
    payment_method: PaymentMethod;
} & CustomerMetadataGatherWireTransfer

export type LicenseSelfServeStatus = {
    is_expandable?: boolean;
    is_renewable?: boolean;
}

type RequestState = 'IDLE' | 'LOADING' | 'ERROR' | 'OK'
export interface LicenseSelfServeStatusReducer extends LicenseSelfServeStatus {
    getRequestState: RequestState;
}

// CustomerPatch model represents a customer patch on the system.
export type CloudCustomerPatch = {
    email?: string;
    name?: string;
    num_employees?: number;
    contact_first_name?: string;
    contact_last_name?: string;
} & CustomerMetadataGatherWireTransfer

// Address model represents a customer's address.
export type Address = {
    city: string;
    country: string;
    line1: string;
    line2: string;
    postal_code: string;
    state: string;
}

// PaymentMethod represents methods of payment for a customer.
export type PaymentMethod = {
    type: string;
    last_four: string;
    exp_month: number;
    exp_year: number;
    card_brand: string;
    name: string;
}

export type NotifyAdminRequest = {
    trial_notification: boolean;
    required_plan: string;
    required_feature: string;
}

// Invoice model represents a invoice on the system.
export type Invoice = {
    id: string;
    number: string;
    create_at: number;
    total: number;
    tax: number;
    status: string;
    description: string;
    period_start: number;
    period_end: number;
    subscription_id: string;
    line_items: InvoiceLineItem[];
    current_product_name: string;
}

// actual string values come from customer-web-server and should be kept in sync with values seen there
export const InvoiceLineItemType = {
    Full: 'full',
    Partial: 'partial',
    OnPremise: 'onpremise',
    Metered: 'metered',
} as const;

// InvoiceLineItem model represents a invoice lineitem tied to an invoice.
export type InvoiceLineItem = {
    price_id: string;
    total: number;
    quantity: number;
    price_per_unit: number;
    description: string;
    type: typeof InvoiceLineItemType[keyof typeof InvoiceLineItemType];
    metadata: Record<string, string>;
    period_start: number;
    period_end: number;
}

export type Limits = {
    messages?: {
        history?: number;
    };
    files?: {
        total_storage?: number;
    };
    teams?: {
        active?: number;
    };
}

export interface CloudUsage {
    files: {
        totalStorage: number;
        totalStorageLoaded: boolean;
    };
    messages: {
        history: number;
        historyLoaded: boolean;
    };
    teams: TeamsUsage;
}

export type TeamsUsage = {
    active: number;
    cloudArchived: number;
    teamsLoaded: boolean;
}

export type ValidBusinessEmail = {
    is_valid: boolean;
}

export interface CreateSubscriptionRequest {
    product_id: string;
    add_ons: string[];
    seats: number;
    internal_purchase_order?: string;
}

export interface NewsletterRequestBody {
    email: string;
    subscribed_content: string;
}

export const areShippingDetailsValid = (address: Address | null | undefined): boolean => {
    if (!address) {
        return false;
    }
    return Boolean(address.city && address.country && address.line1 && address.postal_code && address.state);
};
export type Feedback = {
    reason: string;
    comments: string;
}

export type WorkspaceDeletionRequest = {
    subscription_id: string;
    delete_feedback: Feedback;
}
