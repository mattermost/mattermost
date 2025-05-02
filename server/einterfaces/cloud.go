// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"mime/multipart"

	"github.com/mattermost/mattermost/server/public/model"
)

type CloudInterface interface {
	GetCloudProduct(userID string, productID string) (*model.Product, error)
	GetCloudProducts(userID string, includeLegacyProducts bool) ([]*model.Product, error)
	GetSelfHostedProducts(userID string) ([]*model.Product, error)
	GetCloudLimits(userID string) (*model.ProductLimits, error)

	GetCloudCustomer(userID string) (*model.CloudCustomer, error)
	UpdateCloudCustomer(userID string, customerInfo *model.CloudCustomerInfo) (*model.CloudCustomer, error)
	UpdateCloudCustomerAddress(userID string, address *model.Address) (*model.CloudCustomer, error)

	GetSubscription(userID string) (*model.Subscription, error)
	GetInvoicesForSubscription(userID string) ([]*model.Invoice, error)
	GetInvoicePDF(userID, invoiceID string) ([]byte, string, error)

	ChangeSubscription(userID, subscriptionID string, subscriptionChange *model.SubscriptionChange) (*model.Subscription, error)

	ValidateBusinessEmail(userID, email string) error

	InvalidateCaches() error

	CreateOrUpdateSubscriptionHistoryEvent(userID string, userCount int) (*model.SubscriptionHistory, error)
	HandleLicenseChange() error

	CheckCWSConnection(userId string) error

	SubscribeToNewsletter(userID string, req *model.SubscribeNewsletterRequest) error

	ApplyIPFilters(userID string, ranges *model.AllowedIPRanges) (*model.AllowedIPRanges, error)
	GetIPFilters(userID string) (*model.AllowedIPRanges, error)
	GetInstallation(userID string) (*model.Installation, error)

	RemoveAuditLoggingCert(userID string) error
	CreateAuditLoggingCert(userID string, fileData *multipart.FileHeader) error
}
