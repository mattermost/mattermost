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

func (c *Context) RequireGroupName() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidPropertyGroupName(c.Params.GroupName) {
		c.SetInvalidURLParam("group_name")
	}
	return c
}

func (c *Context) RequireObjectType() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidPropertyFieldObjectType(c.Params.ObjectType) {
		c.SetInvalidURLParam("object_type")
	}
	return c
}

func (c *Context) RequireTargetId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.TargetId) {
		c.SetInvalidURLParam("target_id")
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

func (c *Context) RequireViewId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.ViewId) {
		c.SetInvalidURLParam("view_id")
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

func (c *Context) RequirePermissionToManageSecureConnections() *Context {
	if c.Err != nil {
		return c
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSecureConnections) {
		c.SetPermissionError(model.PermissionManageSecureConnections)
	}
	return c
}

func (c *Context) GetWikiForModify() (*model.Wiki, *model.Channel, bool) {
	if c.Err != nil {
		return nil, nil, false
	}

	wiki, err := c.App.GetWiki(c.AppContext, c.Params.WikiId)
	if err != nil {
		c.Err = err
		return nil, nil, false
	}

	// Team-only wikis have no backing channel.
	if wiki.ChannelId == "" {
		if !c.hasWikiModifyPermission(nil, wiki) {
			return nil, nil, false
		}
		return wiki, nil, true
	}

	channel, err := c.App.GetWikiBackingChannel(c.AppContext, wiki.ChannelId)
	if err != nil {
		c.Err = err
		return nil, nil, false
	}

	if !c.hasWikiModifyPermission(channel, wiki) {
		return nil, nil, false
	}

	return wiki, channel, true
}

// hasWikiModifyPermission gates write-path entry to a wiki: the user must be
// able to *see* the wiki at all (read_wiki). Specific content perms
// (create_page, edit_page, delete_page, etc.) are then enforced by each caller
// against SessionHasWikiPermission / SessionHasPagePermission. Wiki settings
// (rename, delete, ACL admin) are gated separately via manage_wiki / admin_wiki
// at their own call sites.
func (c *Context) hasWikiModifyPermission(channel *model.Channel, wiki *model.Wiki) bool {
	session := c.AppContext.Session()

	if session.IsGuest() {
		c.Err = model.NewAppError("hasWikiModifyPermission", "api.wiki.permission.guest_not_allowed.app_error", nil, "", http.StatusForbidden)
		return false
	}

	if channel != nil && channel.IsGroupOrDirect() {
		if _, err := c.App.GetChannelMember(c.AppContext, channel.Id, session.UserId); err != nil {
			c.Err = model.NewAppError("hasWikiModifyPermission", "api.wiki.permission.direct_or_group_channels.app_error", nil, err.Message, http.StatusForbidden)
			return false
		}
	}

	if !c.App.SessionHasWikiPermission(*session, wiki, model.PermissionReadWiki) {
		c.SetPermissionError(model.PermissionReadWiki)
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

	session := c.AppContext.Session()
	if !c.App.SessionHasWikiPermission(*session, wiki, model.PermissionReadWiki) {
		c.SetPermissionError(model.PermissionReadWiki)
		return nil, nil, false
	}

	if wiki.ChannelId == "" {
		return wiki, nil, true
	}

	channel, err := c.App.GetWikiBackingChannel(c.AppContext, wiki.ChannelId)
	if err != nil {
		c.Err = err
		return nil, nil, false
	}

	// Pre-Phase-2 stopgap: gate read on backing-channel membership.
	//
	// Phase 2 will replace this with per-wiki ACL rows seeded from backing-channel
	// members at CreateWiki time (default_open=false for private-channel-backed
	// wikis). Once that ships, REMOVE this gate — it will silently override
	// legitimate ACL grants to non-channel-members (e.g. an auditor granted
	// read_wiki without joining the private channel).
	//
	// See plans/wiki-page-permissions-confluence.md, "Phase 2 migration checklist".
	// TODO(wiki-perms-phase2): remove channel-membership gate when ACL seeding lands.
	if channel.IsGroupOrDirect() || channel.Type == model.ChannelTypePrivate {
		if _, err := c.App.GetChannelMember(c.AppContext, channel.Id, session.UserId); err != nil {
			c.Err = model.NewAppError("GetWikiForRead", "api.page.permission.no_channel_access", nil, "", http.StatusForbidden)
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

	pageWikiId, wikiErr := c.App.GetWikiIdForPost(c.AppContext, page)
	if wikiErr != nil || pageWikiId == "" {
		c.Err = model.NewAppError("ValidatePageBelongsToWiki", "api.wiki.page_wiki_not_set",
			nil, "", http.StatusBadRequest)
		return nil, false
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

func (c *Context) RequirePermissionToManageSharedChannels() *Context {
	if c.Err != nil {
		return c
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSharedChannels) {
		c.SetPermissionError(model.PermissionManageSharedChannels)
	}
	return c
}

func (c *Context) RequirePermissionToManageSecureConnectionsOrSharedChannels() *Context {
	if c.Err != nil {
		return c
	}

	if !c.App.SessionHasPermissionToAny(*c.AppContext.Session(), []*model.Permission{
		model.PermissionManageSecureConnections,
		model.PermissionManageSharedChannels,
	}) {
		c.SetPermissionError(model.PermissionManageSecureConnections, model.PermissionManageSharedChannels)
	}
	return c
}

func (c *Context) GetRemoteID(r *http.Request) string {
	return r.Header.Get(model.HeaderRemoteclusterId)
}

// GetPageForRead validates a page belongs to the wiki and user has read permission.
// Returns page, wiki, and channel in a single operation to avoid redundant DB fetches.
// Use this instead of calling ValidatePageBelongsToWiki() + GetWikiForRead() separately.
func (c *Context) GetPageForRead() (*model.Post, *model.Wiki, *model.Channel, bool) {
	if c.Err != nil {
		return nil, nil, nil, false
	}

	// Get wiki and channel first (includes permission check)
	wiki, channel, ok := c.GetWikiForRead()
	if !ok {
		return nil, nil, nil, false
	}

	// Validate page belongs to wiki (fetches page, checks wiki ID mismatch, etc.)
	page, ok := c.ValidatePageBelongsToWiki()
	if !ok {
		return nil, nil, nil, false
	}

	// Validate channel match
	if page.ChannelId != wiki.ChannelId {
		c.Err = model.NewAppError("GetPageForRead", "api.wiki.page_channel_mismatch", nil, "", http.StatusBadRequest)
		return nil, nil, nil, false
	}

	// Check page-level read permission
	if !c.hasPagePermission(channel, wiki, page, app.PageOperationRead) {
		return nil, nil, nil, false
	}

	return page, wiki, channel, true
}

// GetPageForModify validates a page can be modified by the current user.
// It performs all permission checks needed for page modification operations:
// 1. Validates page belongs to the wiki specified in the URL
// 2. Checks the user can read the wiki (access check)
// 3. Checks page-level modify permission for the specified operation
// 4. Validates page's channel matches wiki's channel
// Returns wiki, page, channel, and success bool.
func (c *Context) GetPageForModify(operation app.PageOperation, callerContext string) (*model.Wiki, *model.Post, *model.Channel, bool) {
	if c.Err != nil {
		return nil, nil, nil, false
	}

	// Get page and validate it belongs to this wiki
	page, ok := c.ValidatePageBelongsToWiki()
	if !ok {
		return nil, nil, nil, false
	}

	// Get wiki and channel, verifying read access.
	// Page-level permissions (create/edit/delete) are checked separately below
	// via hasPagePermission, which handles both direct and linked channel access.
	wiki, channel, ok := c.GetWikiForRead()
	if !ok {
		return nil, nil, nil, false
	}

	// Check page-level modify permission
	if !c.hasPagePermission(channel, wiki, page, operation) {
		return nil, nil, nil, false
	}

	// Validate channel match
	if page.ChannelId != wiki.ChannelId {
		c.Err = model.NewAppError(callerContext, "api.wiki.page_channel_mismatch", nil, "", http.StatusBadRequest)
		return nil, nil, nil, false
	}

	return wiki, page, channel, true
}

// hasPagePermission checks if the current user can perform an operation on a page.
// Sets c.Err and returns false if permission denied.
//
// All page perms are team-scoped (Phase 1 of the wiki/page permission migration).
// The wiki argument identifies the wiki the page belongs to and is required.
// channel may be nil for team-only wikis. DM/Group backing channels enforce
// channel membership as a separate access gate before the perm check runs.
func (c *Context) hasPagePermission(channel *model.Channel, wiki *model.Wiki, page *model.Post, operation app.PageOperation) bool {
	session := c.AppContext.Session()

	// DM/Group wiki backing channels require channel membership in addition to perms.
	if channel != nil && channel.IsGroupOrDirect() {
		if _, err := c.App.GetChannelMember(c.AppContext, channel.Id, session.UserId); err != nil {
			c.Err = model.NewAppError("hasPagePermission", "api.page.permission.no_channel_access", nil, "", http.StatusForbidden)
			return false
		}
	}

	switch operation {
	case app.PageOperationRead, app.PageOperationCreate:
		perm := getPagePermission(operation)
		if !c.App.SessionHasPagePermission(*session, wiki, page, perm) {
			c.SetPermissionError(perm)
			return false
		}

	case app.PageOperationEdit:
		// edit_page grants regardless of authorship; edit_own_page also acceptable for the author.
		if c.App.SessionHasPagePermission(*session, wiki, page, model.PermissionEditPage) {
			return true
		}
		if c.App.SessionHasPagePermission(*session, wiki, page, model.PermissionEditOwnPage) {
			return true
		}
		c.SetPermissionError(model.PermissionEditPage)
		return false

	case app.PageOperationDelete:
		if c.App.SessionHasPagePermission(*session, wiki, page, model.PermissionDeletePage) {
			return true
		}
		if c.App.SessionHasPagePermission(*session, wiki, page, model.PermissionDeleteOwnPage) {
			return true
		}
		c.SetPermissionError(model.PermissionDeletePage)
		return false

	case app.PageOperationRestore:
		if !c.App.SessionHasPagePermission(*session, wiki, page, model.PermissionDeletePage) {
			c.SetPermissionError(model.PermissionDeletePage)
			return false
		}

	default:
		c.Err = model.NewAppError("hasPagePermission", "api.page.permission.invalid_operation", nil, "", http.StatusForbidden)
		return false
	}

	return true
}

// getPagePermission maps a PageOperation to its corresponding base Permission.
// Edit and Delete have separate own/non-own variants resolved at call sites.
func getPagePermission(operation app.PageOperation) *model.Permission {
	switch operation {
	case app.PageOperationCreate:
		return model.PermissionCreatePage
	case app.PageOperationRead:
		return model.PermissionReadPage
	case app.PageOperationEdit:
		return model.PermissionEditPage
	case app.PageOperationDelete:
		return model.PermissionDeletePage
	case app.PageOperationRestore:
		return model.PermissionDeletePage
	default:
		return nil
	}
}

// getPageCommentPermission maps a PageCommentOperation + ownership to a Permission.
// Authors edit/delete their own comments via comment_page; non-authors need
// manage_wiki (Phase 1 — finer-grained edit_others_comments perms can be added later).
func getPageCommentPermission(operation app.PageCommentOperation, isAuthor bool) *model.Permission {
	switch operation {
	case app.PageCommentOperationEdit, app.PageCommentOperationDelete:
		if isAuthor {
			return model.PermissionCommentPage
		}
		return model.PermissionManageWiki
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

	channel, err := c.App.GetWikiBackingChannel(c.AppContext, page.ChannelId)
	if err != nil {
		c.Err = err
		return false
	}

	wiki, wErr := c.App.GetWikiByChannelId(c.AppContext, channel.Id)
	if wErr != nil {
		c.Err = wErr
		return false
	}

	return c.hasPagePermission(channel, wiki, page, operation)
}

// CheckChannelPagePermission checks if the current user can create pages in a channel.
// Use this when checking permission to create a page (no page exists yet).
// Sets c.Err and returns false if permission denied.
//
// channel may be nil when the caller obtained it from GetWikiForRead on a
// team-only wiki (no backing channel). Pages require a backing channel, so
// reject with 400 rather than dereference nil.
func (c *Context) CheckChannelPagePermission(channel *model.Channel, operation app.PageOperation) bool {
	if c.Err != nil {
		return false
	}

	if channel == nil {
		c.Err = model.NewAppError("CheckChannelPagePermission", "api.page.permission.no_channel", nil, "", http.StatusBadRequest)
		return false
	}

	wiki, wErr := c.App.GetWikiByChannelId(c.AppContext, channel.Id)
	if wErr != nil {
		c.Err = wErr
		return false
	}

	return c.hasPagePermission(channel, wiki, nil, operation)
}

// CheckPageCommentPermission checks if the current user can perform an operation
// on a page comment. All page-comment perms resolve at team scope through
// SessionHasWikiPermission. Sets c.Err and returns false if permission denied.
func (c *Context) CheckPageCommentPermission(comment *model.Post, operation app.PageCommentOperation) bool {
	if c.Err != nil {
		return false
	}

	isAuthor := c.AppContext.Session().UserId == comment.UserId
	permission := getPageCommentPermission(operation, isAuthor)
	if permission == nil {
		c.Err = model.NewAppError("CheckPageCommentPermission", "api.page.permission.invalid_operation", nil, "", http.StatusForbidden)
		return false
	}

	wiki, err := c.App.GetWikiByChannelId(c.AppContext, comment.ChannelId)
	if err != nil {
		c.Err = err
		return false
	}

	if !c.App.SessionHasWikiPermission(*c.AppContext.Session(), wiki, permission) {
		c.SetPermissionError(permission)
		return false
	}
	return true
}

// CheckWikiModifyPermission checks if the current user can modify wikis in a channel.
// Use this when you have a channel object but are not going through wiki routes.
// Sets c.Err and returns false if permission denied.
func (c *Context) CheckWikiModifyPermission(channel *model.Channel) bool {
	if c.Err != nil {
		return false
	}

	wiki, err := c.App.GetWikiByChannelId(c.AppContext, channel.Id)
	if err != nil {
		c.Err = err
		return false
	}
	return c.hasWikiModifyPermission(channel, wiki)
}
