// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/v5/model"
)

type CloudInterface interface {
	GetCloudProducts() ([]*model.Product, *model.AppError)

	CreateCustomerPayment() (*model.StripeSetupIntent, *model.AppError)
	ConfirmCustomerPayment(*model.ConfirmPaymentMethodRequest) *model.AppError
}
