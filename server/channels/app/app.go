// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/mattermost/mattermost-server/server/v8/channels/einterfaces"
	"github.com/mattermost/mattermost-server/server/v8/channels/product"
	"github.com/mattermost/mattermost-server/server/v8/channels/utils"
	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/platform/services/httpservice"
	"github.com/mattermost/mattermost-server/server/v8/platform/services/imageproxy"
	"github.com/mattermost/mattermost-server/server/v8/platform/services/searchengine"
	"github.com/mattermost/mattermost-server/server/v8/platform/services/timezones"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/templates"
)

// App is a pure functional component that does not have any fields, except Server.
// It is a request-scoped struct constructed every time a request hits the server,
// and its only purpose is to provide business logic to Server via its methods.
type App struct {
	ch *Channels
}

func New(options ...AppOption) *App {
	app := &App{}

	for _, option := range options {
		option(app)
	}

	return app
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

func (s *Server) getFirstServerRunTimestamp() (int64, *model.AppError) {
	systemData, err := s.Store().System().GetByName(model.SystemFirstServerRunTimestampKey)
	if err != nil {
		return 0, model.NewAppError("getFirstServerRunTimestamp", "app.system.get_by_name.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	value, err := strconv.ParseInt(systemData.Value, 10, 64)
	if err != nil {
		return 0, model.NewAppError("getFirstServerRunTimestamp", "app.system_install_date.parse_int.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return value, nil
}

func (a *App) Channels() *Channels {
	return a.ch
}
func (a *App) Srv() *Server {
	return a.ch.srv
}
func (a *App) Log() *mlog.Logger {
	return a.ch.srv.Log()
}
func (a *App) NotificationsLog() *mlog.Logger {
	return a.ch.srv.NotificationsLog()
}

func (a *App) AccountMigration() einterfaces.AccountMigrationInterface {
	return a.ch.AccountMigration
}
func (a *App) Cluster() einterfaces.ClusterInterface {
	return a.ch.srv.platform.Cluster()
}
func (a *App) Compliance() einterfaces.ComplianceInterface {
	return a.ch.Compliance
}
func (a *App) DataRetention() einterfaces.DataRetentionInterface {
	return a.ch.DataRetention
}
func (a *App) SearchEngine() *searchengine.Broker {
	return a.ch.srv.platform.SearchEngine
}
func (a *App) Ldap() einterfaces.LdapInterface {
	return a.ch.Ldap
}
func (a *App) MessageExport() einterfaces.MessageExportInterface {
	return a.ch.MessageExport
}
func (a *App) Metrics() einterfaces.MetricsInterface {
	return a.ch.srv.GetMetrics()
}
func (a *App) Notification() einterfaces.NotificationInterface {
	return a.ch.Notification
}
func (a *App) Saml() einterfaces.SamlInterface {
	return a.ch.Saml
}
func (a *App) Cloud() einterfaces.CloudInterface {
	return a.ch.srv.Cloud
}
func (a *App) HTTPService() httpservice.HTTPService {
	return a.ch.srv.httpService
}
func (a *App) ImageProxy() *imageproxy.ImageProxy {
	return a.ch.imageProxy
}
func (a *App) Timezones() *timezones.Timezones {
	return a.ch.srv.timezones
}
func (a *App) License() *model.License {
	return a.Srv().License()
}

func (a *App) DBHealthCheckWrite() error {
	currentTime := strconv.FormatInt(time.Now().Unix(), 10)

	return a.Srv().Store().System().SaveOrUpdate(&model.System{
		Name:  a.dbHealthCheckKey(),
		Value: currentTime,
	})
}

func (a *App) DBHealthCheckDelete() error {
	_, err := a.Srv().Store().System().PermanentDeleteByName(a.dbHealthCheckKey())
	return err
}

func (a *App) dbHealthCheckKey() string {
	return fmt.Sprintf("health_check_%s", a.GetClusterId())
}

func (a *App) CheckIntegrity() <-chan model.IntegrityCheckResult {
	return a.Srv().Store().CheckIntegrity()
}

func (a *App) SetChannels(ch *Channels) {
	a.ch = ch
}

func (a *App) SetServer(srv *Server) {
	a.ch.srv = srv
}

func (a *App) UpdateExpiredDNDStatuses() ([]*model.Status, error) {
	return a.Srv().Store().Status().UpdateExpiredDNDStatuses()
}

// Ensure system service adapter implements `product.SystemService`
var _ product.SystemService = (*systemServiceAdapter)(nil)

// systemServiceAdapter provides a collection of system APIs for use by products.
type systemServiceAdapter struct {
	server *Server
}

func (ssa *systemServiceAdapter) GetDiagnosticId() string {
	return ssa.server.TelemetryId()
}
