// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"net/http"
	"path"
	"regexp"
	"strings"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
	"github.com/mattermost/mattermost-server/v5/utils"
)

type Context struct {
	App           app.AppIface
	Logger        *mlog.Logger
	Params        *Params
	Err           *model.AppError
	siteURLHeader string
}

// LogAuditRec logs an audit record using default LevelAPI.
func (c *Context) LogAuditRec(rec *audit.Record) {
	c.LogAuditRecWithLevel(rec, app.LevelAPI)
}

// LogAuditRec logs an audit record using specified Level.
// If the context is flagged with a permissions error then `level`
// is ignored and the audit record is emitted with `LevelPerms`.
func (c *Context) LogAuditRecWithLevel(rec *audit.Record, level mlog.LogLevel) {
	if rec == nil {
		return
	}
	if c.Err != nil {
		rec.AddMeta("err", c.Err.Id)
		rec.AddMeta("code", c.Err.StatusCode)
		if c.Err.Id == "api.context.permissions.app_error" {
			level = app.LevelPerms
		}
		rec.Fail()
	}
	c.App.Srv().Audit.LogRecord(level, *rec)
}

// MakeAuditRecord creates a audit record pre-populated with data from this context.
func (c *Context) MakeAuditRecord(event string, initialStatus string) *audit.Record {
	rec := &audit.Record{
		APIPath:   c.App.Path(),
		Event:     event,
		Status:    initialStatus,
		UserID:    c.App.Session().UserId,
		SessionID: c.App.Session().Id,
		Client:    c.App.UserAgent(),
		IPAddress: c.App.IpAddress(),
		Meta:      audit.Meta{audit.KeyClusterID: c.App.GetClusterId()},
	}
	rec.AddMetaTypeConverter(model.AuditModelTypeConv)

	return rec
}

func (c *Context) LogAudit(extraInfo string) {
	audit := &model.Audit{UserId: c.App.Session().UserId, IpAddress: c.App.IpAddress(), Action: c.App.Path(), ExtraInfo: extraInfo, SessionId: c.App.Session().Id}
	if err := c.App.Srv().Store.Audit().Save(audit); err != nil {
		appErr := model.NewAppError("LogAudit", "app.audit.save.saving.app_error", nil, err.Error(), http.StatusInternalServerError)
		c.LogErrorByCode(appErr)
	}
}

func (c *Context) LogAuditWithUserId(userId, extraInfo string) {

	if c.App.Session().UserId != "" {
		extraInfo = strings.TrimSpace(extraInfo + " session_user=" + c.App.Session().UserId)
	}

	audit := &model.Audit{UserId: userId, IpAddress: c.App.IpAddress(), Action: c.App.Path(), ExtraInfo: extraInfo, SessionId: c.App.Session().Id}
	if err := c.App.Srv().Store.Audit().Save(audit); err != nil {
		appErr := model.NewAppError("LogAuditWithUserId", "app.audit.save.saving.app_error", nil, err.Error(), http.StatusInternalServerError)
		c.LogErrorByCode(appErr)
	}
}

func (c *Context) LogErrorByCode(err *model.AppError) {
	code := err.StatusCode
	msg := err.SystemMessage(i18n.TDefault)
	fields := []mlog.Field{
		mlog.String("err_where", err.Where),
		mlog.Int("http_code", err.StatusCode),
		mlog.String("err_details", err.DetailedError),
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
	return c.App.SessionHasPermissionTo(*c.App.Session(), model.PERMISSION_MANAGE_SYSTEM)
}

func (c *Context) SessionRequired() {
	if !*c.App.Config().ServiceSettings.EnableUserAccessTokens &&
		c.App.Session().Props[model.SESSION_PROP_TYPE] == model.SESSION_TYPE_USER_ACCESS_TOKEN &&
		c.App.Session().Props[model.SESSION_PROP_IS_BOT] != model.SESSION_PROP_IS_BOT_VALUE {

		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "UserAccessToken", http.StatusUnauthorized)
		return
	}

	if c.App.Session().UserId == "" {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "UserRequired", http.StatusUnauthorized)
		return
	}
}

func (c *Context) CloudKeyRequired() {
	if license := c.App.Srv().License(); license == nil || !*license.Features.Cloud || c.App.Session().Props[model.SESSION_PROP_TYPE] != model.SESSION_TYPE_CLOUD_KEY {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "TokenRequired", http.StatusUnauthorized)
		return
	}
}

func (c *Context) RemoteClusterTokenRequired() {
	if license := c.App.Srv().License(); license == nil || !*license.Features.RemoteClusterService || c.App.Session().Props[model.SESSION_PROP_TYPE] != model.SESSION_TYPE_REMOTECLUSTER_TOKEN {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "TokenRequired", http.StatusUnauthorized)
		return
	}
}

func (c *Context) MfaRequired() {
	// Must be licensed for MFA and have it configured for enforcement
	if license := c.App.Srv().License(); license == nil || !*license.Features.MFA || !*c.App.Config().ServiceSettings.EnableMultifactorAuthentication || !*c.App.Config().ServiceSettings.EnforceMultifactorAuthentication {
		return
	}

	// OAuth integrations are excepted
	if c.App.Session().IsOAuth {
		return
	}

	user, err := c.App.GetUser(c.App.Session().UserId)
	if err != nil {
		c.Err = model.NewAppError("MfaRequired", "api.context.get_user.app_error", nil, err.Error(), http.StatusUnauthorized)
		return
	}

	if user.IsGuest() && !*c.App.Config().GuestAccountsSettings.EnforceMultifactorAuthentication {
		return
	}
	// Only required for email and ldap accounts
	if user.AuthService != "" &&
		user.AuthService != model.USER_AUTH_SERVICE_EMAIL &&
		user.AuthService != model.USER_AUTH_SERVICE_LDAP {
		return
	}

	// Special case to let user get themself
	subpath, _ := utils.GetSubpathFromConfig(c.App.Config())
	if c.App.Path() == path.Join(subpath, "/api/v4/users/me") {
		return
	}

	// Bots are exempt
	if user.IsBot {
		return
	}

	if !user.MfaActive {
		c.Err = model.NewAppError("MfaRequired", "api.context.mfa_required.app_error", nil, "", http.StatusForbidden)
		return
	}
}

// ExtendSessionExpiryIfNeeded will update Session.ExpiresAt based on session lengths in config.
// Session cookies will be resent to the client with updated max age.
func (c *Context) ExtendSessionExpiryIfNeeded(w http.ResponseWriter, r *http.Request) {
	if ok := c.App.ExtendSessionExpiryIfNeeded(c.App.Session()); ok {
		c.App.AttachSessionCookies(w, r)
	}
}

func (c *Context) RemoveSessionCookie(w http.ResponseWriter, r *http.Request) {
	subpath, _ := utils.GetSubpathFromConfig(c.App.Config())

	cookie := &http.Cookie{
		Name:     model.SESSION_COOKIE_TOKEN,
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

func (c *Context) SetInvalidUrlParam(parameter string) {
	c.Err = NewInvalidUrlParamError(parameter)
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

func (c *Context) SetJSONEncodingError() {
	c.Err = NewJSONEncodingError()
}

func (c *Context) SetCommandNotFoundError() {
	c.Err = model.NewAppError("GetCommand", "store.sql_command.save.get.app_error", nil, "", http.StatusNotFound)
}

func (c *Context) HandleEtag(etag string, routeName string, w http.ResponseWriter, r *http.Request) bool {
	metrics := c.App.Metrics()
	if et := r.Header.Get(model.HEADER_ETAG_CLIENT); etag != "" {
		if et == etag {
			w.Header().Set(model.HEADER_ETAG_SERVER, etag)
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

func NewInvalidParamError(parameter string) *model.AppError {
	err := model.NewAppError("Context", "api.context.invalid_body_param.app_error", map[string]interface{}{"Name": parameter}, "", http.StatusBadRequest)
	return err
}
func NewInvalidUrlParamError(parameter string) *model.AppError {
	err := model.NewAppError("Context", "api.context.invalid_url_param.app_error", map[string]interface{}{"Name": parameter}, "", http.StatusBadRequest)
	return err
}
func NewServerBusyError() *model.AppError {
	err := model.NewAppError("Context", "api.context.server_busy.app_error", nil, "", http.StatusServiceUnavailable)
	return err
}

func NewInvalidRemoteIdError(parameter string) *model.AppError {
	err := model.NewAppError("Context", "api.context.remote_id_invalid.app_error", map[string]interface{}{"RemoteId": parameter}, "", http.StatusBadRequest)
	return err
}

func NewInvalidRemoteClusterTokenError() *model.AppError {
	err := model.NewAppError("Context", "api.context.remote_id_invalid.app_error", nil, "", http.StatusUnauthorized)
	return err
}

func NewJSONEncodingError() *model.AppError {
	err := model.NewAppError("Context", "api.context.json_encoding.app_error", nil, "", http.StatusInternalServerError)
	return err
}

func (c *Context) SetPermissionError(permissions ...*model.Permission) {
	c.Err = c.App.MakePermissionError(permissions)
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

	if c.Params.UserId == model.ME {
		c.Params.UserId = c.App.Session().UserId
	}

	if !model.IsValidId(c.Params.UserId) {
		c.SetInvalidUrlParam("user_id")
	}
	return c
}

func (c *Context) RequireTeamId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.TeamId) {
		c.SetInvalidUrlParam("team_id")
	}
	return c
}

func (c *Context) RequireCategoryId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidCategoryId(c.Params.CategoryId) {
		c.SetInvalidUrlParam("category_id")
	}
	return c
}

func (c *Context) RequireInviteId() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params.InviteId == "" {
		c.SetInvalidUrlParam("invite_id")
	}
	return c
}

func (c *Context) RequireTokenId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.TokenId) {
		c.SetInvalidUrlParam("token_id")
	}
	return c
}

func (c *Context) RequireThreadId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.ThreadId) {
		c.SetInvalidUrlParam("thread_id")
	}
	return c
}

func (c *Context) RequireTimestamp() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params.Timestamp == 0 {
		c.SetInvalidUrlParam("timestamp")
	}
	return c
}

func (c *Context) RequireChannelId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.ChannelId) {
		c.SetInvalidUrlParam("channel_id")
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
		c.SetInvalidUrlParam("post_id")
	}
	return c
}

func (c *Context) RequireAppId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.AppId) {
		c.SetInvalidUrlParam("app_id")
	}
	return c
}

func (c *Context) RequireFileId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.FileId) {
		c.SetInvalidUrlParam("file_id")
	}

	return c
}

func (c *Context) RequireUploadId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.UploadId) {
		c.SetInvalidUrlParam("upload_id")
	}

	return c
}

func (c *Context) RequireFilename() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params.Filename == "" {
		c.SetInvalidUrlParam("filename")
	}

	return c
}

func (c *Context) RequirePluginId() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params.PluginId == "" {
		c.SetInvalidUrlParam("plugin_id")
	}

	return c
}

func (c *Context) RequireReportId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.ReportId) {
		c.SetInvalidUrlParam("report_id")
	}
	return c
}

func (c *Context) RequireEmojiId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.EmojiId) {
		c.SetInvalidUrlParam("emoji_id")
	}
	return c
}

func (c *Context) RequireTeamName() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidTeamName(c.Params.TeamName) {
		c.SetInvalidUrlParam("team_name")
	}

	return c
}

func (c *Context) RequireChannelName() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidChannelIdentifier(c.Params.ChannelName) {
		c.SetInvalidUrlParam("channel_name")
	}

	return c
}

func (c *Context) SanitizeEmail() *Context {
	if c.Err != nil {
		return c
	}
	c.Params.Email = strings.ToLower(c.Params.Email)
	if !model.IsValidEmail(c.Params.Email) {
		c.SetInvalidUrlParam("email")
	}

	return c
}

func (c *Context) RequireCategory() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidAlphaNumHyphenUnderscore(c.Params.Category, true) {
		c.SetInvalidUrlParam("category")
	}

	return c
}

func (c *Context) RequireService() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params.Service == "" {
		c.SetInvalidUrlParam("service")
	}

	return c
}

func (c *Context) RequirePreferenceName() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidAlphaNumHyphenUnderscore(c.Params.PreferenceName, true) {
		c.SetInvalidUrlParam("preference_name")
	}

	return c
}

func (c *Context) RequireEmojiName() *Context {
	if c.Err != nil {
		return c
	}

	validName := regexp.MustCompile(`^[a-zA-Z0-9\-\+_]+$`)

	if c.Params.EmojiName == "" || len(c.Params.EmojiName) > model.EMOJI_NAME_MAX_LENGTH || !validName.MatchString(c.Params.EmojiName) {
		c.SetInvalidUrlParam("emoji_name")
	}

	return c
}

func (c *Context) RequireHookId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.HookId) {
		c.SetInvalidUrlParam("hook_id")
	}

	return c
}

func (c *Context) RequireCommandId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.CommandId) {
		c.SetInvalidUrlParam("command_id")
	}
	return c
}

func (c *Context) RequireJobId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.JobId) {
		c.SetInvalidUrlParam("job_id")
	}
	return c
}

func (c *Context) RequireJobType() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params.JobType == "" || len(c.Params.JobType) > 32 {
		c.SetInvalidUrlParam("job_type")
	}
	return c
}

func (c *Context) RequireRoleId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.RoleId) {
		c.SetInvalidUrlParam("role_id")
	}
	return c
}

func (c *Context) RequireSchemeId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.SchemeId) {
		c.SetInvalidUrlParam("scheme_id")
	}
	return c
}

func (c *Context) RequireRoleName() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidRoleName(c.Params.RoleName) {
		c.SetInvalidUrlParam("role_name")
	}

	return c
}

func (c *Context) RequireGroupId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.GroupId) {
		c.SetInvalidUrlParam("group_id")
	}
	return c
}

func (c *Context) RequireRemoteId() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params.RemoteId == "" {
		c.SetInvalidUrlParam("remote_id")
	}
	return c
}

func (c *Context) RequireSyncableId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.SyncableId) {
		c.SetInvalidUrlParam("syncable_id")
	}
	return c
}

func (c *Context) RequireSyncableType() *Context {
	if c.Err != nil {
		return c
	}

	if c.Params.SyncableType != model.GroupSyncableTypeTeam && c.Params.SyncableType != model.GroupSyncableTypeChannel {
		c.SetInvalidUrlParam("syncable_type")
	}
	return c
}

func (c *Context) RequireBotUserId() *Context {
	if c.Err != nil {
		return c
	}

	if !model.IsValidId(c.Params.BotUserId) {
		c.SetInvalidUrlParam("bot_user_id")
	}
	return c
}

func (c *Context) RequireInvoiceId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.InvoiceId) != 27 {
		c.SetInvalidUrlParam("invoice_id")
	}

	return c
}

func (c *Context) GetRemoteID(r *http.Request) string {
	return r.Header.Get(model.HEADER_REMOTECLUSTER_ID)
}
