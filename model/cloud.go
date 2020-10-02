// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

// Product model represents a product on the cloud system.
type Product struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	PricePerSeat float64  `json:"price_per_seat"`
	AddOns       []*AddOn `json:"add_ons"`
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
}

// Customer model represents a customer on the system.
type CloudCustomer struct {
	ID               string         `json:"id"`
	CreatorID        string         `json:"creator_id"`
	CreateAt         int64          `json:"create_at"`
	Email            string         `json:"email"`
	Name             string         `json:"name"`
	NumEmployees     int            `json:"num_employees"`
	ContactFirstName string         `json:"contact_first_name"`
	ContactLastName  string         `json:"contact_last_name"`
	BillingAddress   *Address       `json:"billing_address"`
	CompanyAddress   *Address       `json:"company_address"`
	PaymentMethod    *PaymentMethod `json:"payment_method"`
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
	LastFour  int    `json:"last_four"`
	ExpMonth  int    `json:"exp_month"`
	ExpYear   int    `json:"exp_year"`
	CardBrand string `json:"card_brand"`
	Name      string `json:"name"`
}

// Subscription model represents a subscription on the system.
type Subscription struct {
	ID         string   `json:"id"`
	CustomerID string   `json:"customer_id"`
	ProductID  string   `json:"product_id"`
	AddOns     []string `json:"add_ons"`
	StartAt    int64    `json:"start_at"`
	EndAt      int64    `json:"end_at"`
	CreateAt   int64    `json:"create_at"`
	Seats      int      `json:"seats"`
	DNS        string   `json:"dns"`
}
