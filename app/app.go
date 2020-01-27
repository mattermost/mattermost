// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
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
	Srv *Server

	Log              *mlog.Logger
	NotificationsLog *mlog.Logger

	T              goi18n.TranslateFunc
	Session        model.Session
	RequestId      string
	IpAddress      string
	Path           string
	UserAgent      string
	AcceptLanguage string

	AccountMigration einterfaces.AccountMigrationInterface
	Cluster          einterfaces.ClusterInterface
	Compliance       einterfaces.ComplianceInterface
	DataRetention    einterfaces.DataRetentionInterface
	Elasticsearch    einterfaces.ElasticsearchInterface
	Ldap             einterfaces.LdapInterface
	MessageExport    einterfaces.MessageExportInterface
	Metrics          einterfaces.MetricsInterface
	Notification     einterfaces.NotificationInterface
	Saml             einterfaces.SamlInterface

	HTTPService httpservice.HTTPService
	ImageProxy  *imageproxy.ImageProxy
	Timezones   *timezones.Timezones
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
	a.Srv.Shutdown()
	a.Srv = nil
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
	return a.Srv.diagnosticId
}

func (a *App) SetDiagnosticId(id string) {
	a.Srv.diagnosticId = id
}

func (a *App) EnsureDiagnosticId() {
	if a.Srv.diagnosticId != "" {
		return
	}
	props, err := a.Srv.Store.System().Get()
	if err != nil {
		return
	}

	id := props[model.SYSTEM_DIAGNOSTIC_ID]
	if len(id) == 0 {
		id = model.NewId()
		systemId := &model.System{Name: model.SYSTEM_DIAGNOSTIC_ID, Value: id}
		a.Srv.Store.System().Save(systemId)
	}

	a.Srv.diagnosticId = id
}

func (a *App) HTMLTemplates() *template.Template {
	if a.Srv.htmlTemplateWatcher != nil {
		return a.Srv.htmlTemplateWatcher.Templates()
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
	systemData, appErr := a.Srv.Store.System().GetByName(model.SYSTEM_INSTALLATION_DATE_KEY)
	if appErr != nil {
		return 0, appErr
	}
	value, err := strconv.ParseInt(systemData.Value, 10, 64)
	if err != nil {
		return 0, model.NewAppError("getSystemInstallDate", "app.system_install_date.parse_int.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return value, nil
}
