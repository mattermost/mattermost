// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

type Context struct {
	App           *app.App
	AppContext    request.CTX
	Logger        *mlog.Logger
	Params        *Params
	Err           *model.AppError
	siteURLHeader string
}

// LogAuditRec logs an audit record using default LevelAPI.
func (c *Context) LogAuditRec(rec *model.AuditRecord) {
	// finish populating the context data, in case the session wasn't available during MakeAuditRecord
	// (e.g., api4/user.go login)
	if rec.Actor.UserId == "" {
		rec.Actor.UserId = c.AppContext.Session().UserId
	}
	if rec.Actor.SessionId == "" {
		rec.Actor.SessionId = c.AppContext.Session().Id
	}

	c.LogAuditRecWithLevel(rec, app.LevelAPI)
}

// LogAuditRecWithLevel logs an audit record using specified Level.
// If the context is flagged with a permissions error then `level`
// is ignored and the audit record is emitted with `LevelPerms`.
func (c *Context) LogAuditRecWithLevel(rec *model.AuditRecord, level mlog.Level) {
	if rec == nil {
		return
	}
	if c.Err != nil {
		rec.AddErrorCode(c.Err.StatusCode)
		rec.AddErrorDesc(c.Err.Error())
		if c.Err.Id == "api.context.permissions.app_error" {
			level = app.LevelPerms
		}
		rec.Fail()
	}
	c.App.Srv().Audit.LogRecord(level, *rec)
}

// MakeAuditRecord creates an audit record pre-populated with data from this context.
func (c *Context) MakeAuditRecord(event string, initialStatus string) *model.AuditRecord {
	rec := &model.AuditRecord{
		EventName: event,
		Status:    initialStatus,
		Actor: model.AuditEventActor{
			UserId:        c.AppContext.Session().UserId,
			SessionId:     c.AppContext.Session().Id,
			Client:        c.AppContext.UserAgent(),
			IpAddress:     c.AppContext.IPAddress(),
			XForwardedFor: c.AppContext.XForwardedFor(),
		},
		Meta: map[string]any{
			model.AuditKeyAPIPath:   c.AppContext.Path(),
			model.AuditKeyClusterID: c.App.GetClusterId(),
		},
		EventData: model.AuditEventData{
			Parameters:  map[string]any{},
			PriorState:  map[string]any{},
			ResultState: map[string]any{},
			ObjectType:  "",
		},
	}

	return rec
}

func (c *Context) LogAudit(extraInfo string) {
	audit := &model.Audit{UserId: c.AppContext.Session().UserId, IpAddress: c.AppContext.IPAddress(), Action: c.AppContext.Path(), ExtraInfo: extraInfo, SessionId: c.AppContext.Session().Id}
	if err := c.App.Srv().Store().Audit().Save(audit); err != nil {
		appErr := model.NewAppError("LogAudit", "app.audit.save.saving.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		c.LogErrorByCode(appErr)
	}
}

func (c *Context) LogAuditWithUserId(userId, extraInfo string) {
	if c.AppContext.Session().UserId != "" {
		extraInfo = strings.TrimSpace(extraInfo + " session_user=" + c.AppContext.Session().UserId)
	}

	audit := &model.Audit{UserId: userId, IpAddress: c.AppContext.IPAddress(), Action: c.AppContext.Path(), ExtraInfo: extraInfo, SessionId: c.AppContext.Session().Id}
	if err := c.App.Srv().Store().Audit().Save(audit); err != nil {
		appErr := model.NewAppError("LogAuditWithUserId", "app.audit.save.saving.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		c.LogErrorByCode(appErr)
	}
}

func (c *Context) LogErrorByCode(err *model.AppError) {
	code := err.StatusCode
	msg := err.SystemMessage(i18n.TDefault)
	fields := []mlog.Field{
		mlog.String("err_where", err.Where),
		mlog.Int("http_code", err.StatusCode),
		mlog.String("error", err.Error()),
	}
	switch {
	case (code >= http.StatusBadRequest && code < http.StatusInternalServerError) ||
		err.Id == "web.check_browser_compatibility.app_error":
		c.Logger.Debug(msg, fields...)
	case code == http.StatusNotImplemented:
		c.Logger.Info(msg, fields...)
	default:
		c.Logger.Error(msg, fields...)
	}
}

func (c *Context) IsSystemAdmin() bool {
	return c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
}

func (c *Context) SessionRequired() {
	if !*c.App.Config().ServiceSettings.EnableUserAccessTokens &&
		c.AppContext.Session().Props[model.SessionPropType] == model.SessionTypeUserAccessToken &&
		c.AppContext.Session().Props[model.SessionPropIsBot] != model.SessionPropIsBotValue {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "UserAccessToken", http.StatusUnauthorized)
		return
	}

	if c.AppContext.Session().UserId == "" {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "UserRequired", http.StatusUnauthorized)
		return
	}
}

func (c *Context) CloudKeyRequired() {
	if license := c.App.Channels().License(); license == nil || !license.IsCloud() || c.AppContext.Session().Props[model.SessionPropType] != model.SessionTypeCloudKey {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "TokenRequired", http.StatusUnauthorized)
		return
	}
}

func (c *Context) RemoteClusterTokenRequired() {
	if license := c.App.Channels().License(); license == nil || !license.HasRemoteClusterService() || c.AppContext.Session().Props[model.SessionPropType] != model.SessionTypeRemoteclusterToken {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "TokenRequired", http.StatusUnauthorized)
		return
	}
}

func (c *Context) MfaRequired() {
	if appErr := c.App.MFARequired(c.AppContext); appErr != nil {
		c.Err = appErr
	}
}

// ExtendSessionExpiryIfNeeded will update Session.ExpiresAt based on session lengths in config.
// Session cookies will be resent to the client with updated max age.
func (c *Context) ExtendSessionExpiryIfNeeded(w http.ResponseWriter, r *http.Request) {
	if ok := c.App.ExtendSessionExpiryIfNeeded(c.AppContext, c.AppContext.Session()); ok {
		c.App.AttachSessionCookies(c.AppContext, w, r)
	}
}

func (c *Context) RemoveSessionCookie(w http.ResponseWriter, r *http.Request) {
	subpath, _ := utils.GetSubpathFromConfig(c.App.Config())

	cookie := &http.Cookie{
		Name:     model.SessionCookieToken,
		Value:    "",
		Path:     subpath,
		MaxAge:   -1,
		HttpOnly: true,
	}

	http.SetCookie(w, cookie)
}

func (c *Context) SetInvalidParam(parameter string) {
	c.Err = NewInvalidParamError(parameter)
}

func (c *Context) SetInvalidParamWithDetails(parameter string, details string) {
	c.Err = NewInvalidParamDetailedError(parameter, details)
}

func (c *Context) SetInvalidParamWithErr(parameter string, err error) {
	c.Err = NewInvalidParamError(parameter).Wrap(err)
}

func (c *Context) SetInvalidURLParam(parameter string) {
	c.Err = NewInvalidURLParamError(parameter)
}

func (c *Context) SetServerBusyError() {
	c.Err = NewServerBusyError()
}

func (c *Context) SetInvalidRemoteIdError(id string) {
	c.Err = NewInvalidRemoteIdError(id)
}

func (c *Context) SetInvalidRemoteClusterTokenError() {
	c.Err = NewInvalidRemoteClusterTokenError()
}

func (c *Context) SetJSONEncodingError(err error) {
	c.Err = NewJSONEncodingError(err)
}

func (c *Context) SetCommandNotFoundError() {
	c.Err = model.NewAppError("GetCommand", "store.sql_command.save.get.app_error", nil, "", http.StatusNotFound)
}

func (c *Context) HandleEtag(etag string, routeName string, w http.ResponseWriter, r *http.Request) bool {
	metrics := c.App.Metrics()
	if et := r.Header.Get(model.HeaderEtagClient); etag != "" {
		if et == etag {
			w.Header().Set(model.HeaderEtagServer, etag)
			w.WriteHeader(http.StatusNotModified)
			if metrics != nil {
				metrics.IncrementEtagHitCounter(routeName)
			}
			return true
		}
	}

	if metrics != nil {
		metrics.IncrementEtagMissCounter(routeName)
	}

	return false
}

func NewInvalidParamDetailedError(parameter string, details string) *model.AppError {
	err := model.NewAppError("Context", "api.context.invalid_body_param.app_error", map[string]any{"Name": parameter}, details, http.StatusBadRequest)
	return err
}
func NewInvalidParamError(parameter string) *model.AppError {
	err := model.NewAppError("Context", "api.context.invalid_body_param.app_error", map[string]any{"Name": parameter}, "", http.StatusBadRequest)
	return err
}

func NewInvalidURLParamError(parameter string) *model.AppError {
	err := model.NewAppError("Context", "api.context.invalid_url_param.app_error", map[string]any{"Name": parameter}, "", http.StatusBadRequest)
	return err
}

func NewServerBusyError() *model.AppError {
	err := model.NewAppError("Context", "api.context.server_busy.app_error", nil, "", http.StatusServiceUnavailable)
	return err
}

func NewInvalidRemoteIdError(parameter string) *model.AppError {
	err := model.NewAppError("Context", "api.context.remote_id_invalid.app_error", map[string]any{"RemoteId": parameter}, "", http.StatusBadRequest)
	return err
}

func NewInvalidRemoteClusterTokenError() *model.AppError {
	err := model.NewAppError("Context", "api.context.remote_id_invalid.app_error", nil, "", http.StatusUnauthorized)
	return err
}

func NewJSONEncodingError(err error) *model.AppError {
	appErr := model.NewAppError("Context", "api.context.json_encoding.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	return appErr
}

func (c *Context) SetPermissionError(permissions ...*model.Permission) {
	c.Err = model.MakePermissionError(c.AppContext.Session(), permissions)
}

func (c *Context) SetSiteURLHeader(url string) {
	c.siteURLHeader = strings.TrimRight(url, "/")
}

func (c *Context) GetSiteURLHeader() string {
	return c.siteURLHeader
}

func (c *Context) RequireUserId() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params.UserId == model.Me {
		c.Params.UserId = c.AppContext.Session().UserId
	}

	if !model.IsValidId(c.Params.UserId) {
		c.SetInvalidURLParam("user_id")
	}
	return c
}

func (c *Context) RequireOtherUserId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.OtherUserId) {
		c.SetInvalidURLParam("other_user_id")
	}
	return c
}

func (c *Context) RequireTeamId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.TeamId) {
		c.SetInvalidURLParam("team_id")
	}
	return c
}

func (c *Context) RequireCategoryId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidCategoryId(c.Params.CategoryId) {
		c.SetInvalidURLParam("category_id")
	}
	return c
}

func (c *Context) RequireInviteId() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params.InviteId == "" {
		c.SetInvalidURLParam("invite_id")
	}
	return c
}

func (c *Context) RequireTokenId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.TokenId) {
		c.SetInvalidURLParam("token_id")
	}
	return c
}

func (c *Context) RequireThreadId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.ThreadId) {
		c.SetInvalidURLParam("thread_id")
	}
	return c
}

func (c *Context) RequireTimestamp() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params.Timestamp == 0 {
		c.SetInvalidURLParam("timestamp")
	}
	return c
}

func (c *Context) RequireChannelId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.ChannelId) {
		c.SetInvalidURLParam("channel_id")
	}
	return c
}

func (c *Context) RequireUsername() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidUsername(c.Params.Username) {
		c.SetInvalidParam("username")
	}

	return c
}

func (c *Context) RequirePostId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.PostId) {
		c.SetInvalidURLParam("post_id")
	}
	return c
}

func (c *Context) RequirePolicyId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.PolicyId) {
		c.SetInvalidURLParam("policy_id")
	}
	return c
}

func (c *Context) RequireAppId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.AppId) {
		c.SetInvalidURLParam("app_id")
	}
	return c
}

func (c *Context) RequireOutgoingOAuthConnectionId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.OutgoingOAuthConnectionID) {
		c.SetInvalidURLParam("outgoing_oauth_connection_id")
	}
	return c
}

func (c *Context) RequireFileId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.FileId) {
		c.SetInvalidURLParam("file_id")
	}

	return c
}

func (c *Context) RequireUploadId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.UploadId) {
		c.SetInvalidURLParam("upload_id")
	}

	return c
}

func (c *Context) RequireFilename() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params.Filename == "" {
		c.SetInvalidURLParam("filename")
	}

	return c
}

func (c *Context) RequirePluginId() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params.PluginId == "" {
		c.SetInvalidURLParam("plugin_id")
	}

	return c
}

func (c *Context) RequireReportId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.ReportId) {
		c.SetInvalidURLParam("report_id")
	}
	return c
}

func (c *Context) RequireEmojiId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.EmojiId) {
		c.SetInvalidURLParam("emoji_id")
	}
	return c
}

func (c *Context) RequireTeamName() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidTeamName(c.Params.TeamName) {
		c.SetInvalidURLParam("team_name")
	}

	return c
}

func (c *Context) RequireChannelName() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidChannelIdentifier(c.Params.ChannelName) {
		c.SetInvalidURLParam("channel_name")
	}

	return c
}

func (c *Context) SanitizeEmail() *Context {
	if c.Err != nil {
		return c
	}
	c.Params.Email = strings.ToLower(c.Params.Email)
	if !model.IsValidEmail(c.Params.Email) {
		c.SetInvalidURLParam("email")
	}

	return c
}

func (c *Context) RequireCategory() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidAlphaNumHyphenUnderscore(c.Params.Category, true) {
		c.SetInvalidURLParam("category")
	}

	return c
}

func (c *Context) RequireService() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params.Service == "" {
		c.SetInvalidURLParam("service")
	}

	return c
}

func (c *Context) RequirePreferenceName() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidAlphaNumHyphenUnderscore(c.Params.PreferenceName, true) {
		c.SetInvalidURLParam("preference_name")
	}

	return c
}

func (c *Context) RequireEmojiName() *Context {
	if c.Err != nil {
		return c
	}

	validName := regexp.MustCompile(`^[a-zA-Z0-9\-\+_]+$`)

	if c.Params.EmojiName == "" || len(c.Params.EmojiName) > model.EmojiNameMaxLength || !validName.MatchString(c.Params.EmojiName) {
		c.SetInvalidURLParam("emoji_name")
	}

	return c
}

func (c *Context) RequireHookId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.HookId) {
		c.SetInvalidURLParam("hook_id")
	}

	return c
}

func (c *Context) RequireCommandId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.CommandId) {
		c.SetInvalidURLParam("command_id")
	}
	return c
}

func (c *Context) RequireJobId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.JobId) {
		c.SetInvalidURLParam("job_id")
	}
	return c
}

func (c *Context) RequireJobType() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params.JobType == "" || len(c.Params.JobType) > 32 {
		c.SetInvalidURLParam("job_type")
	}
	return c
}

func (c *Context) RequireRoleId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.RoleId) {
		c.SetInvalidURLParam("role_id")
	}
	return c
}

func (c *Context) RequireFieldId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.FieldId) {
		c.SetInvalidURLParam("field_id")
	}
	return c
}

func (c *Context) RequireSchemeId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.SchemeId) {
		c.SetInvalidURLParam("scheme_id")
	}
	return c
}

func (c *Context) RequireRoleName() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidRoleName(c.Params.RoleName) {
		c.SetInvalidURLParam("role_name")
	}

	return c
}

func (c *Context) RequireGroupId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.GroupId) {
		c.SetInvalidURLParam("group_id")
	}
	return c
}

func (c *Context) RequireRemoteId() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params.RemoteId == "" {
		c.SetInvalidURLParam("remote_id")
	}
	return c
}

func (c *Context) RequireSyncableId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.SyncableId) {
		c.SetInvalidURLParam("syncable_id")
	}
	return c
}

func (c *Context) RequireSyncableType() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params.SyncableType != model.GroupSyncableTypeTeam && c.Params.SyncableType != model.GroupSyncableTypeChannel {
		c.SetInvalidURLParam("syncable_type")
	}
	return c
}

func (c *Context) RequireBotUserId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.BotUserId) {
		c.SetInvalidURLParam("bot_user_id")
	}
	return c
}

func (c *Context) RequireInvoiceId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.InvoiceId) != 27 && c.Params.InvoiceId != model.UpcomingInvoice {
		c.SetInvalidURLParam("invoice_id")
	}

	return c
}

func (c *Context) RequireContentReviewerId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.ContentReviewerId) {
		c.SetInvalidURLParam("content_reviewer_id")
	}
	return c
}

func (c *Context) RequireRecapId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.RecapId) {
		c.SetInvalidURLParam("recap_id")
	}
	return c
}

func (c *Context) RequireWikiId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.WikiId) {
		c.SetInvalidURLParam("wiki_id")
	}
	return c
}

func (c *Context) RequirePageId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.PageId) {
		c.SetInvalidURLParam("page_id")
	}
	return c
}

func (c *Context) GetWikiForModify(callerContext string) (*model.Wiki, *model.Channel, bool) {
	if c.Err != nil {
		return nil, nil, false
	}

	wiki, err := c.App.GetWiki(c.AppContext, c.Params.WikiId)
	if err != nil {
		c.Err = err
		return nil, nil, false
	}

	channel, err := c.App.GetChannel(c.AppContext, wiki.ChannelId)
	if err != nil {
		c.Err = err
		return nil, nil, false
	}

	if !c.hasWikiModifyPermission(channel) {
		return nil, nil, false
	}

	return wiki, channel, true
}

// hasWikiModifyPermission checks if the current user can modify a wiki in the given channel.
// Sets c.Err and returns false if permission denied.
func (c *Context) hasWikiModifyPermission(channel *model.Channel) bool {
	session := c.AppContext.Session()

	switch channel.Type {
	case model.ChannelTypeOpen:
		if hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *session, channel.Id, model.PermissionManagePublicChannelProperties); !hasPermission {
			c.SetPermissionError(model.PermissionManagePublicChannelProperties)
			return false
		}
	case model.ChannelTypePrivate:
		if hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *session, channel.Id, model.PermissionManagePrivateChannelProperties); !hasPermission {
			c.SetPermissionError(model.PermissionManagePrivateChannelProperties)
			return false
		}
	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		if _, err := c.App.GetChannelMember(c.AppContext, channel.Id, session.UserId); err != nil {
			c.Err = model.NewAppError("hasWikiModifyPermission", "api.wiki.permission.direct_or_group_channels.app_error", nil, err.Message, http.StatusForbidden)
			return false
		}
		user, err := c.App.GetUser(session.UserId)
		if err != nil {
			c.Err = err
			return false
		}
		if user.IsGuest() {
			c.Err = model.NewAppError("hasWikiModifyPermission", "api.wiki.permission.direct_or_group_channels_by_guests.app_error", nil, "", http.StatusForbidden)
			return false
		}
	default:
		c.Err = model.NewAppError("hasWikiModifyPermission", "api.wiki.permission.forbidden.app_error", nil, "", http.StatusForbidden)
		return false
	}

	return true
}

func (c *Context) GetWikiForRead() (*model.Wiki, *model.Channel, bool) {
	if c.Err != nil {
		return nil, nil, false
	}

	wiki, err := c.App.GetWiki(c.AppContext, c.Params.WikiId)
	if err != nil {
		c.Err = err
		return nil, nil, false
	}

	channel, err := c.App.GetChannel(c.AppContext, wiki.ChannelId)
	if err != nil {
		c.Err = err
		return nil, nil, false
	}

	if hasPermission, _ := c.App.SessionHasPermissionToReadChannel(c.AppContext, *c.AppContext.Session(), channel); !hasPermission {
		c.SetPermissionError(model.PermissionReadChannelContent)
		return nil, nil, false
	}

	// Guests cannot access wiki/pages in DM/Group channels
	if channel.Type == model.ChannelTypeGroup || channel.Type == model.ChannelTypeDirect {
		user, userErr := c.App.GetUser(c.AppContext.Session().UserId)
		if userErr != nil {
			c.Err = userErr
			return nil, nil, false
		}
		if user.IsGuest() {
			c.Err = model.NewAppError("GetWikiForRead", "api.page.permission.guest_cannot_access", nil, "", http.StatusForbidden)
			return nil, nil, false
		}
	}

	return wiki, channel, true
}

func (c *Context) ValidatePageBelongsToWiki() (*model.Post, bool) {
	if c.Err != nil {
		return nil, false
	}

	page, err := c.App.GetPage(c.AppContext, c.Params.PageId)
	if err != nil {
		c.Err = model.NewAppError("ValidatePageBelongsToWiki", "api.wiki.page_not_found",
			nil, "", err.StatusCode).Wrap(err)
		return nil, false
	}

	pageWikiId, ok := page.Props[model.PagePropsWikiID].(string)
	if !ok || pageWikiId == "" {
		// Fallback: get wiki_id from PropertyValues (source of truth)
		var wikiErr *model.AppError
		pageWikiId, wikiErr = c.App.GetWikiIdForPage(c.AppContext, c.Params.PageId)
		if wikiErr != nil || pageWikiId == "" {
			c.Err = model.NewAppError("ValidatePageBelongsToWiki", "api.wiki.page_wiki_not_set",
				nil, "", http.StatusBadRequest)
			return nil, false
		}
	}

	if pageWikiId != c.Params.WikiId {
		// Check if the wiki in the URL exists before returning a mismatch error
		// If the wiki doesn't exist, return 404; if it exists but page doesn't belong to it, return 400
		if _, wikiErr := c.App.GetWiki(c.AppContext, c.Params.WikiId); wikiErr != nil {
			c.Err = model.NewAppError("ValidatePageBelongsToWiki", "api.wiki.not_found",
				nil, "", wikiErr.StatusCode).Wrap(wikiErr)
			return nil, false
		}
		c.Err = model.NewAppError("ValidatePageBelongsToWiki", "api.wiki.page_wiki_mismatch",
			nil, "", http.StatusBadRequest)
		return nil, false
	}

	return page, true
}

func (c *Context) GetRemoteID(r *http.Request) string {
	return r.Header.Get(model.HeaderRemoteclusterId)
}

// GetPageForModify validates a page can be modified by the current user.
// It performs all permission checks needed for page modification operations:
// 1. Validates page belongs to the wiki specified in the URL
// 2. Checks wiki modify permission
// 3. Checks page-level modify permission for the specified operation
// 4. Validates page's channel matches wiki's channel
func (c *Context) GetPageForModify(operation app.PageOperation, callerContext string) (*model.Wiki, *model.Post, bool) {
	if c.Err != nil {
		return nil, nil, false
	}

	// Get page and validate it belongs to this wiki
	page, ok := c.ValidatePageBelongsToWiki()
	if !ok {
		return nil, nil, false
	}

	// Check wiki modify permission
	wiki, channel, ok := c.GetWikiForModify(callerContext)
	if !ok {
		return nil, nil, false
	}

	// Check page-level modify permission
	if !c.hasPagePermission(channel, page, operation) {
		return nil, nil, false
	}

	// Validate channel match
	if page.ChannelId != wiki.ChannelId {
		c.Err = model.NewAppError(callerContext, "api.wiki.page_channel_mismatch", nil, "", http.StatusBadRequest)
		return nil, nil, false
	}

	return wiki, page, true
}

// hasPagePermission checks if the current user can perform an operation on a page.
// Sets c.Err and returns false if permission denied.
func (c *Context) hasPagePermission(channel *model.Channel, page *model.Post, operation app.PageOperation) bool {
	session := c.AppContext.Session()

	// Check base permission for the operation based on channel type
	switch channel.Type {
	case model.ChannelTypeOpen, model.ChannelTypePrivate:
		permission := getPagePermission(operation)
		if permission == nil {
			c.Err = model.NewAppError("hasPagePermission", "api.page.permission.invalid_operation", nil, "", http.StatusForbidden)
			return false
		}
		if hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *session, channel.Id, permission); !hasPermission {
			c.SetPermissionError(permission)
			return false
		}

	case model.ChannelTypeGroup, model.ChannelTypeDirect:
		if _, err := c.App.GetChannelMember(c.AppContext, channel.Id, session.UserId); err != nil {
			c.Err = model.NewAppError("hasPagePermission", "api.page.permission.no_channel_access", nil, "", http.StatusForbidden)
			return false
		}
		user, err := c.App.GetUser(session.UserId)
		if err != nil {
			c.Err = err
			return false
		}
		if user.IsGuest() {
			c.Err = model.NewAppError("hasPagePermission", "api.page.permission.guest_cannot_modify", nil, "", http.StatusForbidden)
			return false
		}

	default:
		c.Err = model.NewAppError("hasPagePermission", "api.page.permission.invalid_channel_type", nil, "", http.StatusForbidden)
		return false
	}

	// Additional ownership checks for existing pages
	if page != nil {
		// Open/Private channels: delete others' pages requires PermissionDeletePage
		if channel.Type == model.ChannelTypeOpen || channel.Type == model.ChannelTypePrivate {
			if operation == app.PageOperationDelete && page.UserId != session.UserId {
				if hasPermission, _ := c.App.SessionHasPermissionToChannel(c.AppContext, *session, channel.Id, model.PermissionDeletePage); !hasPermission {
					c.SetPermissionError(model.PermissionDeletePage)
					return false
				}
			}
		}

		// DM/Group channels: edit/delete others' pages requires SchemeAdmin
		if channel.Type == model.ChannelTypeGroup || channel.Type == model.ChannelTypeDirect {
			if operation == app.PageOperationEdit || operation == app.PageOperationDelete {
				if page.UserId != session.UserId {
					member, memberErr := c.App.GetChannelMember(c.AppContext, channel.Id, session.UserId)
					if memberErr != nil {
						statusCode := http.StatusForbidden
						if memberErr.StatusCode == http.StatusInternalServerError {
							statusCode = http.StatusInternalServerError
						}
						c.Err = model.NewAppError("hasPagePermission", "api.page.permission.no_channel_access", nil, "", statusCode).Wrap(memberErr)
						return false
					}
					if !member.SchemeAdmin {
						c.Err = model.NewAppError("hasPagePermission", "api.context.permissions.app_error", nil, "", http.StatusForbidden)
						return false
					}
				}
			}
		}
	}

	return true
}

// getPagePermission maps a PageOperation to its corresponding Permission.
func getPagePermission(operation app.PageOperation) *model.Permission {
	switch operation {
	case app.PageOperationCreate:
		return model.PermissionCreatePage
	case app.PageOperationRead:
		return model.PermissionReadPage
	case app.PageOperationEdit:
		return model.PermissionEditPage
	case app.PageOperationDelete:
		return model.PermissionDeleteOwnPage
	default:
		return nil
	}
}

// CheckPagePermission checks if the current user can perform an operation on a page.
// Use this when you have a page but are not going through wiki routes.
// Sets c.Err and returns false if permission denied.
func (c *Context) CheckPagePermission(page *model.Post, operation app.PageOperation) bool {
	if c.Err != nil {
		return false
	}

	channel, err := c.App.GetChannel(c.AppContext, page.ChannelId)
	if err != nil {
		c.Err = err
		return false
	}

	return c.hasPagePermission(channel, page, operation)
}

// CheckChannelPagePermission checks if the current user can create pages in a channel.
// Use this when checking permission to create a page (no page exists yet).
// Sets c.Err and returns false if permission denied.
func (c *Context) CheckChannelPagePermission(channel *model.Channel, operation app.PageOperation) bool {
	if c.Err != nil {
		return false
	}

	return c.hasPagePermission(channel, nil, operation)
}

// CheckWikiModifyPermission checks if the current user can modify wikis in a channel.
// Use this when you have a channel object but are not going through wiki routes.
// Sets c.Err and returns false if permission denied.
func (c *Context) CheckWikiModifyPermission(channel *model.Channel) bool {
	if c.Err != nil {
		return false
	}

	return c.hasWikiModifyPermission(channel)
}
