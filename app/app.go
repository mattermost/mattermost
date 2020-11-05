// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"fmt"
	"html/template"
	"net/http"
	"strconv"
	"time"

	goi18n "github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/httpservice"
	"github.com/mattermost/mattermost-server/v5/services/imageproxy"
	"github.com/mattermost/mattermost-server/v5/services/searchengine"
	"github.com/mattermost/mattermost-server/v5/services/timezones"
	"github.com/mattermost/mattermost-server/v5/utils"
)

type App struct {
	srv *Server

	// XXX: This is required because removing this needs BleveEngine
	// to be registered in (h *MainHelper) setupStore, but that creates
	// a cyclic dependency as bleve tests themselves import testlib.
	searchEngine *searchengine.Broker

	t              goi18n.TranslateFunc
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
	if productNoticesJobInterface != nil {
		a.srv.Jobs.ProductNotices = productNoticesJobInterface(a)
	}

	if jobsActiveUsersInterface != nil {
		a.srv.Jobs.ActiveUsers = jobsActiveUsersInterface(a)
	}
	a.srv.Jobs.Workers = a.srv.Jobs.InitWorkers()
	a.srv.Jobs.Schedulers = a.srv.Jobs.InitSchedulers()
}

func (a *App) TelemetryId() string {
	return a.Srv().TelemetryId()
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
