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
