// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/httpservice"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/public/shared/timezones"
	"github.com/mattermost/mattermost/server/v8/channels/app/properties"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/platform/services/imageproxy"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
	"github.com/mattermost/mattermost/server/v8/platform/shared/templates"
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
func (a *App) LdapDiagnostic() einterfaces.LdapDiagnosticInterface {
	return a.ch.srv.platform.LdapDiagnostic()
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
func (a *App) IPFiltering() einterfaces.IPFilteringInterface {
	return a.ch.srv.IPFiltering
}
func (a *App) OutgoingOAuthConnections() einterfaces.OutgoingOAuthConnectionInterface {
	return a.ch.srv.OutgoingOAuthConnection
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

func (a *App) PropertyService() *properties.PropertyService {
	return a.Srv().propertyService
}

func (a *App) UpdateExpiredDNDStatuses() ([]*model.Status, error) {
	return a.Srv().Store().Status().UpdateExpiredDNDStatuses()
}

// PostDebugToTownSquare is the interface method required by sharedchannel service
func (a *App) PostDebugToTownSquare(c request.CTX, message string) {
	// For interface compatibility, use empty channel ID and find a user
	a.postDebugToTownSquareWithContext(c, "", "", message)
}

// postDebugToTownSquareWithContext is the internal method with full context
func (a *App) postDebugToTownSquareWithContext(c request.CTX, channelId, userId, message string) {
	// Include the original channel ID in the message for context if provided
	debugMessage := message
	if channelId != "" {
		debugMessage = fmt.Sprintf("[SharedChannel:%s] %s", channelId, message)
	}

	// Create the post asynchronously to avoid recursive notification calls
	go func() {
		// Get the first available team's town-square channel
		teams, terr := a.Srv().Store().Team().GetAll()
		if terr != nil || len(teams) == 0 {
			a.Log().Warn("Failed to find any team for debug message", mlog.Err(terr))
			return
		}

		// Find town-square channel
		var townSquare *model.Channel
		var err error
		for _, team := range teams {
			townSquare, err = a.Srv().Store().Channel().GetByName(team.Id, model.DefaultChannelName, false)
			if err == nil {
				break
			}
		}

		if townSquare == nil {
			a.Log().Warn("Failed to find town square channel for debug message")
			return
		}

		// If no user ID provided, find one
		if userId == "" {
			// Get any admin user to post the message
			admins, err := a.Srv().Store().User().GetSystemAdminProfiles()
			if err != nil || len(admins) == 0 {
				a.Log().Warn("Failed to find admin user for debug message", mlog.Err(err))
				return
			}
			// Get the first admin user ID from the map
			for uid := range admins {
				userId = uid
				break
			}
		}

		post := &model.Post{
			ChannelId: townSquare.Id,
			Message:   debugMessage,
			Type:      model.PostTypeSystemGeneric,
			UserId:    userId,
			CreateAt:  model.GetMillis(),
		}

		// Create a new context for the async operation
		asyncCtx := request.EmptyContext(a.Log())
		_, appErr := a.CreatePost(asyncCtx, post, townSquare, model.CreatePostFlags{})
		if appErr != nil {
			a.Log().Warn("Failed to post debug message to town square",
				mlog.String("channel_id", townSquare.Id),
				mlog.Err(appErr))
		}
	}()
}
