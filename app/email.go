// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"io"
	"net/url"
	"path"
	"strings"

	"net/http"

	"github.com/mattermost/go-i18n/i18n"
	"github.com/pkg/errors"
	"github.com/throttled/throttled"
	"github.com/throttled/throttled/store/memstore"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/mailservice"
	"github.com/mattermost/mattermost-server/v5/utils"
)

const (
	emailRateLimitingMemstoreSize = 65536
	emailRateLimitingPerHour      = 20
	emailRateLimitingMaxBurst     = 20
)

func condenseSiteURL(siteURL string) string {
	parsedSiteURL, _ := url.Parse(siteURL)
	if parsedSiteURL.Path == "" || parsedSiteURL.Path == "/" {
		return parsedSiteURL.Host
	}

	return path.Join(parsedSiteURL.Host, parsedSiteURL.Path)
}

func (a *App) SetupInviteEmailRateLimiting() error {
	store, err := memstore.New(emailRateLimitingMemstoreSize)
	if err != nil {
		return errors.Wrap(err, "Unable to setup email rate limiting memstore.")
	}

	quota := throttled.RateQuota{
		MaxRate:  throttled.PerHour(emailRateLimitingPerHour),
		MaxBurst: emailRateLimitingMaxBurst,
	}

	rateLimiter, err := throttled.NewGCRARateLimiter(store, quota)
	if err != nil || rateLimiter == nil {
		return errors.Wrap(err, "Unable to setup email rate limiting GCRA rate limiter.")
	}

	a.Srv.EmailRateLimiter = rateLimiter
	return nil
}

func (a *App) SendChangeUsernameEmail(oldUsername, newUsername, email, locale, siteURL string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	subject := T("api.templates.username_change_subject",
		map[string]interface{}{"SiteName": a.ClientConfig()["SiteName"],
			"TeamDisplayName": a.Config().TeamSettings.SiteName})

	bodyPage := a.NewEmailTemplate("email_change_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.username_change_body.title")
	bodyPage.Props["Info"] = T("api.templates.username_change_body.info",
		map[string]interface{}{"TeamDisplayName": a.Config().TeamSettings.SiteName, "NewUsername": newUsername})
	bodyPage.Props["Warning"] = T("api.templates.email_warning")

	if err := a.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewAppError("SendChangeUsernameEmail", "api.user.send_email_change_username_and_forget.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) SendEmailChangeVerifyEmail(newUserEmail, locale, siteURL, token string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	link := fmt.Sprintf("%s/do_verify_email?token=%s&email=%s", siteURL, token, url.QueryEscape(newUserEmail))

	subject := T("api.templates.email_change_verify_subject",
		map[string]interface{}{"SiteName": a.ClientConfig()["SiteName"],
			"TeamDisplayName": a.Config().TeamSettings.SiteName})

	bodyPage := a.NewEmailTemplate("email_change_verify_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.email_change_verify_body.title")
	bodyPage.Props["Info"] = T("api.templates.email_change_verify_body.info",
		map[string]interface{}{"TeamDisplayName": a.Config().TeamSettings.SiteName})
	bodyPage.Props["VerifyUrl"] = link
	bodyPage.Props["VerifyButton"] = T("api.templates.email_change_verify_body.button")

	if err := a.SendMail(newUserEmail, subject, bodyPage.Render()); err != nil {
		return model.NewAppError("SendEmailChangeVerifyEmail", "api.user.send_email_change_verify_email_and_forget.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) SendEmailChangeEmail(oldEmail, newEmail, locale, siteURL string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	subject := T("api.templates.email_change_subject",
		map[string]interface{}{"SiteName": a.ClientConfig()["SiteName"],
			"TeamDisplayName": a.Config().TeamSettings.SiteName})

	bodyPage := a.NewEmailTemplate("email_change_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.email_change_body.title")
	bodyPage.Props["Info"] = T("api.templates.email_change_body.info",
		map[string]interface{}{"TeamDisplayName": a.Config().TeamSettings.SiteName, "NewEmail": newEmail})
	bodyPage.Props["Warning"] = T("api.templates.email_warning")

	if err := a.SendMail(oldEmail, subject, bodyPage.Render()); err != nil {
		return model.NewAppError("SendEmailChangeEmail", "api.user.send_email_change_email_and_forget.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) SendVerifyEmail(userEmail, locale, siteURL, token string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	link := fmt.Sprintf("%s/do_verify_email?token=%s&email=%s", siteURL, token, url.QueryEscape(userEmail))

	serverURL := condenseSiteURL(siteURL)

	subject := T("api.templates.verify_subject",
		map[string]interface{}{"SiteName": a.ClientConfig()["SiteName"]})

	bodyPage := a.NewEmailTemplate("verify_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.verify_body.title", map[string]interface{}{"ServerURL": serverURL})
	bodyPage.Props["Info"] = T("api.templates.verify_body.info")
	bodyPage.Props["VerifyUrl"] = link
	bodyPage.Props["Button"] = T("api.templates.verify_body.button")

	if err := a.SendMail(userEmail, subject, bodyPage.Render()); err != nil {
		return model.NewAppError("SendVerifyEmail", "api.user.send_verify_email_and_forget.failed.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) SendSignInChangeEmail(email, method, locale, siteURL string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	subject := T("api.templates.signin_change_email.subject",
		map[string]interface{}{"SiteName": a.ClientConfig()["SiteName"]})

	bodyPage := a.NewEmailTemplate("signin_change_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.signin_change_email.body.title")
	bodyPage.Props["Info"] = T("api.templates.signin_change_email.body.info",
		map[string]interface{}{"SiteName": a.ClientConfig()["SiteName"], "Method": method})
	bodyPage.Props["Warning"] = T("api.templates.email_warning")

	if err := a.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewAppError("SendSignInChangeEmail", "api.user.send_sign_in_change_email_and_forget.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) SendWelcomeEmail(userId string, email string, verified bool, locale, siteURL string) *model.AppError {
	if !*a.Config().EmailSettings.SendEmailNotifications && !*a.Config().EmailSettings.RequireEmailVerification {
		return model.NewAppError("SendWelcomeEmail", "api.user.send_welcome_email_and_forget.failed.error", nil, "Send Email Notifications and Require Email Verification is disabled in the system console", http.StatusInternalServerError)
	}

	T := utils.GetUserTranslations(locale)

	serverURL := condenseSiteURL(siteURL)

	subject := T("api.templates.welcome_subject",
		map[string]interface{}{"SiteName": a.ClientConfig()["SiteName"],
			"ServerURL": serverURL})

	bodyPage := a.NewEmailTemplate("welcome_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.welcome_body.title", map[string]interface{}{"ServerURL": serverURL})
	bodyPage.Props["Info"] = T("api.templates.welcome_body.info")
	bodyPage.Props["Button"] = T("api.templates.welcome_body.button")
	bodyPage.Props["Info2"] = T("api.templates.welcome_body.info2")
	bodyPage.Props["Info3"] = T("api.templates.welcome_body.info3")
	bodyPage.Props["SiteURL"] = siteURL

	if *a.Config().NativeAppSettings.AppDownloadLink != "" {
		bodyPage.Props["AppDownloadInfo"] = T("api.templates.welcome_body.app_download_info")
		bodyPage.Props["AppDownloadLink"] = *a.Config().NativeAppSettings.AppDownloadLink
	}

	if !verified && *a.Config().EmailSettings.RequireEmailVerification {
		token, err := a.CreateVerifyEmailToken(userId, email)
		if err != nil {
			return err
		}
		link := fmt.Sprintf("%s/do_verify_email?token=%s&email=%s", siteURL, token.Token, url.QueryEscape(email))
		bodyPage.Props["VerifyUrl"] = link
	}

	if err := a.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewAppError("SendWelcomeEmail", "api.user.send_welcome_email_and_forget.failed.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) SendPasswordChangeEmail(email, method, locale, siteURL string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	subject := T("api.templates.password_change_subject",
		map[string]interface{}{"SiteName": a.ClientConfig()["SiteName"],
			"TeamDisplayName": a.Config().TeamSettings.SiteName})

	bodyPage := a.NewEmailTemplate("password_change_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.password_change_body.title")
	bodyPage.Props["Info"] = T("api.templates.password_change_body.info",
		map[string]interface{}{"TeamDisplayName": a.Config().TeamSettings.SiteName, "TeamURL": siteURL, "Method": method})
	bodyPage.Props["Warning"] = T("api.templates.email_warning")

	if err := a.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewAppError("SendPasswordChangeEmail", "api.user.send_password_change_email_and_forget.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) SendUserAccessTokenAddedEmail(email, locale, siteURL string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	subject := T("api.templates.user_access_token_subject",
		map[string]interface{}{"SiteName": a.ClientConfig()["SiteName"]})

	bodyPage := a.NewEmailTemplate("password_change_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.user_access_token_body.title")
	bodyPage.Props["Info"] = T("api.templates.user_access_token_body.info",
		map[string]interface{}{"SiteName": a.ClientConfig()["SiteName"], "SiteURL": siteURL})
	bodyPage.Props["Warning"] = T("api.templates.email_warning")

	if err := a.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewAppError("SendUserAccessTokenAddedEmail", "api.user.send_user_access_token.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) SendPasswordResetEmail(email string, token *model.Token, locale, siteURL string) (bool, *model.AppError) {
	T := utils.GetUserTranslations(locale)

	link := fmt.Sprintf("%s/reset_password_complete?token=%s", siteURL, url.QueryEscape(token.Token))

	subject := T("api.templates.reset_subject",
		map[string]interface{}{"SiteName": a.ClientConfig()["SiteName"]})

	bodyPage := a.NewEmailTemplate("reset_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.reset_body.title")
	bodyPage.Props["Info1"] = utils.TranslateAsHtml(T, "api.templates.reset_body.info1", nil)
	bodyPage.Props["Info2"] = T("api.templates.reset_body.info2")
	bodyPage.Props["ResetUrl"] = link
	bodyPage.Props["Button"] = T("api.templates.reset_body.button")

	if err := a.SendMail(email, subject, bodyPage.Render()); err != nil {
		return false, model.NewAppError("SendPasswordReset", "api.user.send_password_reset.send.app_error", nil, "err="+err.Message, http.StatusInternalServerError)
	}

	return true, nil
}

func (a *App) SendMfaChangeEmail(email string, activated bool, locale, siteURL string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	subject := T("api.templates.mfa_change_subject",
		map[string]interface{}{"SiteName": a.ClientConfig()["SiteName"]})

	bodyPage := a.NewEmailTemplate("mfa_change_body", locale)
	bodyPage.Props["SiteURL"] = siteURL

	if activated {
		bodyPage.Props["Info"] = T("api.templates.mfa_activated_body.info", map[string]interface{}{"SiteURL": siteURL})
		bodyPage.Props["Title"] = T("api.templates.mfa_activated_body.title")
	} else {
		bodyPage.Props["Info"] = T("api.templates.mfa_deactivated_body.info", map[string]interface{}{"SiteURL": siteURL})
		bodyPage.Props["Title"] = T("api.templates.mfa_deactivated_body.title")
	}
	bodyPage.Props["Warning"] = T("api.templates.email_warning")

	if err := a.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewAppError("SendMfaChangeEmail", "api.user.send_mfa_change_email.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) SendInviteEmails(team *model.Team, senderName string, senderUserId string, invites []string, siteURL string) {
	if a.Srv.EmailRateLimiter == nil {
		a.Log.Error("Email invite not sent, rate limiting could not be setup.", mlog.String("user_id", senderUserId), mlog.String("team_id", team.Id))
		return
	}
	rateLimited, result, err := a.Srv.EmailRateLimiter.RateLimit(senderUserId, len(invites))
	if err != nil {
		a.Log.Error("Error rate limiting invite email.", mlog.String("user_id", senderUserId), mlog.String("team_id", team.Id), mlog.Err(err))
		return
	}

	if rateLimited {
		a.Log.Error("Invite emails rate limited.",
			mlog.String("user_id", senderUserId),
			mlog.String("team_id", team.Id),
			mlog.String("retry_after", result.RetryAfter.String()),
			mlog.Err(err))
		return
	}

	for _, invite := range invites {
		if len(invite) > 0 {
			subject := utils.T("api.templates.invite_subject",
				map[string]interface{}{"SenderName": senderName,
					"TeamDisplayName": team.DisplayName,
					"SiteName":        a.ClientConfig()["SiteName"]})

			bodyPage := a.NewEmailTemplate("invite_body", model.DEFAULT_LOCALE)
			bodyPage.Props["SiteURL"] = siteURL
			bodyPage.Props["Title"] = utils.T("api.templates.invite_body.title")
			bodyPage.Html["Info"] = utils.TranslateAsHtml(utils.T, "api.templates.invite_body.info",
				map[string]interface{}{"SenderName": senderName, "TeamDisplayName": team.DisplayName})
			bodyPage.Props["Button"] = utils.T("api.templates.invite_body.button")
			bodyPage.Html["ExtraInfo"] = utils.TranslateAsHtml(utils.T, "api.templates.invite_body.extra_info",
				map[string]interface{}{"TeamDisplayName": team.DisplayName})
			bodyPage.Props["TeamURL"] = siteURL + "/" + team.Name

			token := model.NewToken(
				TOKEN_TYPE_TEAM_INVITATION,
				model.MapToJson(map[string]string{"teamId": team.Id, "email": invite}),
			)

			props := make(map[string]string)
			props["email"] = invite
			props["display_name"] = team.DisplayName
			props["name"] = team.Name
			data := model.MapToJson(props)

			if err := a.Srv.Store.Token().Save(token); err != nil {
				mlog.Error("Failed to send invite email successfully ", mlog.Err(err))
				continue
			}
			bodyPage.Props["Link"] = fmt.Sprintf("%s/signup_user_complete/?d=%s&t=%s", siteURL, url.QueryEscape(data), url.QueryEscape(token.Token))

			if err := a.SendMail(invite, subject, bodyPage.Render()); err != nil {
				mlog.Error("Failed to send invite email successfully ", mlog.Err(err))
			}
		}
	}
}

func (a *App) SendGuestInviteEmails(team *model.Team, channels []*model.Channel, senderName string, senderUserId string, invites []string, siteURL string, message string) {
	if a.Srv.EmailRateLimiter == nil {
		a.Log.Error("Email invite not sent, rate limiting could not be setup.", mlog.String("user_id", senderUserId), mlog.String("team_id", team.Id))
		return
	}
	rateLimited, result, err := a.Srv.EmailRateLimiter.RateLimit(senderUserId, len(invites))
	if err != nil {
		a.Log.Error("Error rate limiting invite email.", mlog.String("user_id", senderUserId), mlog.String("team_id", team.Id), mlog.Err(err))
		return
	}

	sender, appErr := a.GetUser(senderUserId)
	if appErr != nil {
		a.Log.Error("Email invite not sent, unable to find the sender user.", mlog.String("user_id", senderUserId), mlog.String("team_id", team.Id), mlog.Err(appErr))
		return
	}

	senderProfileImage, _, appErr := a.GetProfileImage(sender)
	if appErr != nil {
		a.Log.Warn("Unable to get the sender user profile image.", mlog.String("user_id", senderUserId), mlog.String("team_id", team.Id), mlog.Err(appErr))
	}

	if rateLimited {
		a.Log.Error("Invite emails rate limited.",
			mlog.String("user_id", senderUserId),
			mlog.String("team_id", team.Id),
			mlog.String("retry_after", result.RetryAfter.String()),
			mlog.Err(err))
		return
	}

	for _, invite := range invites {
		if len(invite) > 0 {
			subject := utils.T("api.templates.invite_guest_subject",
				map[string]interface{}{"SenderName": senderName,
					"TeamDisplayName": team.DisplayName,
					"SiteName":        a.ClientConfig()["SiteName"]})

			bodyPage := a.NewEmailTemplate("invite_body", model.DEFAULT_LOCALE)
			bodyPage.Props["SiteURL"] = siteURL
			bodyPage.Props["Title"] = utils.T("api.templates.invite_body.title")
			bodyPage.Html["Info"] = utils.TranslateAsHtml(utils.T, "api.templates.invite_body_guest.info",
				map[string]interface{}{"SenderName": senderName, "TeamDisplayName": team.DisplayName})
			bodyPage.Props["Button"] = utils.T("api.templates.invite_body.button")
			bodyPage.Props["SenderName"] = senderName
			bodyPage.Props["SenderId"] = senderUserId
			bodyPage.Props["Message"] = ""
			if message != "" {
				bodyPage.Props["Message"] = message
			}
			bodyPage.Html["ExtraInfo"] = utils.TranslateAsHtml(utils.T, "api.templates.invite_body.extra_info",
				map[string]interface{}{"TeamDisplayName": team.DisplayName})
			bodyPage.Props["TeamURL"] = siteURL + "/" + team.Name

			channelIds := []string{}
			for _, channel := range channels {
				channelIds = append(channelIds, channel.Id)
			}

			token := model.NewToken(
				TOKEN_TYPE_GUEST_INVITATION,
				model.MapToJson(map[string]string{
					"teamId":   team.Id,
					"channels": strings.Join(channelIds, " "),
					"email":    invite,
					"guest":    "true",
				}),
			)

			props := make(map[string]string)
			props["email"] = invite
			props["display_name"] = team.DisplayName
			props["name"] = team.Name
			data := model.MapToJson(props)

			if err := a.Srv.Store.Token().Save(token); err != nil {
				mlog.Error("Failed to send invite email successfully ", mlog.Err(err))
				continue
			}
			bodyPage.Props["Link"] = fmt.Sprintf("%s/signup_user_complete/?d=%s&t=%s", siteURL, url.QueryEscape(data), url.QueryEscape(token.Token))

			if !*a.Config().EmailSettings.SendEmailNotifications {
				mlog.Info("sending invitation ", mlog.String("to", invite), mlog.String("link", bodyPage.Props["Link"].(string)))
			}

			embeddedFiles := make(map[string]io.Reader)
			if message != "" {
				if senderProfileImage != nil {
					embeddedFiles = map[string]io.Reader{
						"user-avatar.png": bytes.NewReader(senderProfileImage),
					}
				}
			}

			if err := a.SendMailWithEmbeddedFiles(invite, subject, bodyPage.Render(), embeddedFiles); err != nil {
				mlog.Error("Failed to send invite email successfully", mlog.Err(err))
			}
		}
	}
}

func (a *App) NewEmailTemplate(name, locale string) *utils.HTMLTemplate {
	t := utils.NewHTMLTemplate(a.HTMLTemplates(), name)

	var localT i18n.TranslateFunc
	if locale != "" {
		localT = utils.GetUserTranslations(locale)
	} else {
		localT = utils.T
	}

	t.Props["Footer"] = localT("api.templates.email_footer")

	if *a.Config().EmailSettings.FeedbackOrganization != "" {
		t.Props["Organization"] = localT("api.templates.email_organization") + *a.Config().EmailSettings.FeedbackOrganization
	} else {
		t.Props["Organization"] = ""
	}

	t.Props["EmailInfo1"] = localT("api.templates.email_info1")
	t.Props["EmailInfo2"] = localT("api.templates.email_info2")
	t.Props["EmailInfo3"] = localT("api.templates.email_info3",
		map[string]interface{}{"SiteName": a.Config().TeamSettings.SiteName})
	t.Props["SupportEmail"] = *a.Config().SupportSettings.SupportEmail

	return t
}

func (a *App) SendDeactivateAccountEmail(email string, locale, siteURL string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	serverURL := condenseSiteURL(siteURL)

	subject := T("api.templates.deactivate_subject",
		map[string]interface{}{"SiteName": a.ClientConfig()["SiteName"],
			"ServerURL": serverURL})

	bodyPage := a.NewEmailTemplate("deactivate_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.deactivate_body.title", map[string]interface{}{"ServerURL": serverURL})
	bodyPage.Props["Info"] = T("api.templates.deactivate_body.info",
		map[string]interface{}{"SiteURL": siteURL})
	bodyPage.Props["Warning"] = T("api.templates.deactivate_body.warning")

	if err := a.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewAppError("SendDeactivateEmail", "api.user.send_deactivate_email_and_forget.failed.error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}

func (a *App) SendNotificationMail(to, subject, htmlBody string) *model.AppError {
	if !*a.Config().EmailSettings.SendEmailNotifications {
		return nil
	}
	return a.SendMail(to, subject, htmlBody)
}

func (a *App) SendMail(to, subject, htmlBody string) *model.AppError {
	license := a.License()
	return mailservice.SendMailUsingConfig(to, subject, htmlBody, a.Config(), license != nil && *license.Features.Compliance)
}

func (a *App) SendMailWithEmbeddedFiles(to, subject, htmlBody string, embeddedFiles map[string]io.Reader) *model.AppError {
	license := a.License()
	config := a.Config()

	return mailservice.SendMailWithEmbeddedFilesUsingConfig(to, subject, htmlBody, embeddedFiles, config, license != nil && *license.Features.Compliance)
}
