// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/server/v8/channels/app/request"
	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/i18n"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mail"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
)

func (a *App) GetWarnMetricsStatus() (map[string]*model.WarnMetricStatus, *model.AppError) {
	systemDataList, nErr := a.Srv().Store().System().Get()
	if nErr != nil {
		return nil, model.NewAppError("GetWarnMetricsStatus", "app.system.get.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	isE0Edition := model.BuildEnterpriseReady == "true" // license == nil was already validated upstream

	result := map[string]*model.WarnMetricStatus{}
	for key, value := range systemDataList {
		if strings.HasPrefix(key, model.WarnMetricStatusStorePrefix) {
			if warnMetric, ok := model.WarnMetricsTable[key]; ok {
				if !warnMetric.IsBotOnly && (value == model.WarnMetricStatusRunonce || value == model.WarnMetricStatusLimitReached) {
					result[key], _ = a.getWarnMetricStatusAndDisplayTextsForId(key, nil, isE0Edition)
				}
			}
		}
	}

	return result, nil
}

func (a *App) getWarnMetricStatusAndDisplayTextsForId(warnMetricId string, T i18n.TranslateFunc, isE0Edition bool) (*model.WarnMetricStatus, *model.WarnMetricDisplayTexts) {
	var warnMetricStatus *model.WarnMetricStatus
	var warnMetricDisplayTexts = &model.WarnMetricDisplayTexts{}

	if warnMetric, ok := model.WarnMetricsTable[warnMetricId]; ok {
		warnMetricStatus = &model.WarnMetricStatus{
			Id:    warnMetric.Id,
			Limit: warnMetric.Limit,
			Acked: false,
		}

		if T == nil {
			mlog.Debug("No translation function")
			return warnMetricStatus, nil
		}

		warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.bot_response.notification_success.message")

		switch warnMetricId {
		case model.SystemWarnMetricNumberOfTeams5:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.number_of_teams_5.notification_title")
			if isE0Edition {
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_teams_5.start_trial.notification_body")
				warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.number_of_teams_5.start_trial_notification_success.message")
			} else {
				warnMetricDisplayTexts.EmailBody = T("api.server.warn_metric.number_of_teams_5.contact_us.email_body")
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_teams_5.notification_body")
			}
		case model.SystemWarnMetricMfa:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.mfa.notification_title")
			if isE0Edition {
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.mfa.start_trial.notification_body")
				warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.mfa.start_trial_notification_success.message")
			} else {
				warnMetricDisplayTexts.EmailBody = T("api.server.warn_metric.mfa.contact_us.email_body")
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.mfa.notification_body")
			}
		case model.SystemWarnMetricEmailDomain:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.email_domain.notification_title")
			if isE0Edition {
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.email_domain.start_trial.notification_body")
				warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.email_domain.start_trial_notification_success.message")
			} else {
				warnMetricDisplayTexts.EmailBody = T("api.server.warn_metric.email_domain.contact_us.email_body")
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.email_domain.notification_body")
			}
		case model.SystemWarnMetricNumberOfChannels50:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.number_of_channels_50.notification_title")
			if isE0Edition {
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_channels_50.start_trial.notification_body")
				warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.number_of_channels_50.start_trial.notification_success.message")
			} else {
				warnMetricDisplayTexts.EmailBody = T("api.server.warn_metric.number_of_channels_50.contact_us.email_body")
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_channels_50.notification_body")
			}
		case model.SystemWarnMetricNumberOfActiveUsers100:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.number_of_active_users_100.notification_title")
			if isE0Edition {
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_100.start_trial.notification_body")
				warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.number_of_active_users_100.start_trial.notification_success.message")
			} else {
				warnMetricDisplayTexts.EmailBody = T("api.server.warn_metric.number_of_active_users_100.contact_us.email_body")
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_100.notification_body")
			}
		case model.SystemWarnMetricNumberOfActiveUsers200:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.number_of_active_users_200.notification_title")
			if isE0Edition {
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_200.start_trial.notification_body")
				warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.number_of_active_users_200.start_trial.notification_success.message")
			} else {
				warnMetricDisplayTexts.EmailBody = T("api.server.warn_metric.number_of_active_users_200.contact_us.email_body")
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_200.notification_body")
			}
		case model.SystemWarnMetricNumberOfActiveUsers300:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.number_of_active_users_300.start_trial.notification_title")
			if isE0Edition {
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_300.start_trial.notification_body")
				warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.number_of_active_users_300.start_trial.notification_success.message")
			} else {
				warnMetricDisplayTexts.EmailBody = T("api.server.warn_metric.number_of_active_users_300.contact_us.email_body")
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_300.notification_body")
			}
		case model.SystemWarnMetricNumberOfActiveUsers500:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.number_of_active_users_500.notification_title")
			if isE0Edition {
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_500.start_trial.notification_body")
				warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.number_of_active_users_500.start_trial.notification_success.message")
			} else {
				warnMetricDisplayTexts.EmailBody = T("api.server.warn_metric.number_of_active_users_500.contact_us.email_body")
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_500.notification_body")
			}
		case model.SystemWarnMetricNumberOfPosts2m:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.number_of_posts_2M.notification_title")
			if isE0Edition {
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_posts_2M.start_trial.notification_body")
				warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.number_of_posts_2M.start_trial.notification_success.message")
			} else {
				warnMetricDisplayTexts.EmailBody = T("api.server.warn_metric.number_of_posts_2M.contact_us.email_body")
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_posts_2M.notification_body")
			}
		default:
			mlog.Debug("Invalid metric id", mlog.String("id", warnMetricId))
			return nil, nil
		}

		return warnMetricStatus, warnMetricDisplayTexts
	}
	return nil, nil
}

func (a *App) NotifyAndSetWarnMetricAck(warnMetricId string, sender *model.User, forceAck bool, isBot bool) *model.AppError {
	if warnMetric, ok := model.WarnMetricsTable[warnMetricId]; ok {
		data, nErr := a.Srv().Store().System().GetByName(warnMetric.Id)
		if nErr == nil && data != nil && data.Value == model.WarnMetricStatusAck {
			mlog.Debug("This metric warning has already been acknowledged", mlog.String("id", warnMetric.Id))
			return nil
		}

		if !forceAck {
			if *a.Config().EmailSettings.SMTPServer == "" {
				return model.NewAppError("NotifyAndSetWarnMetricAck", "api.email.send_warn_metric_ack.missing_server.app_error", nil, i18n.T("api.context.invalid_param.app_error", map[string]any{"Name": "SMTPServer"}), http.StatusInternalServerError)
			}
			T := i18n.GetUserTranslations(sender.Locale)
			data := a.Srv().EmailService.NewEmailTemplateData(sender.Locale)
			data.Props["ContactNameHeader"] = T("api.templates.warn_metric_ack.body.contact_name_header")
			data.Props["ContactNameValue"] = sender.GetFullName()
			data.Props["ContactEmailHeader"] = T("api.templates.warn_metric_ack.body.contact_email_header")
			data.Props["ContactEmailValue"] = sender.Email

			//same definition as the active users count metric displayed in the SystemConsole Analytics section
			registeredUsersCount, cerr := a.Srv().Store().User().Count(model.UserCountOptions{})
			if cerr != nil {
				mlog.Warn("Error retrieving the number of registered users", mlog.Err(cerr))
			} else {
				data.Props["RegisteredUsersHeader"] = T("api.templates.warn_metric_ack.body.registered_users_header")
				data.Props["RegisteredUsersValue"] = registeredUsersCount
			}
			data.Props["SiteURLHeader"] = T("api.templates.warn_metric_ack.body.site_url_header")
			data.Props["SiteURL"] = a.GetSiteURL()
			data.Props["TelemetryIdHeader"] = T("api.templates.warn_metric_ack.body.diagnostic_id_header")
			data.Props["TelemetryIdValue"] = a.TelemetryId()
			data.Props["Footer"] = T("api.templates.warn_metric_ack.footer")

			warnMetricStatus, warnMetricDisplayTexts := a.getWarnMetricStatusAndDisplayTextsForId(warnMetricId, T, false)
			if warnMetricStatus == nil {
				return model.NewAppError("NotifyAndSetWarnMetricAck", "api.email.send_warn_metric_ack.invalid_warn_metric.app_error", nil, "", http.StatusInternalServerError)
			}

			subject := T("api.templates.warn_metric_ack.subject")
			data.Props["Title"] = warnMetricDisplayTexts.EmailBody

			mailConfig := a.Srv().MailServiceConfig()

			body, err := a.Srv().TemplatesContainer().RenderToString("warn_metric_ack", data)
			if err != nil {
				return model.NewAppError("NotifyAndSetWarnMetricAck", "api.email.send_warn_metric_ack.failure.app_error", map[string]any{"Error": err.Error()}, "", http.StatusInternalServerError)
			}

			if err := mail.SendMailUsingConfig(model.MmSupportAdvisorAddress, subject, body, mailConfig, false, "", "", "", sender.Email, "NotifyAndSetWarnMetricAck"); err != nil {
				return model.NewAppError("NotifyAndSetWarnMetricAck", "api.email.send_warn_metric_ack.failure.app_error", map[string]any{"Error": err.Error()}, "", http.StatusInternalServerError)
			}
		}

		if err := a.setWarnMetricsStatusAndNotify(warnMetric.Id); err != nil {
			return err
		}
	}
	return nil
}

func (a *App) setWarnMetricsStatusAndNotify(warnMetricId string) *model.AppError {
	// Ack all metric warnings on the server
	if err := a.setWarnMetricsStatus(model.WarnMetricStatusAck); err != nil {
		return err
	}

	// Inform client that this metric warning has been acked
	message := model.NewWebSocketEvent(model.WebsocketWarnMetricStatusRemoved, "", "", "", nil, "")
	message.Add("warnMetricId", warnMetricId)
	a.Publish(message)

	return nil
}

func (a *App) setWarnMetricsStatus(status string) *model.AppError {
	mlog.Debug("Set monitoring status for all warn metrics", mlog.String("status", status))
	for _, warnMetric := range model.WarnMetricsTable {
		if err := a.setWarnMetricsStatusForId(warnMetric.Id, status); err != nil {
			return err
		}
	}
	return nil
}

func (a *App) setWarnMetricsStatusForId(warnMetricId string, status string) *model.AppError {
	mlog.Debug("Store status for warn metric", mlog.String("warnMetricId", warnMetricId), mlog.String("status", status))
	if err := a.Srv().Store().System().SaveOrUpdateWithWarnMetricHandling(&model.System{
		Name:  warnMetricId,
		Value: status,
	}); err != nil {
		return model.NewAppError("setWarnMetricsStatusForId", "app.system.warn_metric.store.app_error", map[string]any{"WarnMetricName": warnMetricId}, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (a *App) RequestLicenseAndAckWarnMetric(c *request.Context, warnMetricId string, isBot bool) *model.AppError {
	if *a.Config().ExperimentalSettings.RestrictSystemAdmin {
		return model.NewAppError("RequestLicenseAndAckWarnMetric", "api.restricted_system_admin", nil, "", http.StatusForbidden)
	}

	currentUser, appErr := a.GetUser(c.Session().UserId)
	if appErr != nil {
		return appErr
	}

	registeredUsersCount, err := a.Srv().Store().User().Count(model.UserCountOptions{})
	if err != nil {
		return model.NewAppError("RequestLicenseAndAckWarnMetric", "api.license.request_trial_license.fail_get_user_count.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if err := a.Channels().RequestTrialLicense(c.Session().UserId, int(registeredUsersCount), true, true); err != nil {
		// turn off warn metric warning even in case of StartTrial failure
		if nerr := a.setWarnMetricsStatusAndNotify(warnMetricId); nerr != nil {
			return nerr
		}

		return err
	}

	if appErr = a.NotifyAndSetWarnMetricAck(warnMetricId, currentUser, true, isBot); appErr != nil {
		return appErr
	}

	return nil
}
