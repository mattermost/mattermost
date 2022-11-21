// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
)

const (
	EventTypeFailedPayment                = "failed-payment"
	EventTypeFailedPaymentNoCard          = "failed-payment-no-card"
	EventTypeSendAdminWelcomeEmail        = "send-admin-welcome-email"
	EventTypeSendUpgradeConfirmationEmail = "send-upgrade-confirmation-email"
	EventTypeSubscriptionChanged          = "subscription-changed"
	EventTypeTriggerDelinquencyEmail      = "trigger-delinquency-email"
)

var MockCWS string

type BillingScheme string

const (
	BillingSchemePerSeat    = BillingScheme("per_seat")
	BillingSchemeFlatFee    = BillingScheme("flat_fee")
	BillingSchemeSalesServe = BillingScheme("sales_serve")
)

type RecurringInterval string

const (
	RecurringIntervalYearly  = RecurringInterval("year")
	RecurringIntervalMonthly = RecurringInterval("month")
)

type SubscriptionFamily string

const (
	SubscriptionFamilyCloud  = SubscriptionFamily("cloud")
	SubscriptionFamilyOnPrem = SubscriptionFamily("on-prem")
)

// Product model represents a product on the cloud system.
type Product struct {
	ID                string             `json:"id"`
	Name              string             `json:"name"`
	Description       string             `json:"description"`
	PricePerSeat      float64            `json:"price_per_seat"`
	AddOns            []*AddOn           `json:"add_ons"`
	SKU               string             `json:"sku"`
	PriceID           string             `json:"price_id"`
	Family            SubscriptionFamily `json:"product_family"`
	RecurringInterval RecurringInterval  `json:"recurring_interval"`
	BillingScheme     BillingScheme      `json:"billing_scheme"`
	CrossSellsTo      string             `json:"cross_sells_to"`
}

type UserFacingProduct struct {
	ID                string            `json:"id"`
	Name              string            `json:"name"`
	SKU               string            `json:"sku"`
	PricePerSeat      float64           `json:"price_per_seat"`
	RecurringInterval RecurringInterval `json:"recurring_interval"`
	CrossSellsTo      string            `json:"cross_sells_to"`
}

// AddOn represents an addon to a product.
type AddOn struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	DisplayName  string  `json:"display_name"`
	PricePerSeat float64 `json:"price_per_seat"`
}

// StripeSetupIntent represents the SetupIntent model from Stripe for updating payment methods.
type StripeSetupIntent struct {
	ID           string `json:"id"`
	ClientSecret string `json:"client_secret"`
}

// ConfirmPaymentMethodRequest contains the fields for the customer payment update API.
type ConfirmPaymentMethodRequest struct {
	StripeSetupIntentID string `json:"stripe_setup_intent_id"`
	SubscriptionID      string `json:"subscription_id"`
}

// Customer model represents a customer on the system.
type CloudCustomer struct {
	CloudCustomerInfo
	ID             string         `json:"id"`
	CreatorID      string         `json:"creator_id"`
	CreateAt       int64          `json:"create_at"`
	BillingAddress *Address       `json:"billing_address"`
	CompanyAddress *Address       `json:"company_address"`
	PaymentMethod  *PaymentMethod `json:"payment_method"`
}

type StartCloudTrialRequest struct {
	Email          string `json:"email"`
	SubscriptionID string `json:"subscription_id"`
}

type ValidateBusinessEmailRequest struct {
	Email string `json:"email"`
}

type ValidateBusinessEmailResponse struct {
	IsValid bool `json:"is_valid"`
}

// CloudCustomerInfo represents editable info of a customer.
type CloudCustomerInfo struct {
	Name                  string `json:"name"`
	Email                 string `json:"email,omitempty"`
	ContactFirstName      string `json:"contact_first_name,omitempty"`
	ContactLastName       string `json:"contact_last_name,omitempty"`
	NumEmployees          int    `json:"num_employees"`
	CloudAltPaymentMethod string `json:"monthly_subscription_alt_payment_method"`
}

// Address model represents a customer's address.
type Address struct {
	City       string `json:"city"`
	Country    string `json:"country"`
	Line1      string `json:"line1"`
	Line2      string `json:"line2"`
	PostalCode string `json:"postal_code"`
	State      string `json:"state"`
}

// PaymentMethod represents methods of payment for a customer.
type PaymentMethod struct {
	Type      string `json:"type"`
	LastFour  string `json:"last_four"`
	ExpMonth  int    `json:"exp_month"`
	ExpYear   int    `json:"exp_year"`
	CardBrand string `json:"card_brand"`
	Name      string `json:"name"`
}

// Subscription model represents a subscription on the system.
type Subscription struct {
	ID                      string   `json:"id"`
	CustomerID              string   `json:"customer_id"`
	ProductID               string   `json:"product_id"`
	AddOns                  []string `json:"add_ons"`
	StartAt                 int64    `json:"start_at"`
	EndAt                   int64    `json:"end_at"`
	CreateAt                int64    `json:"create_at"`
	Seats                   int      `json:"seats"`
	Status                  string   `json:"status"`
	DNS                     string   `json:"dns"`
	IsPaidTier              string   `json:"is_paid_tier"`
	LastInvoice             *Invoice `json:"last_invoice"`
	IsFreeTrial             string   `json:"is_free_trial"`
	TrialEndAt              int64    `json:"trial_end_at"`
	DelinquentSince         *int64   `json:"delinquent_since"`
	OriginallyLicensedSeats int      `json:"originally_licensed_seats"`
}

// Subscription History model represents true up event in a yearly subscription
type SubscriptionHistory struct {
	ID             string `json:"id"`
	SubscriptionID string `json:"subscription_id"`
	Seats          int    `json:"seats"`
	CreateAt       int64  `json:"create_at"`
}

type SubscriptionHistoryChange struct {
	SubscriptionID string `json:"subscription_id"`
	Seats          int    `json:"seats"`
	CreateAt       int64  `json:"create_at"`
}

// GetWorkSpaceNameFromDNS returns the work space name. For example from test.mattermost.cloud.com, it returns test
func (s *Subscription) GetWorkSpaceNameFromDNS() string {
	return strings.Split(s.DNS, ".")[0]
}

// Invoice model represents a cloud invoice
type Invoice struct {
	ID                 string             `json:"id"`
	Number             string             `json:"number"`
	CreateAt           int64              `json:"create_at"`
	Total              int64              `json:"total"`
	Tax                int64              `json:"tax"`
	Status             string             `json:"status"`
	Description        string             `json:"description"`
	PeriodStart        int64              `json:"period_start"`
	PeriodEnd          int64              `json:"period_end"`
	SubscriptionID     string             `json:"subscription_id"`
	Items              []*InvoiceLineItem `json:"line_items"`
	CurrentProductName string             `json:"current_product_name"`
}

// InvoiceLineItem model represents a cloud invoice lineitem tied to an invoice.
type InvoiceLineItem struct {
	PriceID      string         `json:"price_id"`
	Total        int64          `json:"total"`
	Quantity     float64        `json:"quantity"`
	PricePerUnit int64          `json:"price_per_unit"`
	Description  string         `json:"description"`
	Type         string         `json:"type"`
	Metadata     map[string]any `json:"metadata"`
}

type DelinquencyEmailTrigger struct {
	EmailToTrigger string `json:"email_to_send"`
}

type DelinquencyEmail string

const (
	DelinquencyEmail7  DelinquencyEmail = "7"
	DelinquencyEmail14 DelinquencyEmail = "14"
	DelinquencyEmail30 DelinquencyEmail = "30"
	DelinquencyEmail45 DelinquencyEmail = "45"
	DelinquencyEmail60 DelinquencyEmail = "60"
	DelinquencyEmail75 DelinquencyEmail = "75"
	DelinquencyEmail90 DelinquencyEmail = "90"
)

type CWSWebhookPayload struct {
	Event                             string                   `json:"event"`
	FailedPayment                     *FailedPayment           `json:"failed_payment"`
	CloudWorkspaceOwner               *CloudWorkspaceOwner     `json:"cloud_workspace_owner"`
	ProductLimits                     *ProductLimits           `json:"product_limits"`
	Subscription                      *Subscription            `json:"subscription"`
	SubscriptionTrialEndUnixTimeStamp int64                    `json:"trial_end_time_stamp"`
	DelinquencyEmail                  *DelinquencyEmailTrigger `json:"delinquency_email"`
}

type FailedPayment struct {
	CardBrand      string `json:"card_brand"`
	LastFour       string `json:"last_four"`
	FailureMessage string `json:"failure_message"`
}

// CloudWorkspaceOwner is part of the CWS Webhook payload that contains information about the user that created the workspace from the CWS
type CloudWorkspaceOwner struct {
	UserName string `json:"username"`
}
type SubscriptionChange struct {
	ProductID string `json:"product_id"`
	Seats     int    `json:"seats"`
}

type BoardsLimits struct {
	Cards *int `json:"cards"`
	Views *int `json:"views"`
}

type FilesLimits struct {
	TotalStorage *int64 `json:"total_storage"`
}

type IntegrationsLimits struct {
	Enabled *int `json:"enabled"`
}

type MessagesLimits struct {
	History *int `json:"history"`
}

type TeamsLimits struct {
	Active *int `json:"active"`
}

type ProductLimits struct {
	Boards       *BoardsLimits       `json:"boards,omitempty"`
	Files        *FilesLimits        `json:"files,omitempty"`
	Integrations *IntegrationsLimits `json:"integrations,omitempty"`
	Messages     *MessagesLimits     `json:"messages,omitempty"`
	Teams        *TeamsLimits        `json:"teams,omitempty"`
}
