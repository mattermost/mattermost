// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"fmt"
	"html/template"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/go-i18n/i18n"
	goi18n "github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/httpservice"
	"github.com/mattermost/mattermost-server/v5/services/imageproxy"
	"github.com/mattermost/mattermost-server/v5/services/mailservice"
	"github.com/mattermost/mattermost-server/v5/services/searchengine"
	"github.com/mattermost/mattermost-server/v5/services/timezones"
	"github.com/mattermost/mattermost-server/v5/utils"
)

type App struct {
	srv *Server

	log              *mlog.Logger
	notificationsLog *mlog.Logger

	t              goi18n.TranslateFunc
	session        model.Session
	requestId      string
	ipAddress      string
	path           string
	userAgent      string
	acceptLanguage string

	cluster       einterfaces.ClusterInterface
	compliance    einterfaces.ComplianceInterface
	dataRetention einterfaces.DataRetentionInterface
	searchEngine  *searchengine.Broker
	messageExport einterfaces.MessageExportInterface
	metrics       einterfaces.MetricsInterface

	httpService httpservice.HTTPService
	imageProxy  *imageproxy.ImageProxy
	timezones   *timezones.Timezones

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
			a.registerAllClusterMessageHandlers()
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
		if a.Srv().runjobs {
			a.Srv().Go(func() {
				runLicenseExpirationCheckJob(a)
				runCheckNumberOfActiveUsersWarnMetricStatusJob(a)
			})
		}
		a.srv.RunJobs()
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

	a.srv.Jobs.Workers = a.srv.Jobs.InitWorkers()
	a.srv.Jobs.Schedulers = a.srv.Jobs.InitSchedulers()
}

func (a *App) DiagnosticId() string {
	return a.Srv().diagnosticId
}

func (a *App) SetDiagnosticId(id string) {
	a.Srv().diagnosticId = id
}

func (s *Server) HTMLTemplates() *template.Template {
	if s.htmlTemplateWatcher != nil {
		return s.htmlTemplateWatcher.Templates()
	}

	return nil
}

func (a *App) Handle404(w http.ResponseWriter, r *http.Request) {
	ipAddress := utils.GetIpAddress(r, a.Config().ServiceSettings.TrustedProxyIPHeader)
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

func (a *App) GetWarnMetricsStatus() (map[string]*model.WarnMetricStatus, *model.AppError) {
	systemDataList, nErr := a.Srv().Store.System().Get()
	if nErr != nil {
		return nil, model.NewAppError("GetWarnMetricsStatus", "app.system.get.app_error", nil, nErr.Error(), http.StatusInternalServerError)
	}

	result := map[string]*model.WarnMetricStatus{}
	for key, value := range systemDataList {
		if strings.HasPrefix(key, model.WARN_METRIC_STATUS_STORE_PREFIX) {
			if warnMetric, ok := model.WarnMetricsTable[key]; ok {
				if !warnMetric.IsBotOnly && value == model.WARN_METRIC_STATUS_LIMIT_REACHED {
					result[key], _ = a.getWarnMetricStatusAndDisplayTextsForId(key, nil)
				}
			}
		}
	}

	return result, nil
}

func (a *App) getWarnMetricStatusAndDisplayTextsForId(warnMetricId string, T i18n.TranslateFunc) (*model.WarnMetricStatus, *model.WarnMetricDisplayTexts) {
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

		warnMetricDisplayTexts.BotMailToBody = T("api.server.warn_metric.bot_response.number_of_users.mailto_body", map[string]interface{}{"Limit": warnMetric.Limit})
		warnMetricDisplayTexts.EmailBody = T("api.templates.warn_metric_ack.number_of_active_users.body", map[string]interface{}{"Limit": warnMetric.Limit})

		switch warnMetricId {
		case model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_200:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.number_of_active_users_200.notification_title")
			warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_200.notification_body")
		case model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_400:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.number_of_active_users_400.notification_title")
			warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_400.notification_body")
		case model.SYSTEM_WARN_METRIC_NUMBER_OF_ACTIVE_USERS_500:
			warnMetricDisplayTexts.BotTitle = T("api.server.warn_metric.number_of_active_users_500.notification_title")
			warnMetricDisplayTexts.BotMessageBody = T("api.server.warn_metric.number_of_active_users_500.notification_body")
		default:
			mlog.Error("Invalid metric id", mlog.String("id", warnMetricId))
			return nil, nil
		}

		return warnMetricStatus, warnMetricDisplayTexts
	}
	return nil, nil
}

func (a *App) notifyAdminsOfWarnMetricStatus(warnMetricId string) *model.AppError {
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

	T := utils.GetUserTranslations(sysAdmins[0].Locale)
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
		T := utils.GetUserTranslations(sysAdmin.Locale)
		bot.DisplayName = T("app.system.warn_metric.bot_displayname")
		bot.Description = T("app.system.warn_metric.bot_description")

		channel, appErr := a.GetOrCreateDirectChannel(bot.UserId, sysAdmin.Id)
		if appErr != nil {
			mlog.Error("Cannot create channel for system bot notification!", mlog.String("Admin Id", sysAdmin.Id))
			return appErr
		}

		warnMetricStatus, warnMetricDisplayTexts := a.getWarnMetricStatusAndDisplayTextsForId(warnMetricId, T)
		if warnMetricStatus == nil {
			return model.NewAppError("NotifyAdminsOfWarnMetricStatus", "app.system.warn_metric.notification.invalid_metric.app_error", nil, "", http.StatusInternalServerError)
		}

		botPost := &model.Post{
			UserId:    bot.UserId,
			ChannelId: channel.Id,
			Type:      model.POST_SYSTEM_WARN_METRIC_STATUS,
			Message:   "",
		}

		actions := []*model.PostAction{}
		actions = append(actions,
			&model.PostAction{
				Id:   "contactUs",
				Name: T("api.server.warn_metric.contact_us"),
				Type: model.POST_ACTION_TYPE_BUTTON,
				Options: []*model.PostActionOptions{
					{
						Text:  "TrackEventId",
						Value: warnMetricId,
					},
					{
						Text:  "ActionExecutingMessage",
						Value: T("api.server.warn_metric.contacting_us"),
					},
				},
				Integration: &model.PostActionIntegration{
					Context: model.StringInterface{
						"bot_user_id": bot.UserId,
						"force_ack":   false,
					},
					URL: fmt.Sprintf("/warn_metrics/ack/%s", warnMetricId),
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

		mlog.Debug("Send admin advisory for metric", mlog.String("warnMetricId", warnMetricId), mlog.String("userid", botPost.UserId))
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
			mlog.Debug("This metric warning has already been acknowledged")
			return nil
		}

		if !forceAck {
			if len(*a.Config().EmailSettings.SMTPServer) == 0 {
				return model.NewAppError("NotifyAndSetWarnMetricAck", "api.email.send_warn_metric_ack.missing_server.app_error", nil, utils.T("api.context.invalid_param.app_error", map[string]interface{}{"Name": "SMTPServer"}), http.StatusInternalServerError)
			}
			T := utils.GetUserTranslations(sender.Locale)
			bodyPage := a.Srv().EmailService.newEmailTemplate("warn_metric_ack", sender.Locale)
			bodyPage.Props["ContactNameHeader"] = T("api.templates.warn_metric_ack.body.contact_name_header")
			bodyPage.Props["ContactNameValue"] = sender.GetFullName()
			bodyPage.Props["ContactEmailHeader"] = T("api.templates.warn_metric_ack.body.contact_email_header")
			bodyPage.Props["ContactEmailValue"] = sender.Email

			//same definition as the active users count metric displayed in the SystemConsole Analytics section
			registeredUsersCount, cerr := a.Srv().Store.User().Count(model.UserCountOptions{})
			if cerr != nil {
				mlog.Error("Error retrieving the number of registered users", mlog.Err(cerr))
			} else {
				bodyPage.Props["RegisteredUsersHeader"] = T("api.templates.warn_metric_ack.body.registered_users_header")
				bodyPage.Props["RegisteredUsersValue"] = registeredUsersCount
			}
			bodyPage.Props["SiteURLHeader"] = T("api.templates.warn_metric_ack.body.site_url_header")
			bodyPage.Props["SiteURL"] = a.GetSiteURL()
			bodyPage.Props["DiagnosticIdHeader"] = T("api.templates.warn_metric_ack.body.diagnostic_id_header")
			bodyPage.Props["DiagnosticIdValue"] = a.DiagnosticId()
			bodyPage.Props["Footer"] = T("api.templates.warn_metric_ack.footer")

			warnMetricStatus, warnMetricDisplayTexts := a.getWarnMetricStatusAndDisplayTextsForId(warnMetricId, T)
			if warnMetricStatus == nil {
				return model.NewAppError("NotifyAndSetWarnMetricAck", "api.email.send_warn_metric_ack.invalid_warn_metric.app_error", nil, "", http.StatusInternalServerError)
			}

			subject := T("api.templates.warn_metric_ack.subject")
			bodyPage.Props["Title"] = warnMetricDisplayTexts.EmailBody

			if err := mailservice.SendMailUsingConfig(model.MM_SUPPORT_ADDRESS, subject, bodyPage.Render(), a.Config(), false, sender.Email); err != nil {
				mlog.Error("Error while sending email", mlog.String("destination email", model.MM_SUPPORT_ADDRESS), mlog.Err(err))
				return model.NewAppError("NotifyAndSetWarnMetricAck", "api.email.send_warn_metric_ack.failure.app_error", map[string]interface{}{"Error": err.Error()}, "", http.StatusInternalServerError)
			}
		}

		mlog.Debug("Disable the monitoring of all warn metrics")
		err := a.setWarnMetricsStatus(model.WARN_METRIC_STATUS_ACK)
		if err != nil {
			return err
		}

		if !warnMetric.IsBotOnly && !isBot {
			message := model.NewWebSocketEvent(model.WEBSOCKET_WARN_METRIC_STATUS_REMOVED, "", "", "", nil)
			message.Add("warnMetricId", warnMetric.Id)
			a.Publish(message)
		}
	}
	return nil
}

func (a *App) setWarnMetricsStatus(status string) *model.AppError {
	for _, warnMetric := range model.WarnMetricsTable {
		a.setWarnMetricsStatusForId(warnMetric.Id, status)
	}
	return nil
}

func (a *App) setWarnMetricsStatusForId(warnMetricId string, status string) *model.AppError {
	mlog.Info("Storing user acknowledgement for warn metric", mlog.String("warnMetricId", warnMetricId))
	if err := a.Srv().Store.System().SaveOrUpdate(&model.System{
		Name:  warnMetricId,
		Value: status,
	}); err != nil {
		mlog.Error("Unable to write to database.", mlog.Err(err))
		return model.NewAppError("setWarnMetricsStatusForId", "app.system.warn_metric.store.app_error", map[string]interface{}{"WarnMetricName": warnMetricId}, "", http.StatusInternalServerError)
	}
	return nil
}

func (a *App) Srv() *Server {
	return a.srv
}
func (a *App) Log() *mlog.Logger {
	return a.log
}
func (a *App) NotificationsLog() *mlog.Logger {
	return a.notificationsLog
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
	return a.cluster
}
func (a *App) Compliance() einterfaces.ComplianceInterface {
	return a.compliance
}
func (a *App) DataRetention() einterfaces.DataRetentionInterface {
	return a.dataRetention
}
func (a *App) SearchEngine() *searchengine.Broker {
	return a.searchEngine
}
func (a *App) Ldap() einterfaces.LdapInterface {
	return a.srv.Ldap
}
func (a *App) MessageExport() einterfaces.MessageExportInterface {
	return a.messageExport
}
func (a *App) Metrics() einterfaces.MetricsInterface {
	return a.metrics
}
func (a *App) Notification() einterfaces.NotificationInterface {
	return a.srv.Notification
}
func (a *App) Saml() einterfaces.SamlInterface {
	return a.srv.Saml
}
func (a *App) HTTPService() httpservice.HTTPService {
	return a.httpService
}
func (a *App) ImageProxy() *imageproxy.ImageProxy {
	return a.imageProxy
}
func (a *App) Timezones() *timezones.Timezones {
	return a.timezones
}
func (a *App) Context() context.Context {
	return a.context
}

func (a *App) SetSession(s *model.Session) {
	a.session = *s
}

func (a *App) SetT(t goi18n.TranslateFunc) {
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
func (a *App) GetT() goi18n.TranslateFunc {
	return a.t
}
func (a *App) SetLog(l *mlog.Logger) {
	a.log = l
}
