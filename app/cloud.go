// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"time"

	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/product"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

// Ensure cloud service wrapper implements `product.CloudService`
var _ product.CloudService = (*cloudWrapper)(nil)

// cloudWrapper provides an implementation of `product.CloudService` for use by products.
type cloudWrapper struct {
	cloud einterfaces.CloudInterface
}

func (c *cloudWrapper) GetCloudLimits() (*model.ProductLimits, error) {
	if c.cloud != nil {
		return c.cloud.GetCloudLimits("")
	}

	return &model.ProductLimits{}, nil
}

func (a *App) getSysAdminsEmailRecipients() ([]*model.User, *model.AppError) {
	userOptions := &model.UserGetOptions{
		Page:     0,
		PerPage:  100,
		Role:     model.SystemAdminRoleId,
		Inactive: false,
	}
	return a.GetUsersFromProfiles(userOptions)
}

func getCurrentPlanName(a *App) (string, *model.AppError) {
	subscription, err := a.Cloud().GetSubscription("")
	if err != nil {
		return "", model.NewAppError("getCurrentPlanName", "app.cloud.get_subscription.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if subscription == nil {
		return "", model.NewAppError("getCurrentPlanName", "app.cloud.get_subscription.app_error", nil, "", http.StatusInternalServerError)
	}

	products, err := a.Cloud().GetCloudProducts("", false)
	if err != nil {
		return "", model.NewAppError("getCurrentPlanName", "app.cloud.get_cloud_products.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if products == nil {
		return "", model.NewAppError("getCurrentPlanName", "app.cloud.get_cloud_products.app_error", nil, "", http.StatusInternalServerError)
	}

	planName := getCurrentProduct(subscription.ProductID, products).Name
	return planName, nil
}

func (a *App) SendPaymentFailedEmail(failedPayment *model.FailedPayment) *model.AppError {
	sysAdmins, err := a.getSysAdminsEmailRecipients()
	if err != nil {
		return err
	}

	planName, err := getCurrentPlanName(a)
	if err != nil {
		return model.NewAppError("SendPaymentFailedEmail", "app.cloud.get_current_plan_name.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for _, admin := range sysAdmins {
		_, err := a.Srv().EmailService.SendPaymentFailedEmail(admin.Email, admin.Locale, failedPayment, planName, *a.Config().ServiceSettings.SiteURL)
		if err != nil {
			a.Log().Error("Error sending payment failed email", mlog.Err(err))
		}
	}
	return nil
}

func getCurrentProduct(subscriptionProductID string, products []*model.Product) *model.Product {
	for _, product := range products {
		if product.ID == subscriptionProductID {
			return product
		}
	}
	return nil
}

func (a *App) SendDelinquencyEmail(emailToSend model.DelinquencyEmail) *model.AppError {
	sysAdmins, aErr := a.getSysAdminsEmailRecipients()
	if aErr != nil {
		return aErr
	}
	planName, aErr := getCurrentPlanName(a)
	if aErr != nil {
		return model.NewAppError("SendDelinquencyEmail", "app.cloud.get_current_plan_name.app_error", nil, aErr.Error(), http.StatusInternalServerError)
	}

	subscription, err := a.Cloud().GetSubscription("")
	if err != nil {
		return model.NewAppError("SendDelinquencyEmail", "app.cloud.get_subscription.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if subscription == nil {
		return model.NewAppError("SendDelinquencyEmail", "app.cloud.get_subscription.app_error", nil, "", http.StatusInternalServerError)
	}

	if subscription.DelinquentSince == nil {
		return model.NewAppError("SendDelinquencyEmail", "app.cloud.get_subscription_delinquency_date.app_error", nil, "", http.StatusInternalServerError)
	}

	delinquentSince := time.Unix(*subscription.DelinquentSince, 0)

	delinquencyDate := delinquentSince.Format("01/02/2006")
	for _, admin := range sysAdmins {
		switch emailToSend {
		case model.DelinquencyEmail7:
			err := a.Srv().EmailService.SendDelinquencyEmail7(admin.Email, admin.Locale, *a.Config().ServiceSettings.SiteURL, planName)
			if err != nil {
				a.Log().Error("Error sending delinquency email 7", mlog.Err(err))
			}
		case model.DelinquencyEmail14:
			err := a.Srv().EmailService.SendDelinquencyEmail14(admin.Email, admin.Locale, *a.Config().ServiceSettings.SiteURL, planName)
			if err != nil {
				a.Log().Error("Error sending delinquency email 14", mlog.Err(err))
			}
		case model.DelinquencyEmail30:
			err := a.Srv().EmailService.SendDelinquencyEmail30(admin.Email, admin.Locale, *a.Config().ServiceSettings.SiteURL, planName)
			if err != nil {
				a.Log().Error("Error sending delinquency email 30", mlog.Err(err))
			}
		case model.DelinquencyEmail45:
			err := a.Srv().EmailService.SendDelinquencyEmail45(admin.Email, admin.Locale, *a.Config().ServiceSettings.SiteURL, planName, delinquencyDate)
			if err != nil {
				a.Log().Error("Error sending delinquency email 45", mlog.Err(err))
			}
		case model.DelinquencyEmail60:
			err := a.Srv().EmailService.SendDelinquencyEmail60(admin.Email, admin.Locale, *a.Config().ServiceSettings.SiteURL)
			if err != nil {
				a.Log().Error("Error sending delinquency email 60", mlog.Err(err))
			}
		case model.DelinquencyEmail75:
			err := a.Srv().EmailService.SendDelinquencyEmail75(admin.Email, admin.Locale, *a.Config().ServiceSettings.SiteURL, planName, delinquencyDate)
			if err != nil {
				a.Log().Error("Error sending delinquency email 75", mlog.Err(err))
			}
		case model.DelinquencyEmail90:
			err := a.Srv().EmailService.SendDelinquencyEmail90(admin.Email, admin.Locale, *a.Config().ServiceSettings.SiteURL)
			if err != nil {
				a.Log().Error("Error sending delinquency email 90", mlog.Err(err))
			}
		}
	}
	return nil
}

func (a *App) AdjustInProductLimits(limits *model.ProductLimits, subscription *model.Subscription) *model.AppError {
	if limits.Teams != nil && limits.Teams.Active != nil && *limits.Teams.Active > 0 {
		err := a.AdjustTeamsFromProductLimits(limits.Teams)
		if err != nil {
			return err
		}
	}

	return nil
}

func getNextBillingDateString() string {
	now := time.Now()
	t := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, time.UTC)
	return fmt.Sprintf("%s %d, %d", t.Month(), t.Day(), t.Year())
}

func (a *App) SendUpgradeConfirmationEmail(isYearly bool) *model.AppError {
	sysAdmins, e := a.getSysAdminsEmailRecipients()
	if e != nil {
		return e
	}

	if len(sysAdmins) == 0 {
		return model.NewAppError("app.SendCloudUpgradeConfirmationEmail", "app.user.send_emails.app_error", nil, "", http.StatusInternalServerError)
	}

	subscription, err := a.Cloud().GetSubscription("")
	if err != nil {
		return model.NewAppError("app.SendCloudUpgradeConfirmationEmail", "app.user.send_emails.app_error", nil, "", http.StatusInternalServerError)
	}

	billingDate := getNextBillingDateString()

	// we want to at least have one email sent out to an admin
	countNotOks := 0

	for _, admin := range sysAdmins {
		name := admin.FirstName
		if name == "" {
			name = admin.Username
		}

		err := a.Srv().EmailService.SendCloudUpgradeConfirmationEmail(admin.Email, name, billingDate, admin.Locale, *a.Config().ServiceSettings.SiteURL, subscription.GetWorkSpaceNameFromDNS(), isYearly)
		if err != nil {
			a.Log().Error("Error sending trial ended email to", mlog.String("email", admin.Email), mlog.Err(err))
			countNotOks++
		}
	}

	// if not even one admin got an email, we consider that this operation errored
	if countNotOks == len(sysAdmins) {
		return model.NewAppError("app.SendCloudUpgradeConfirmationEmail", "app.user.send_emails.app_error", nil, "", http.StatusInternalServerError)
	}

	return nil
}

// SendNoCardPaymentFailedEmail
func (a *App) SendNoCardPaymentFailedEmail() *model.AppError {
	sysAdmins, err := a.getSysAdminsEmailRecipients()
	if err != nil {
		return err
	}

	for _, admin := range sysAdmins {
		err := a.Srv().EmailService.SendNoCardPaymentFailedEmail(admin.Email, admin.Locale, *a.Config().ServiceSettings.SiteURL)
		if err != nil {
			a.Log().Error("Error sending payment failed email", mlog.Err(err))
		}
	}
	return nil
}

// Create/ Update a subscription history event
func (a *App) SendSubscriptionHistoryEvent(userID string) {
	license := a.Srv().License()

	// No need to create a Subscription History Event if the license isn't cloud
	if !license.IsCloud() {
		return
	}

	// Get user count
	userCount, err := a.Srv().Store().User().Count(model.UserCountOptions{})
	if err != nil {
		a.Log().Error("Error getting the user count", mlog.Err(err))
		return
	}

	_, err = a.Cloud().CreateOrUpdateSubscriptionHistoryEvent(userID, int(userCount))
	if err != nil {
		a.Log().Error("Error creating/updating the SubscriptionHistoryEvent", mlog.Err(err))
	}
}
