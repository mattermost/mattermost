// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

type CloudInterface interface {
	GetCloudProducts(userID string) ([]*model.Product, *model.AppError)

	CreateCustomerPayment(userID string) (*model.StripeSetupIntent, *model.AppError)
	ConfirmCustomerPayment(string, *model.ConfirmPaymentMethodRequest) *model.AppError

	GetCloudCustomer(userID string) (*model.CloudCustomer, *model.AppError)

	GetSubscription(userID string) (*model.Subscription, *model.AppError)
}
