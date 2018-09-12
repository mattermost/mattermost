// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"net/http"
	"path"
	"regexp"
	"strings"

	goi18n "github.com/nicksnyder/go-i18n/i18n"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/utils"
)

type Context struct {
	App           *app.App
	Log           *mlog.Logger
	Session       model.Session
	Params        *Params
	Err           *model.AppError
	T             goi18n.TranslateFunc
	RequestId     string
	IpAddress     string
	Path          string
	siteURLHeader string
}

func (c *Context) LogAudit(extraInfo string) {
	audit := &model.Audit{UserId: c.Session.UserId, IpAddress: c.IpAddress, Action: c.Path, ExtraInfo: extraInfo, SessionId: c.Session.Id}
	if r := <-c.App.Srv.Store.Audit().Save(audit); r.Err != nil {
		c.LogError(r.Err)
	}
}

func (c *Context) LogAuditWithUserId(userId, extraInfo string) {

	if len(c.Session.UserId) > 0 {
		extraInfo = strings.TrimSpace(extraInfo + " session_user=" + c.Session.UserId)
	}

	audit := &model.Audit{UserId: userId, IpAddress: c.IpAddress, Action: c.Path, ExtraInfo: extraInfo, SessionId: c.Session.Id}
	if r := <-c.App.Srv.Store.Audit().Save(audit); r.Err != nil {
		c.LogError(r.Err)
	}
}

func (c *Context) LogError(err *model.AppError) {
	// Filter out 404s, endless reconnects and browser compatibility errors
	if err.StatusCode == http.StatusNotFound ||
		(c.Path == "/api/v3/users/websocket" && err.StatusCode == http.StatusUnauthorized) ||
		err.Id == "web.check_browser_compatibility.app_error" {
		c.LogDebug(err)
	} else {
		c.Log.Error(
			err.SystemMessage(utils.TDefault),
			mlog.String("err_where", err.Where),
			mlog.Int("http_code", err.StatusCode),
			mlog.String("err_details", err.DetailedError),
		)
	}
}

func (c *Context) LogInfo(err *model.AppError) {
	// Filter out 401s
	if err.StatusCode == http.StatusUnauthorized {
		c.LogDebug(err)
	} else {
		c.Log.Info(
			err.SystemMessage(utils.TDefault),
			mlog.String("err_where", err.Where),
			mlog.Int("http_code", err.StatusCode),
			mlog.String("err_details", err.DetailedError),
		)
	}
}

func (c *Context) LogDebug(err *model.AppError) {
	c.Log.Debug(
		err.SystemMessage(utils.TDefault),
		mlog.String("err_where", err.Where),
		mlog.Int("http_code", err.StatusCode),
		mlog.String("err_details", err.DetailedError),
	)
}

func (c *Context) IsSystemAdmin() bool {
	return c.App.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM)
}

func (c *Context) SessionRequired() {
	if !*c.App.Config().ServiceSettings.EnableUserAccessTokens && c.Session.Props[model.SESSION_PROP_TYPE] == model.SESSION_TYPE_USER_ACCESS_TOKEN {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "UserAccessToken", http.StatusUnauthorized)
		return
	}

	if len(c.Session.UserId) == 0 {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "UserRequired", http.StatusUnauthorized)
		return
	}
}

func (c *Context) MfaRequired() {
	// Must be licensed for MFA and have it configured for enforcement
	if license := c.App.License(); license == nil || !*license.Features.MFA || !*c.App.Config().ServiceSettings.EnableMultifactorAuthentication || !*c.App.Config().ServiceSettings.EnforceMultifactorAuthentication {
		return
	}

	// OAuth integrations are excepted
	if c.Session.IsOAuth {
		return
	}

	if user, err := c.App.GetUser(c.Session.UserId); err != nil {
		c.Err = model.NewAppError("", "api.context.session_expired.app_error", nil, "MfaRequired", http.StatusUnauthorized)
		return
	} else {
		// Only required for email and ldap accounts
		if user.AuthService != "" &&
			user.AuthService != model.USER_AUTH_SERVICE_EMAIL &&
			user.AuthService != model.USER_AUTH_SERVICE_LDAP {
			return
		}

		// Special case to let user get themself
		subpath, _ := utils.GetSubpathFromConfig(c.App.Config())
		if c.Path == path.Join(subpath, "/api/v4/users/me") {
			return
		}

		if !user.MfaActive {
			c.Err = model.NewAppError("", "api.context.mfa_required.app_error", nil, "MfaRequired", http.StatusForbidden)
			return
		}
	}
}

func (c *Context) RemoveSessionCookie(w http.ResponseWriter, r *http.Request) {
	cookie := &http.Cookie{
		Name:     model.SESSION_COOKIE_TOKEN,
		Value:    "",
		Path:     "/",
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

func (c *Context) HandleEtag(etag string, routeName string, w http.ResponseWriter, r *http.Request) bool {
	metrics := c.App.Metrics
	if et := r.Header.Get(model.HEADER_ETAG_CLIENT); len(etag) > 0 {
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

func (c *Context) SetPermissionError(permission *model.Permission) {
	c.Err = model.NewAppError("Permissions", "api.context.permissions.app_error", nil, "userId="+c.Session.UserId+", "+"permission="+permission.Id, http.StatusForbidden)
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
		c.Params.UserId = c.Session.UserId
	}

	if len(c.Params.UserId) != 26 {
		c.SetInvalidUrlParam("user_id")
	}
	return c
}

func (c *Context) RequireTeamId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.TeamId) != 26 {
		c.SetInvalidUrlParam("team_id")
	}
	return c
}

func (c *Context) RequireInviteId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.InviteId) == 0 {
		c.SetInvalidUrlParam("invite_id")
	}
	return c
}

func (c *Context) RequireTokenId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.TokenId) != 26 {
		c.SetInvalidUrlParam("token_id")
	}
	return c
}

func (c *Context) RequireChannelId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.ChannelId) != 26 {
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

	if len(c.Params.PostId) != 26 {
		c.SetInvalidUrlParam("post_id")
	}
	return c
}

func (c *Context) RequireAppId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.AppId) != 26 {
		c.SetInvalidUrlParam("app_id")
	}
	return c
}

func (c *Context) RequireFileId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.FileId) != 26 {
		c.SetInvalidUrlParam("file_id")
	}

	return c
}

func (c *Context) RequireFilename() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.Filename) == 0 {
		c.SetInvalidUrlParam("filename")
	}

	return c
}

func (c *Context) RequirePluginId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.PluginId) == 0 {
		c.SetInvalidUrlParam("plugin_id")
	}

	return c
}

func (c *Context) RequireReportId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.ReportId) != 26 {
		c.SetInvalidUrlParam("report_id")
	}
	return c
}

func (c *Context) RequireEmojiId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.EmojiId) != 26 {
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

func (c *Context) RequireEmail() *Context {
	if c.Err != nil {
		return c
	}

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

	if len(c.Params.Service) == 0 {
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

	if len(c.Params.EmojiName) == 0 || len(c.Params.EmojiName) > model.EMOJI_NAME_MAX_LENGTH || !validName.MatchString(c.Params.EmojiName) {
		c.SetInvalidUrlParam("emoji_name")
	}

	return c
}

func (c *Context) RequireHookId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.HookId) != 26 {
		c.SetInvalidUrlParam("hook_id")
	}

	return c
}

func (c *Context) RequireCommandId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.CommandId) != 26 {
		c.SetInvalidUrlParam("command_id")
	}
	return c
}

func (c *Context) RequireJobId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.JobId) != 26 {
		c.SetInvalidUrlParam("job_id")
	}
	return c
}

func (c *Context) RequireJobType() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.JobType) == 0 || len(c.Params.JobType) > 32 {
		c.SetInvalidUrlParam("job_type")
	}
	return c
}

func (c *Context) RequireActionId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.ActionId) != 26 {
		c.SetInvalidUrlParam("action_id")
	}
	return c
}

func (c *Context) RequireRoleId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.RoleId) != 26 {
		c.SetInvalidUrlParam("role_id")
	}
	return c
}

func (c *Context) RequireSchemeId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.SchemeId) != 26 {
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

func (c *Context) ToPluginContext() *plugin.Context {
	return &plugin.Context{
		//sessionId: c.Session.Id,
		//requestId: c.RequestId,
		//userIp: c.IpAddress,
	}
}

func (c *Context) RequireGroupId() *Context {
	if c.Err != nil {
		return c
	}

	if len(c.Params.GroupId) != 26 {
		c.SetInvalidUrlParam("group_id")
	}
	return c
}
