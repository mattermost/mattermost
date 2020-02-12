// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"html/template"
	"net/http"
	"strconv"

	goi18n "github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/einterfaces"
	"github.com/mattermost/mattermost-server/v5/jobs"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/httpservice"
	"github.com/mattermost/mattermost-server/v5/services/imageproxy"
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

	accountMigration einterfaces.AccountMigrationInterface
	cluster          einterfaces.ClusterInterface
	compliance       einterfaces.ComplianceInterface
	dataRetention    einterfaces.DataRetentionInterface
	elasticsearch    einterfaces.ElasticsearchInterface
	ldap             einterfaces.LdapInterface
	messageExport    einterfaces.MessageExportInterface
	metrics          einterfaces.MetricsInterface
	notification     einterfaces.NotificationInterface
	saml             einterfaces.SamlInterface

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

// DO NOT CALL THIS.
// This is to avoid having to change all the code in cmd/mattermost/commands/* for now
// shutdown should be called directly on the server
func (a *App) Shutdown() {
	a.Srv().Shutdown()
	a.srv = nil
}

func (a *App) configOrLicenseListener() {
	a.regenerateClientConfig()
}

func (s *Server) initJobs() {
	s.Jobs = jobs.NewJobServer(s, s.Store)
	if jobsDataRetentionJobInterface != nil {
		s.Jobs.DataRetentionJob = jobsDataRetentionJobInterface(s.FakeApp())
	}
	if jobsMessageExportJobInterface != nil {
		s.Jobs.MessageExportJob = jobsMessageExportJobInterface(s.FakeApp())
	}
	if jobsElasticsearchAggregatorInterface != nil {
		s.Jobs.ElasticsearchAggregator = jobsElasticsearchAggregatorInterface(s.FakeApp())
	}
	if jobsElasticsearchIndexerInterface != nil {
		s.Jobs.ElasticsearchIndexer = jobsElasticsearchIndexerInterface(s.FakeApp())
	}
	if jobsLdapSyncInterface != nil {
		s.Jobs.LdapSync = jobsLdapSyncInterface(s.FakeApp())
	}
	if jobsMigrationsInterface != nil {
		s.Jobs.Migrations = jobsMigrationsInterface(s.FakeApp())
	}
	if jobsPluginsInterface != nil {
		s.Jobs.Plugins = jobsPluginsInterface(s.FakeApp())
	}
	s.Jobs.Workers = s.Jobs.InitWorkers()
	s.Jobs.Schedulers = s.Jobs.InitSchedulers()
}

func (a *App) DiagnosticId() string {
	return a.Srv().diagnosticId
}

func (a *App) SetDiagnosticId(id string) {
	a.Srv().diagnosticId = id
}

func (a *App) EnsureDiagnosticId() {
	if a.Srv().diagnosticId != "" {
		return
	}
	props, err := a.Srv().Store.System().Get()
	if err != nil {
		return
	}

	id := props[model.SYSTEM_DIAGNOSTIC_ID]
	if len(id) == 0 {
		id = model.NewId()
		systemId := &model.System{Name: model.SYSTEM_DIAGNOSTIC_ID, Value: id}
		a.Srv().Store.System().Save(systemId)
	}

	a.Srv().diagnosticId = id
}

func (a *App) HTMLTemplates() *template.Template {
	if a.Srv().htmlTemplateWatcher != nil {
		return a.Srv().htmlTemplateWatcher.Templates()
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

func (a *App) getSystemInstallDate() (int64, *model.AppError) {
	systemData, appErr := a.Srv().Store.System().GetByName(model.SYSTEM_INSTALLATION_DATE_KEY)
	if appErr != nil {
		return 0, appErr
	}
	value, err := strconv.ParseInt(systemData.Value, 10, 64)
	if err != nil {
		return 0, model.NewAppError("getSystemInstallDate", "app.system_install_date.parse_int.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return value, nil
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
	return a.accountMigration
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
func (a *App) Elasticsearch() einterfaces.ElasticsearchInterface {
	return a.elasticsearch
}
func (a *App) Ldap() einterfaces.LdapInterface {
	return a.ldap
}
func (a *App) MessageExport() einterfaces.MessageExportInterface {
	return a.messageExport
}
func (a *App) Metrics() einterfaces.MetricsInterface {
	return a.metrics
}
func (a *App) Notification() einterfaces.NotificationInterface {
	return a.notification
}
func (a *App) Saml() einterfaces.SamlInterface {
	return a.saml
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
