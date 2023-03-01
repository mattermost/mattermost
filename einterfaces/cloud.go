// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost-server/v6/model"
)

type CloudInterface interface {
	GetCloudProduct(userID string, productID string) (*model.Product, error)
	GetCloudProducts(userID string, includeLegacyProducts bool) ([]*model.Product, error)
	GetSelfHostedProducts(userID string) ([]*model.Product, error)
	GetCloudLimits(userID string) (*model.ProductLimits, error)

	CreateCustomerPayment(userID string) (*model.StripeSetupIntent, error)
	ConfirmCustomerPayment(userID string, confirmRequest *model.ConfirmPaymentMethodRequest) error

	GetCloudCustomer(userID string) (*model.CloudCustomer, error)
	GetLicenseSelfServeStatus(userID string, token string) (*model.SubscriptionLicenseSelfServeStatusResponse, error)
	UpdateCloudCustomer(userID string, customerInfo *model.CloudCustomerInfo) (*model.CloudCustomer, error)
	UpdateCloudCustomerAddress(userID string, address *model.Address) (*model.CloudCustomer, error)

	GetSubscription(userID string) (*model.Subscription, error)
	GetInvoicesForSubscription(userID string) ([]*model.Invoice, error)
	GetInvoicePDF(userID, invoiceID string) ([]byte, string, error)

	ChangeSubscription(userID, subscriptionID string, subscriptionChange *model.SubscriptionChange) (*model.Subscription, error)

	RequestCloudTrial(userID, subscriptionID, newValidBusinessEmail string) (*model.Subscription, error)
	ValidateBusinessEmail(userID, email string) error

	InvalidateCaches() error

	// hosted customer methods
	SelfHostedSignupAvailable() error
	BootstrapSelfHostedSignup(req model.BootstrapSelfHostedSignupRequest) (*model.BootstrapSelfHostedSignupResponse, error)
	CreateCustomerSelfHostedSignup(req model.SelfHostedCustomerForm, requesterEmail string) (*model.SelfHostedSignupCustomerResponse, error)
	ConfirmSelfHostedSignup(req model.SelfHostedConfirmPaymentMethodRequest, requesterEmail string) (*model.SelfHostedSignupConfirmResponse, error)
	ConfirmSelfHostedSignupLicenseApplication() error
	GetSelfHostedInvoices() ([]*model.Invoice, error)
	GetSelfHostedInvoicePDF(invoiceID string) ([]byte, string, error)

	CreateOrUpdateSubscriptionHistoryEvent(userID string, userCount int) (*model.SubscriptionHistory, error)
	HandleLicenseChange() error

	CheckCWSConnection(userId string) error

	SelfServeDeleteWorkspace(userID string, deletionRequest *model.WorkspaceDeletionRequest) error
}
