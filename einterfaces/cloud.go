// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

type CloudInterface interface {
	GetCloudProducts(userID string) ([]*model.Product, error)

	CreateCustomerPayment(userID string) (*model.StripeSetupIntent, error)
	ConfirmCustomerPayment(string, *model.ConfirmPaymentMethodRequest) error

	GetCloudCustomer(userID string) (*model.CloudCustomer, error)

	GetSubscription(userID string) (*model.Subscription, error)
}
