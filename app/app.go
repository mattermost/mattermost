// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/httpservice"
	"github.com/mattermost/mattermost-server/v5/services/imageproxy"
	"github.com/mattermost/mattermost-server/v5/services/searchengine"
	"github.com/mattermost/mattermost-server/v5/services/timezones"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
	"github.com/mattermost/mattermost-server/v5/shared/mail"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
	"github.com/mattermost/mattermost-server/v5/shared/templates"
	"github.com/mattermost/mattermost-server/v5/utils"
)

type App struct {
	srv *Server

	// XXX: This is required because removing this needs BleveEngine
	// to be registered in (h *MainHelper) setupStore, but that creates
	// a cyclic dependency as bleve tests themselves import testlib.
	searchEngine *searchengine.Broker

	t              i18n.TranslateFunc
	session        model.Session
	requestId      string
	ipAddress      string
	path           string
	userAgent      string
	acceptLanguage string

	context context.Context
}

func New(options ...AppOption) *App {
	app := &App{}

	for _, option := range options {
		option(app)
	}

	return app
}

func (a *App) InitServer() {
	a.srv.AppInitializedOnce.Do(func() {
		a.initEnterprise()

		a.AddConfigListener(func(oldConfig *model.Config, newConfig *model.Config) {
			if *oldConfig.GuestAccountsSettings.Enable && !*newConfig.GuestAccountsSettings.Enable {
				if appErr := a.DeactivateGuests(); appErr != nil {
					mlog.Error("Unable to deactivate guest accounts", mlog.Err(appErr))
				}
			}
		})

		// Disable active guest accounts on first run if guest accounts are disabled
		if !*a.Config().GuestAccountsSettings.Enable {
			if appErr := a.DeactivateGuests(); appErr != nil {
				mlog.Error("Unable to deactivate guest accounts", mlog.Err(appErr))
			}
		}

		// Scheduler must be started before cluster.
		a.initJobs()

		if a.srv.joinCluster && a.srv.Cluster != nil {
			a.registerAppClusterMessageHandlers()
		}

		a.DoAppMigrations()

		a.InitPostMetadata()

		a.InitPlugins(*a.Config().PluginSettings.Directory, *a.Config().PluginSettings.ClientDirectory)
		a.AddConfigListener(func(prevCfg, cfg *model.Config) {
			if *cfg.PluginSettings.Enable {
				a.InitPlugins(*cfg.PluginSettings.Directory, *a.Config().PluginSettings.ClientDirectory)
			} else {
				a.srv.ShutDownPlugins()
			}
		})
		if a.Srv().runEssentialJobs {
			a.Srv().Go(func() {
				runLicenseExpirationCheckJob(a)
				runCheckWarnMetricStatusJob(a)
			})
			a.srv.runJobs()
		}
	})
}

func (a *App) initJobs() {
	if jobsLdapSyncInterface != nil {
		a.srv.Jobs.LdapSync = jobsLdapSyncInterface(a)
	}
	if jobsPluginsInterface != nil {
		a.srv.Jobs.Plugins = jobsPluginsInterface(a)
	}
	if jobsExpiryNotifyInterface != nil {
		a.srv.Jobs.ExpiryNotify = jobsExpiryNotifyInterface(a)
	}
	if productNoticesJobInterface != nil {
		a.srv.Jobs.ProductNotices = productNoticesJobInterface(a)
	}
	if jobsImportProcessInterface != nil {
		a.srv.Jobs.ImportProcess = jobsImportProcessInterface(a)
	}
	if jobsImportDeleteInterface != nil {
		a.srv.Jobs.ImportDelete = jobsImportDeleteInterface(a)
	}
	if jobsExportDeleteInterface != nil {
		a.srv.Jobs.ExportDelete = jobsExportDeleteInterface(a)
	}

	if jobsExportProcessInterface != nil {
		a.srv.Jobs.ExportProcess = jobsExportProcessInterface(a)
	}

	if jobsExportProcessInterface != nil {
		a.srv.Jobs.ExportProcess = jobsExportProcessInterface(a)
	}

	if jobsActiveUsersInterface != nil {
		a.srv.Jobs.ActiveUsers = jobsActiveUsersInterface(a)
	}

	if jobsCloudInterface != nil {
		a.srv.Jobs.Cloud = jobsCloudInterface(a.srv)
	}

	if jobsResendInvitationEmailInterface != nil {
		a.srv.Jobs.ResendInvitationEmails = jobsResendInvitationEmailInterface(a)
	}

	a.srv.Jobs.InitWorkers()
	a.srv.Jobs.InitSchedulers()
}

func (a *App) TelemetryId() string {
	return a.Srv().TelemetryId()
}

func (s *Server) TemplatesContainer() *templates.Container {
	return s.htmlTemplateWatcher
}

func (a *App) Handle404(w http.ResponseWriter, r *http.Request) {
	ipAddress := utils.GetIPAddress(r, a.Config().ServiceSettings.TrustedProxyIPHeader)
	mlog.Debug("not found handler triggered", mlog.String("path", r.URL.Path), mlog.Int("code", 404), mlog.String("ip", ipAddress))

	if *a.Config().ServiceSettings.WebserverMode == "disabled" {
		http.NotFound(w, r)
		return
	}

	utils.RenderWebAppError(a.Config(), w, r, model.NewAppError("Handle404", "api.context.404.app_error", nil, "", http.StatusNotFound), a.AsymmetricSigningKey())
}

func (s *Server) getSystemInstallDate() (int64, *model.AppError) {
	systemData, err := s.Store.System().GetByName(model.SYSTEM_INSTALLATION_DATE_KEY)
	if err != nil {
		return 0, model.NewAppError("getSystemInstallDate", "app.system.get_by_name.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	value, err := strconv.ParseInt(systemData.Value, 10, 64)
	if err != nil {
		return 0, model.NewAppError("getSystemInstallDate", "app.system_install_date.parse_int.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return value, nil
}

func (s *Server) getFirstServerRunTimestamp() (int64, *model.AppError) {
	systemData, err := s.Store.System().GetByName(model.SYSTEM_FIRST_SERVER_RUN_TIMESTAMP_KEY)
	if err != nil {
		return 0, model.NewAppError("getFirstServerRunTimestamp", "app.system.get_by_name.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	value, err := strconv.ParseInt(systemData.Value, 10, 64)
	if err != nil {
		return 0, model.NewAppError("getFirstServerRunTimestamp", "app.system_install_date.parse_int.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return value, nil
}

func (s *Server) getLastWarnMetricTimestamp() (int64, *model.AppError) {
	systemData, err := s.Store.System().GetByName(model.SYSTEM_WARN_METRIC_LAST_RUN_TIMESTAMP_KEY)
	if err != nil {
		return 0, model.NewAppError("getLastWarnMetricTimestamp", "app.system.get_by_name.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	value, err := strconv.ParseInt(systemData.Value, 10, 64)
	if err != nil {
		return 0, model.NewAppError("getLastWarnMetricTimestamp", "app.system_install_date.parse_int.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return value, nil
}

func (a *App) GetWarnMetricsStatus() (map[string]*model.WarnMetricStatus, *model.AppError) {
	systemDataList, nErr := a.Srv().Store.System().Get()
	if nErr != nil {
		return nil, model.NewAppError("GetWarnMetricsStatus", "app.system.get.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	isE0Edition := model.BuildEnterpriseReady == "true" // license == nil was already validated upstream

	result := map[string]*model.WarnMetricStatus{}
	for key, value := range systemDataList {
		if strings.HasPrefix(key, model.WARN_METRIC_STATUS_STORE_PREFIX) {
			if warnMetric, ok := model.WarnMetricsTable[key]; ok {
				if !warnMetric.IsBotOnly && (value == model.WARN_METRIC_STATUS_RUNONCE || value == model.WARN_METRIC_STATUS_LIMIT_REACHED) {
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
		case model.SYSTEM_WARN_METRIC_NUMBER_OF_TEAMS_5:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.number_of_teams_5.notification_title")
			if isE0Edition {
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_teams_5.start_trial.notification_body")
				warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.number_of_teams_5.start_trial_notification_success.message")
			} else {
				warnMetricDisplayTexts.EmailBody = T("api.server.warn_metric.number_of_teams_5.contact_us.email_body")
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_teams_5.notification_body")
			}
		case model.SYSTEM_WARN_METRIC_MFA:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.mfa.notification_title")
			if isE0Edition {
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.mfa.start_trial.notification_body")
				warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.mfa.start_trial_notification_success.message")
			} else {
				warnMetricDisplayTexts.EmailBody = T("api.server.warn_metric.mfa.contact_us.email_body")
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.mfa.notification_body")
			}
		case model.SYSTEM_WARN_METRIC_EMAIL_DOMAIN:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.email_domain.notification_title")
			if isE0Edition {
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.email_domain.start_trial.notification_body")
				warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.email_domain.start_trial_notification_success.message")
			} else {
				warnMetricDisplayTexts.EmailBody = T("api.server.warn_metric.email_domain.contact_us.email_body")
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.email_domain.notification_body")
			}
		case model.SYSTEM_WARN_METRIC_NUMBER_OF_CHANNELS_50:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.number_of_channels_50.notification_title")
			if isE0Edition {
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_channels_50.start_trial.notification_body")
				warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.number_of_channels_50.start_trial.notification_success.message")
			} else {
				warnMetricDisplayTexts.EmailBody = T("api.server.warn_metric.number_of_channels_50.contact_us.email_body")
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_channels_50.notification_body")
			}
		case model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_100:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.number_of_active_users_100.notification_title")
			if isE0Edition {
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_100.start_trial.notification_body")
				warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.number_of_active_users_100.start_trial.notification_success.message")
			} else {
				warnMetricDisplayTexts.EmailBody = T("api.server.warn_metric.number_of_active_users_100.contact_us.email_body")
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_100.notification_body")
			}
		case model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_200:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.number_of_active_users_200.notification_title")
			if isE0Edition {
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_200.start_trial.notification_body")
				warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.number_of_active_users_200.start_trial.notification_success.message")
			} else {
				warnMetricDisplayTexts.EmailBody = T("api.server.warn_metric.number_of_active_users_200.contact_us.email_body")
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_200.notification_body")
			}
		case model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_300:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.number_of_active_users_300.start_trial.notification_title")
			if isE0Edition {
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_300.start_trial.notification_body")
				warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.number_of_active_users_300.start_trial.notification_success.message")
			} else {
				warnMetricDisplayTexts.EmailBody = T("api.server.warn_metric.number_of_active_users_300.contact_us.email_body")
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_300.notification_body")
			}
		case model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_500:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.number_of_active_users_500.notification_title")
			if isE0Edition {
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_500.start_trial.notification_body")
				warnMetricDisplayTexts.BotSuccessMessage = T("api.server.warn_metric.number_of_active_users_500.start_trial.notification_success.message")
			} else {
				warnMetricDisplayTexts.EmailBody = T("api.server.warn_metric.number_of_active_users_500.contact_us.email_body")
				warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_500.notification_body")
			}
		case model.SYSTEM_WARN_METRIC_NUMBER_OF_POSTS_2M:
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

func (a *App) notifyAdminsOfWarnMetricStatus(warnMetricId string, isE0Edition bool) *model.AppError {
	perPage := 25
	userOptions := &model.UserGetOptions{
		Page:     0,
		PerPage:  perPage,
		Role:     model.SYSTEM_ADMIN_ROLE_ID,
		Inactive: false,
	}

	// get sysadmins
	var sysAdmins []*model.User
	for {
		sysAdminsList, err := a.GetUsers(userOptions)
		if err != nil {
			return err
		}

		if len(sysAdminsList) == 0 {
			return model.NewAppError("NotifyAdminsOfWarnMetricStatus", "app.system.warn_metric.notification.empty_admin_list.app_error", nil, "", http.StatusInternalServerError)
		}
		sysAdmins = append(sysAdmins, sysAdminsList...)

		if len(sysAdminsList) < perPage {
			mlog.Debug("Number of system admins is less than page limit", mlog.Int("count", len(sysAdminsList)))
			break
		}
	}

	T := i18n.GetUserTranslations(sysAdmins[0].Locale)
	warnMetricsBot := &model.Bot{
		Username:    model.BOT_WARN_METRIC_BOT_USERNAME,
		DisplayName: T("app.system.warn_metric.bot_displayname"),
		Description: "",
		OwnerId:     sysAdmins[0].Id,
	}

	bot, err := a.getOrCreateWarnMetricsBot(warnMetricsBot)
	if err != nil {
		return err
	}

	for _, sysAdmin := range sysAdmins {
		T := i18n.GetUserTranslations(sysAdmin.Locale)
		bot.DisplayName = T("app.system.warn_metric.bot_displayname")
		bot.Description = T("app.system.warn_metric.bot_description")

		channel, appErr := a.GetOrCreateDirectChannel(bot.UserId, sysAdmin.Id)
		if appErr != nil {
			return appErr
		}

		warnMetricStatus, warnMetricDisplayTexts := a.getWarnMetricStatusAndDisplayTextsForId(warnMetricId, T, isE0Edition)
		if warnMetricStatus == nil {
			return model.NewAppError("NotifyAdminsOfWarnMetricStatus", "app.system.warn_metric.notification.invalid_metric.app_error", nil, "", http.StatusInternalServerError)
		}

		botPost := &model.Post{
			UserId:    bot.UserId,
			ChannelId: channel.Id,
			Type:      model.POST_SYSTEM_WARN_METRIC_STATUS,
			Message:   "",
		}

		actionId := "contactUs"
		actionName := T("api.server.warn_metric.contact_us")
		postActionValue := T("api.server.warn_metric.contacting_us")
		postActionUrl := fmt.Sprintf("/warn_metrics/ack/%s", warnMetricId)

		if isE0Edition {
			actionId = "startTrial"
			actionName = T("api.server.warn_metric.start_trial")
			postActionValue = T("api.server.warn_metric.starting_trial")
			postActionUrl = fmt.Sprintf("/warn_metrics/trial-license-ack/%s", warnMetricId)
		}

		actions := []*model.PostAction{}
		actions = append(actions,
			&model.PostAction{
				Id:   actionId,
				Name: actionName,
				Type: model.POST_ACTION_TYPE_BUTTON,
				Options: []*model.PostActionOptions{
					{
						Text:  "TrackEventId",
						Value: warnMetricId,
					},
					{
						Text:  "ActionExecutingMessage",
						Value: postActionValue,
					},
				},
				Integration: &model.PostActionIntegration{
					Context: model.StringInterface{
						"bot_user_id": bot.UserId,
						"force_ack":   false,
					},
					URL: postActionUrl,
				},
			},
		)

		attachments := []*model.SlackAttachment{{
			AuthorName: "",
			Title:      warnMetricDisplayTexts.BotTitle,
			Text:       warnMetricDisplayTexts.BotMessageBody,
			Actions:    actions,
		}}
		model.ParseSlackAttachment(botPost, attachments)

		mlog.Debug("Post admin advisory for metric", mlog.String("warnMetricId", warnMetricId), mlog.String("userid", botPost.UserId))
		if _, err := a.CreatePostAsUser(botPost, a.Session().Id, true); err != nil {
			return err
		}
	}

	return nil
}

func (a *App) NotifyAndSetWarnMetricAck(warnMetricId string, sender *model.User, forceAck bool, isBot bool) *model.AppError {
	if warnMetric, ok := model.WarnMetricsTable[warnMetricId]; ok {
		data, nErr := a.Srv().Store.System().GetByName(warnMetric.Id)
		if nErr == nil && data != nil && data.Value == model.WARN_METRIC_STATUS_ACK {
			mlog.Debug("This metric warning has already been acknowledged", mlog.String("id", warnMetric.Id))
			return nil
		}

		if !forceAck {
			if *a.Config().EmailSettings.SMTPServer == "" {
				return model.NewAppError("NotifyAndSetWarnMetricAck", "api.email.send_warn_metric_ack.missing_server.app_error", nil, i18n.T("api.context.invalid_param.app_error", map[string]interface{}{"Name": "SMTPServer"}), http.StatusInternalServerError)
			}
			T := i18n.GetUserTranslations(sender.Locale)
			data := a.Srv().EmailService.newEmailTemplateData(sender.Locale)
			data.Props["ContactNameHeader"] = T("api.templates.warn_metric_ack.body.contact_name_header")
			data.Props["ContactNameValue"] = sender.GetFullName()
			data.Props["ContactEmailHeader"] = T("api.templates.warn_metric_ack.body.contact_email_header")
			data.Props["ContactEmailValue"] = sender.Email

			//same definition as the active users count metric displayed in the SystemConsole Analytics section
			registeredUsersCount, cerr := a.Srv().Store.User().Count(model.UserCountOptions{})
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
				return model.NewAppError("NotifyAndSetWarnMetricAck", "api.email.send_warn_metric_ack.failure.app_error", map[string]interface{}{"Error": err.Error()}, "", http.StatusInternalServerError)
			}

			if err := mail.SendMailUsingConfig(model.MM_SUPPORT_ADVISOR_ADDRESS, subject, body, mailConfig, false, sender.Email); err != nil {
				return model.NewAppError("NotifyAndSetWarnMetricAck", "api.email.send_warn_metric_ack.failure.app_error", map[string]interface{}{"Error": err.Error()}, "", http.StatusInternalServerError)
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
	if err := a.setWarnMetricsStatus(model.WARN_METRIC_STATUS_ACK); err != nil {
		return err
	}

	// Inform client that this metric warning has been acked
	message := model.NewWebSocketEvent(model.WEBSOCKET_WARN_METRIC_STATUS_REMOVED, "", "", "", nil)
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
	if err := a.Srv().Store.System().SaveOrUpdateWithWarnMetricHandling(&model.System{
		Name:  warnMetricId,
		Value: status,
	}); err != nil {
		return model.NewAppError("setWarnMetricsStatusForId", "app.system.warn_metric.store.app_error", map[string]interface{}{"WarnMetricName": warnMetricId}, err.Error(), http.StatusInternalServerError)
	}
	return nil
}

func (a *App) RequestLicenseAndAckWarnMetric(warnMetricId string, isBot bool) *model.AppError {
	if *a.Config().ExperimentalSettings.RestrictSystemAdmin {
		return model.NewAppError("RequestLicenseAndAckWarnMetric", "api.restricted_system_admin", nil, "", http.StatusForbidden)
	}

	currentUser, appErr := a.GetUser(a.Session().UserId)
	if appErr != nil {
		return appErr
	}

	registeredUsersCount, err := a.Srv().Store.User().Count(model.UserCountOptions{})
	if err != nil {
		return model.NewAppError("RequestLicenseAndAckWarnMetric", "api.license.request_trial_license.fail_get_user_count.app_error", nil, err.Error(), http.StatusBadRequest)
	}

	trialLicenseRequest := &model.TrialLicenseRequest{
		ServerID:              a.TelemetryId(),
		Name:                  currentUser.GetDisplayName(model.SHOW_FULLNAME),
		Email:                 currentUser.Email,
		SiteName:              *a.Config().TeamSettings.SiteName,
		SiteURL:               *a.Config().ServiceSettings.SiteURL,
		Users:                 int(registeredUsersCount),
		TermsAccepted:         true,
		ReceiveEmailsAccepted: true,
	}

	if trialLicenseRequest.SiteURL == "" {
		return model.NewAppError("RequestLicenseAndAckWarnMetric", "api.license.request_trial_license.no-site-url.app_error", nil, "", http.StatusBadRequest)
	}

	if err := a.Srv().RequestTrialLicense(trialLicenseRequest); err != nil {
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

func (a *App) Srv() *Server {
	return a.srv
}
func (a *App) Log() *mlog.Logger {
	return a.srv.Log
}
func (a *App) NotificationsLog() *mlog.Logger {
	return a.srv.NotificationsLog
}
func (a *App) T(translationID string, args ...interface{}) string {
	return a.t(translationID, args...)
}
func (a *App) Session() *model.Session {
	return &a.session
}
func (a *App) RequestId() string {
	return a.requestId
}
func (a *App) IpAddress() string {
	return a.ipAddress
}
func (a *App) Path() string {
	return a.path
}
func (a *App) UserAgent() string {
	return a.userAgent
}
func (a *App) AcceptLanguage() string {
	return a.acceptLanguage
}
func (a *App) AccountMigration() einterfaces.AccountMigrationInterface {
	return a.srv.AccountMigration
}
func (a *App) Cluster() einterfaces.ClusterInterface {
	return a.srv.Cluster
}
func (a *App) Compliance() einterfaces.ComplianceInterface {
	return a.srv.Compliance
}
func (a *App) DataRetention() einterfaces.DataRetentionInterface {
	return a.srv.DataRetention
}
func (a *App) SearchEngine() *searchengine.Broker {
	return a.searchEngine
}
func (a *App) Ldap() einterfaces.LdapInterface {
	return a.srv.Ldap
}
func (a *App) MessageExport() einterfaces.MessageExportInterface {
	return a.srv.MessageExport
}
func (a *App) Metrics() einterfaces.MetricsInterface {
	return a.srv.Metrics
}
func (a *App) Notification() einterfaces.NotificationInterface {
	return a.srv.Notification
}
func (a *App) Saml() einterfaces.SamlInterface {
	return a.srv.Saml
}
func (a *App) Cloud() einterfaces.CloudInterface {
	return a.srv.Cloud
}
func (a *App) HTTPService() httpservice.HTTPService {
	return a.srv.HTTPService
}
func (a *App) ImageProxy() *imageproxy.ImageProxy {
	return a.srv.ImageProxy
}
func (a *App) Timezones() *timezones.Timezones {
	return a.srv.timezones
}
func (a *App) Context() context.Context {
	return a.context
}

func (a *App) SetSession(s *model.Session) {
	a.session = *s
}

func (a *App) SetT(t i18n.TranslateFunc) {
	a.t = t
}
func (a *App) SetRequestId(s string) {
	a.requestId = s
}
func (a *App) SetIpAddress(s string) {
	a.ipAddress = s
}
func (a *App) SetUserAgent(s string) {
	a.userAgent = s
}
func (a *App) SetAcceptLanguage(s string) {
	a.acceptLanguage = s
}
func (a *App) SetPath(s string) {
	a.path = s
}
func (a *App) SetContext(c context.Context) {
	a.context = c
}
func (a *App) SetServer(srv *Server) {
	a.srv = srv
}
func (a *App) GetT() i18n.TranslateFunc {
	return a.t
}

func (a *App) DBHealthCheckWrite() error {
	currentTime := strconv.FormatInt(time.Now().Unix(), 10)

	return a.Srv().Store.System().SaveOrUpdate(&model.System{
		Name:  a.dbHealthCheckKey(),
		Value: currentTime,
	})
}

func (a *App) DBHealthCheckDelete() error {
	_, err := a.Srv().Store.System().PermanentDeleteByName(a.dbHealthCheckKey())
	return err
}

func (a *App) dbHealthCheckKey() string {
	return fmt.Sprintf("health_check_%s", a.GetClusterId())
}
