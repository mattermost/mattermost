// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

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
	sysAdmins, err := a.getAllSystemAdmins()
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
	sysAdmins, aErr := a.getAllSystemAdmins()
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
	sysAdmins, e := a.getAllSystemAdmins()
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

	embeddedFiles := make(map[string]io.Reader)
	if isYearly {
		lastInvoice := subscription.LastInvoice
		if lastInvoice == nil {
			a.Log().Error("Last invoice not defined for the subscription", mlog.String("subscription", subscription.ID))
		} else {
			pdf, filename, pdfErr := a.Cloud().GetInvoicePDF("", lastInvoice.ID)
			if pdfErr != nil {
				a.Log().Error("Error retrieving the invoice for subscription id", mlog.String("subscription", subscription.ID), mlog.Err(pdfErr))
			} else {
				embeddedFiles = map[string]io.Reader{
					filename: bytes.NewReader(pdf),
				}
			}
		}
	}

	for _, admin := range sysAdmins {
		name := admin.FirstName
		if name == "" {
			name = admin.Username
		}

		err := a.Srv().EmailService.SendCloudUpgradeConfirmationEmail(admin.Email, name, billingDate, admin.Locale, *a.Config().ServiceSettings.SiteURL, subscription.GetWorkSpaceNameFromDNS(), isYearly, embeddedFiles)
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
	sysAdmins, err := a.getAllSystemAdmins()
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
func (a *App) SendSubscriptionHistoryEvent(userID string) (*model.SubscriptionHistory, error) {
	license := a.Srv().License()

	// No need to create a Subscription History Event if the license isn't cloud
	if !license.IsCloud() {
		return nil, nil
	}

	// Get user count
	userCount, err := a.Srv().Store().User().Count(model.UserCountOptions{})
	if err != nil {
		return nil, err
	}
	return a.Cloud().CreateOrUpdateSubscriptionHistoryEvent(userID, int(userCount))
}

func (a *App) DoSubscriptionRenewalCheck() {
	if !a.License().IsCloud() || !a.Config().FeatureFlags.CloudAnnualRenewals {
		return
	}

	subscription, err := a.Cloud().GetSubscription("")
	if err != nil {
		a.Log().Error("Error getting subscription", mlog.Err(err))
		return
	}

	if subscription == nil {
		a.Log().Error("Subscription not found")
		return
	}

	if subscription.IsFreeTrial == "true" {
		return // Don't send renewal emails for free trials
	}

	if model.BillingType(subscription.BillingType) == model.BillingTypeLicensed || model.BillingType(subscription.BillingType) == model.BillingTypeInternal {
		return // Don't send renewal emails for licensed or internal billing
	}

	sysVar, err := a.Srv().Store().System().GetByName(model.CloudRenewalEmail)
	if err != nil {
		// We only care about the error if it wasn't a not found error
		if _, ok := err.(*store.ErrNotFound); !ok {
			a.Log().Error(err.Error())
		}
	}

	prevSentEmail := int64(0)
	if sysVar != nil {
		// We don't care about parse errors because it's possible the value is empty, and we've already defaulted to 0
		prevSentEmail, _ = strconv.ParseInt(sysVar.Value, 10, 64)
	}

	if subscription.WillRenew == "true" {
		// They've already completed the renewal process so no need to email them.
		// We can zero out the system variable so that this process will work again next year
		if prevSentEmail != 0 {
			sysVar.Value = "0"
			err = a.Srv().Store().System().SaveOrUpdate(sysVar)
			if err != nil {
				a.Log().Error("Error saving system variable", mlog.Err(err))
			}
		}
		return
	}

	var emailFunc func(email, locale, siteURL string) error

	daysToExpiration := subscription.DaysToExpiration()

	// Only send the email if within the period and it's not already been sent
	// This allows the email to send on day 59 if for whatever reason it was unable to on day 60
	if daysToExpiration <= 60 && daysToExpiration > 30 && prevSentEmail != 60 && !(prevSentEmail < 60) {
		emailFunc = a.Srv().EmailService.SendCloudRenewalEmail60
		prevSentEmail = 60
	} else if daysToExpiration <= 30 && daysToExpiration > 7 && prevSentEmail != 30 && !(prevSentEmail < 30) {
		emailFunc = a.Srv().EmailService.SendCloudRenewalEmail30
		prevSentEmail = 30
	} else if daysToExpiration <= 7 && daysToExpiration >= 0 && prevSentEmail != 7 {
		emailFunc = a.Srv().EmailService.SendCloudRenewalEmail7
		prevSentEmail = 7
	}

	if emailFunc == nil {
		return
	}

	sysAdmins, aErr := a.getAllSystemAdmins()
	if aErr != nil {
		a.Log().Error("Error getting sys admins", mlog.Err(aErr))
		return
	}

	numFailed := 0
	for _, admin := range sysAdmins {
		err = emailFunc(admin.Email, admin.Locale, *a.Config().ServiceSettings.SiteURL)
		if err != nil {
			a.Log().Error("Error sending renewal email", mlog.Err(err))
			numFailed += 1
		}
	}

	if numFailed == len(sysAdmins) {
		// If all emails failed, we don't want to update the system variable
		return
	}

	updatedSysVar := &model.System{
		Name:  model.CloudRenewalEmail,
		Value: strconv.FormatInt(prevSentEmail, 10),
	}

	err = a.Srv().Store().System().SaveOrUpdate(updatedSysVar)
	if err != nil {
		a.Log().Error("Error saving system variable", mlog.Err(err))
	}
}
