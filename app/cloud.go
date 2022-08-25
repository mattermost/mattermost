// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/product"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/store"
)

const lastTrialNotificationTimeStamp = "LAST_TRIAL_NOTIFICATION_TIMESTAMP"
const lastUpgradeNotificationTimeStamp = "LAST_UPGRADE_NOTIFICATION_TIMESTAMP"
const defaultCloudNotifyAdminCoolOffDays = 0.0001157407407 // this is a temp change

// Ensure cloud service wrapper implements `product.CloudService`
var _ product.CloudService = (*cloudWrapper)(nil)

// cloudWrapper provides an implementation of `product.CloudService` for use by products.
type cloudWrapper struct {
	cloud einterfaces.CloudInterface
}

func (a *App) SaveAdminNotification(userId string, notifyData *model.NotifyAdminToUpgradeRequest) *model.AppError {
	requiredFeature := notifyData.RequiredFeature
	requiredPlan := notifyData.RequiredPlan
	trial := notifyData.TrialNotification

	if a.UserAlreadyNotifiedOnRequiredFeature(userId, requiredFeature) {
		return model.NewAppError("app.SaveAdminNotification", "api.cloud.notify_admin_to_upgrade_error.already_notified", nil, "", http.StatusForbidden)
	}

	_, appErr := a.SaveAdminNotifyData(&model.NotifyAdminData{
		UserId:          userId,
		RequiredPlan:    requiredPlan,
		RequiredFeature: requiredFeature,
		Trial:           trial,
	})
	if appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) DoCheckForAdminNotifications(trial bool) *model.AppError {
	ctx := request.EmptyContext(a.Srv().Log())
	subscription, err := a.Cloud().GetSubscription("")
	if err != nil {
		return model.NewAppError("DoCheckForAdminNotifications", "Unable to fetch Subscription", nil, err.Error(), http.StatusInternalServerError)
	}

	products, err := a.Cloud().GetCloudProducts("", true)
	if err != nil {
		return model.NewAppError("DoCheckForAdminNotifications", "Unable to fetch cloud products", nil, err.Error(), http.StatusInternalServerError)
	}

	currentProduct := getCurrentProduct(products, subscription.ProductID)
	if currentProduct == nil {
		return model.NewAppError("DoCheckForAdminNotifications", "current product cannot be nil", nil, err.Error(), http.StatusInternalServerError)
	}
	currentSKU := currentProduct.SKU

	workspaceName := subscription.GetWorkSpaceNameFromDNS()

	return a.SendNotifyAdminPosts(ctx, workspaceName, currentSKU, trial)
}

func (a *App) SaveAdminNotifyData(data *model.NotifyAdminData) (*model.NotifyAdminData, *model.AppError) {
	d, err := a.Srv().Store.NotifyAdmin().Save(data)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("SaveAdminNotifyData", "app.notify_admin.save.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("SaveAdminNotifyData", "app.notify_admin.save.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return d, nil
}

func getCurrentProduct(products []*model.Product, id string) *model.Product {
	for _, product := range products {
		if product.ID == id {
			return product
		}
	}
	return nil
}

func filterNotificationData(data []*model.NotifyAdminData, test func(*model.NotifyAdminData) bool) (ret []*model.NotifyAdminData) {
	for _, d := range data {
		if test(d) {
			ret = append(ret, d)
		}
	}
	return
}

func (a *App) SendNotifyAdminPosts(c *request.Context, workspaceName string, currentSKU string, trial bool) *model.AppError {
	if !a.CanNotifyAdmin(trial) {
		return model.NewAppError("SendNotifyAdminPosts", "app.notify_admin.send_notification_post.app_error", nil, "Cannot notify yet", http.StatusForbidden)
	}

	sysadmins, appErr := a.GetUsersFromProfiles(&model.UserGetOptions{
		Page:     0,
		PerPage:  100,
		Role:     model.SystemAdminRoleId,
		Inactive: false,
	})
	if appErr != nil {
		return appErr
	}

	systemBot, appErr := a.GetSystemBot()
	if appErr != nil {
		return appErr
	}

	now := model.GetMillis()

	data, err := a.Srv().Store.NotifyAdmin().Get(trial)
	if err != nil {
		return model.NewAppError("SendNotifyAdminPosts", "app.notify_admin.send_notification_post.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	data = filterNotificationData(data, func(nad *model.NotifyAdminData) bool { return string(nad.RequiredPlan) != currentSKU })

	if len(data) == 0 {
		mlog.Warn("No notification data available")
		return nil
	}

	userBasedData := a.groupNotifyAdminByUser(data)
	featureBasedData := a.groupNotifyAdminByFeature(data)
	props := make(model.StringInterface)

	for _, admin := range sysadmins {
		T := i18n.GetUserTranslations(admin.Locale)
		message := T("app.cloud.upgrade_plan_bot_message", map[string]interface{}{"UsersNum": len(userBasedData), "WorkspaceName": workspaceName})
		if len(userBasedData) == 1 {
			message = T("app.cloud.upgrade_plan_bot_message_single", map[string]interface{}{"UsersNum": len(userBasedData), "WorkspaceName": workspaceName}) // todo (allan): investigate if translations library can do this
		}
		if trial {
			message = T("app.cloud.trial_plan_bot_message", map[string]interface{}{"UsersNum": len(userBasedData), "WorkspaceName": workspaceName})
			if len(userBasedData) == 1 {
				message = T("app.cloud.trial_plan_bot_message_single", map[string]interface{}{"UsersNum": len(userBasedData), "WorkspaceName": workspaceName})
			}
		}

		channel, appErr := a.GetOrCreateDirectChannel(c, systemBot.UserId, admin.Id)
		if appErr != nil {
			mlog.Warn("Error getting direct channel", mlog.Err(appErr))
			continue
		}

		post := &model.Post{
			Message:   message,
			UserId:    systemBot.UserId,
			ChannelId: channel.Id,
			Type:      fmt.Sprintf("%sup_notification", model.PostCustomTypePrefix), // webapp will have to create renderer for this custom post type

		}

		props["requested_features"] = featureBasedData
		props["trial"] = trial
		post.SetProps(props)

		_, appErr = a.CreatePost(c, post, channel, false, true)
		if appErr != nil {
			mlog.Warn("Error creating post", mlog.Err(appErr))
			continue
		}
	}

	a.FinishSendAdminNotifyPost(trial, now)

	return nil
}

func (a *App) UserAlreadyNotifiedOnRequiredFeature(user string, feature model.MattermostPaidFeature) bool {
	data, err := a.Srv().Store.NotifyAdmin().GetDataByUserIdAndFeature(user, feature)
	if err != nil {
		return true // any error should flag as already notified to avoid data corruption like duplicates
	}
	if len(data) > 0 {
		return true // if we find data, it means this user already notified on the need for this feature
	}

	return false
}

func (a *App) CanNotifyAdmin(trial bool) bool {
	systemVarName := lastUpgradeNotificationTimeStamp
	if trial {
		systemVarName = lastTrialNotificationTimeStamp
	}

	sysVal, sysValErr := a.Srv().Store.System().GetByName(systemVarName)
	if sysValErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(sysValErr, &nfErr) { // if no timestamps have been recorded before, system is free to notify
			return true
		}
		mlog.Error("Cannot notify", mlog.Err(sysValErr))
		return false
	}

	lastNotificationTimestamp, err := strconv.ParseFloat(sysVal.Value, 64)
	if err != nil {
		mlog.Error("Cannot notify", mlog.Err(err))
		return false
	}

	coolOffPeriodDaysEnv := os.Getenv("MM_CLOUD_NOTIFY_ADMIN_COOL_OFF_DAYS")
	coolOffPeriodDays, parseError := strconv.ParseFloat(coolOffPeriodDaysEnv, 64)
	if parseError != nil {
		coolOffPeriodDays = defaultCloudNotifyAdminCoolOffDays
	}
	daysToMillis := coolOffPeriodDays * 24 * 60 * 60 * 1000
	timeDiff := model.GetMillis() - int64(lastNotificationTimestamp)
	return timeDiff >= int64(daysToMillis)
}

func (a *App) FinishSendAdminNotifyPost(trial bool, now int64) {
	systemVarName := lastUpgradeNotificationTimeStamp
	if trial {
		systemVarName = lastTrialNotificationTimeStamp
	}

	val := strconv.FormatInt(model.GetMillis(), 10)
	sysVar := &model.System{Name: systemVarName, Value: val}
	if err := a.Srv().Store.System().SaveOrUpdate(sysVar); err != nil {
		mlog.Error("Unable to finish send admin notify post job", mlog.Err(err))
	}

	// all the notifications are now sent in a post and can safely be removed
	if err := a.Srv().Store.NotifyAdmin().DeleteBefore(trial, now); err != nil {
		mlog.Error("Unable to finish send admin notify post job", mlog.Err(err))
	}

}

func (a *App) groupNotifyAdminByUser(data []*model.NotifyAdminData) map[string][]*model.NotifyAdminData {
	myMap := make(map[string][]*model.NotifyAdminData)
	for _, d := range data {
		myMap[d.UserId] = append(myMap[d.UserId], d)
	}

	return myMap
}

func (a *App) groupNotifyAdminByFeature(data []*model.NotifyAdminData) map[model.MattermostPaidFeature][]*model.NotifyAdminData {
	myMap := make(map[model.MattermostPaidFeature][]*model.NotifyAdminData)
	for _, d := range data {
		myMap[d.RequiredFeature] = append(myMap[d.RequiredFeature], d)
	}

	return myMap
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

func (a *App) SendPaymentFailedEmail(failedPayment *model.FailedPayment) *model.AppError {
	sysAdmins, err := a.getSysAdminsEmailRecipients()
	if err != nil {
		return err
	}

	for _, admin := range sysAdmins {
		_, err := a.Srv().EmailService.SendPaymentFailedEmail(admin.Email, admin.Locale, failedPayment, *a.Config().ServiceSettings.SiteURL)
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
	subscription, err := a.Cloud().GetSubscription("")
	if err != nil {
		return model.NewAppError("SendDelinquencyEmail", "app.cloud.get_subscription.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if subscription == nil {
		return model.NewAppError("SendDelinquencyEmail", "app.cloud.get_subscription.app_error", nil, "", http.StatusInternalServerError)
	}

	products, err := a.Cloud().GetCloudProducts("", false)
	if err != nil {
		return model.NewAppError("SendDelinquencyEmail", "app.cloud.get_cloud_products.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if products == nil {
		return model.NewAppError("SendDelinquencyEmail", "app.cloud.get_cloud_products.app_error", nil, "", http.StatusInternalServerError)
	}

	planName := getCurrentProduct(subscription.ProductID, products).Name

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

func (a *App) SendUpgradeConfirmationEmail() *model.AppError {
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

		err := a.Srv().EmailService.SendCloudUpgradeConfirmationEmail(admin.Email, name, billingDate, admin.Locale, *a.Config().ServiceSettings.SiteURL, subscription.GetWorkSpaceNameFromDNS())
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
