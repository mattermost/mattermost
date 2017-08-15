// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"html/template"
	"net/url"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func SendChangeUsernameEmail(oldUsername, newUsername, email, locale, siteURL string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	subject := T("api.templates.username_change_subject",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"],
			"TeamDisplayName": utils.Cfg.TeamSettings.SiteName})

	bodyPage := utils.NewHTMLTemplate("email_change_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.username_change_body.title")
	bodyPage.Html["Info"] = template.HTML(T("api.templates.username_change_body.info",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName, "NewUsername": newUsername}))

	if err := utils.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewLocAppError("SendChangeUsernameEmail", "api.user.send_email_change_username_and_forget.error", nil, err.Error())
	}

	return nil
}

func SendEmailChangeVerifyEmail(newUserEmail, locale, siteURL, token string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	link := fmt.Sprintf("%s/do_verify_email?token=%s&email=%s", siteURL, token, url.QueryEscape(newUserEmail))

	subject := T("api.templates.email_change_verify_subject",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"],
			"TeamDisplayName": utils.Cfg.TeamSettings.SiteName})

	bodyPage := utils.NewHTMLTemplate("email_change_verify_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.email_change_verify_body.title")
	bodyPage.Props["Info"] = T("api.templates.email_change_verify_body.info",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName})
	bodyPage.Props["VerifyUrl"] = link
	bodyPage.Props["VerifyButton"] = T("api.templates.email_change_verify_body.button")

	if err := utils.SendMail(newUserEmail, subject, bodyPage.Render()); err != nil {
		return model.NewLocAppError("SendEmailChangeVerifyEmail", "api.user.send_email_change_verify_email_and_forget.error", nil, err.Error())
	}

	return nil
}

func SendEmailChangeEmail(oldEmail, newEmail, locale, siteURL string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	subject := T("api.templates.email_change_subject",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"],
			"TeamDisplayName": utils.Cfg.TeamSettings.SiteName})

	bodyPage := utils.NewHTMLTemplate("email_change_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.email_change_body.title")
	bodyPage.Html["Info"] = template.HTML(T("api.templates.email_change_body.info",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName, "NewEmail": newEmail}))

	if err := utils.SendMail(oldEmail, subject, bodyPage.Render()); err != nil {
		return model.NewLocAppError("SendEmailChangeEmail", "api.user.send_email_change_email_and_forget.error", nil, err.Error())
	}

	return nil
}

func SendVerifyEmail(userEmail, locale, siteURL, token string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	link := fmt.Sprintf("%s/do_verify_email?token=%s&email=%s", siteURL, token, url.QueryEscape(userEmail))

	url, _ := url.Parse(siteURL)

	subject := T("api.templates.verify_subject",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"]})

	bodyPage := utils.NewHTMLTemplate("verify_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.verify_body.title", map[string]interface{}{"ServerURL": url.Host})
	bodyPage.Props["Info"] = T("api.templates.verify_body.info")
	bodyPage.Props["VerifyUrl"] = link
	bodyPage.Props["Button"] = T("api.templates.verify_body.button")

	if err := utils.SendMail(userEmail, subject, bodyPage.Render()); err != nil {
		return model.NewLocAppError("SendVerifyEmail", "api.user.send_verify_email_and_forget.failed.error", nil, err.Error())
	}

	return nil
}

func SendSignInChangeEmail(email, method, locale, siteURL string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	subject := T("api.templates.signin_change_email.subject",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"]})

	bodyPage := utils.NewHTMLTemplate("signin_change_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.signin_change_email.body.title")
	bodyPage.Html["Info"] = template.HTML(T("api.templates.signin_change_email.body.info",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"], "Method": method}))

	if err := utils.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewLocAppError("SendSignInChangeEmail", "api.user.send_sign_in_change_email_and_forget.error", nil, err.Error())
	}

	return nil
}

func SendWelcomeEmail(userId string, email string, verified bool, locale, siteURL string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	rawUrl, _ := url.Parse(siteURL)

	subject := T("api.templates.welcome_subject",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"],
			"ServerURL": rawUrl.Host})

	bodyPage := utils.NewHTMLTemplate("welcome_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.welcome_body.title", map[string]interface{}{"ServerURL": rawUrl.Host})
	bodyPage.Props["Info"] = T("api.templates.welcome_body.info")
	bodyPage.Props["Button"] = T("api.templates.welcome_body.button")
	bodyPage.Props["Info2"] = T("api.templates.welcome_body.info2")
	bodyPage.Props["Info3"] = T("api.templates.welcome_body.info3")
	bodyPage.Props["SiteURL"] = siteURL

	if *utils.Cfg.NativeAppSettings.AppDownloadLink != "" {
		bodyPage.Props["AppDownloadInfo"] = T("api.templates.welcome_body.app_download_info")
		bodyPage.Props["AppDownloadLink"] = *utils.Cfg.NativeAppSettings.AppDownloadLink
	}

	if !verified {
		token, err := CreateVerifyEmailToken(userId)
		if err != nil {
			return err
		}
		link := fmt.Sprintf("%s/do_verify_email?token=%s&email=%s", siteURL, token.Token, url.QueryEscape(email))
		bodyPage.Props["VerifyUrl"] = link
	}

	if err := utils.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewLocAppError("SendWelcomeEmail", "api.user.send_welcome_email_and_forget.failed.error", nil, err.Error())
	}

	return nil
}

func SendPasswordChangeEmail(email, method, locale, siteURL string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	subject := T("api.templates.password_change_subject",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"],
			"TeamDisplayName": utils.Cfg.TeamSettings.SiteName})

	bodyPage := utils.NewHTMLTemplate("password_change_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.password_change_body.title")
	bodyPage.Html["Info"] = template.HTML(T("api.templates.password_change_body.info",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName, "TeamURL": siteURL, "Method": method}))

	if err := utils.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewLocAppError("SendPasswordChangeEmail", "api.user.send_password_change_email_and_forget.error", nil, err.Error())
	}

	return nil
}

func SendUserAccessTokenAddedEmail(email, locale string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	subject := T("api.templates.user_access_token_subject",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"]})

	bodyPage := utils.NewHTMLTemplate("password_change_body", locale)
	bodyPage.Props["Title"] = T("api.templates.user_access_token_body.title")
	bodyPage.Html["Info"] = template.HTML(T("api.templates.user_access_token_body.info",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"], "SiteURL": utils.GetSiteURL()}))

	if err := utils.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewLocAppError("SendUserAccessTokenAddedEmail", "api.user.send_user_access_token.error", nil, err.Error())
	}

	return nil
}

func SendPasswordResetEmail(email string, token *model.Token, locale, siteURL string) (bool, *model.AppError) {

	T := utils.GetUserTranslations(locale)

	link := fmt.Sprintf("%s/reset_password_complete?token=%s", siteURL, url.QueryEscape(token.Token))

	subject := T("api.templates.reset_subject",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"]})

	bodyPage := utils.NewHTMLTemplate("reset_body", locale)
	bodyPage.Props["SiteURL"] = siteURL
	bodyPage.Props["Title"] = T("api.templates.reset_body.title")
	bodyPage.Html["Info"] = template.HTML(T("api.templates.reset_body.info"))
	bodyPage.Props["ResetUrl"] = link
	bodyPage.Props["Button"] = T("api.templates.reset_body.button")

	if err := utils.SendMail(email, subject, bodyPage.Render()); err != nil {
		return false, model.NewLocAppError("SendPasswordReset", "api.user.send_password_reset.send.app_error", nil, "err="+err.Message)
	}

	return true, nil
}

func SendMfaChangeEmail(email string, activated bool, locale, siteURL string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	subject := T("api.templates.mfa_change_subject",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"]})

	bodyPage := utils.NewHTMLTemplate("mfa_change_body", locale)
	bodyPage.Props["SiteURL"] = siteURL

	bodyText := ""
	if activated {
		bodyText = "api.templates.mfa_activated_body.info"
		bodyPage.Props["Title"] = T("api.templates.mfa_activated_body.title")
	} else {
		bodyText = "api.templates.mfa_deactivated_body.info"
		bodyPage.Props["Title"] = T("api.templates.mfa_deactivated_body.title")
	}

	bodyPage.Html["Info"] = template.HTML(T(bodyText,
		map[string]interface{}{"SiteURL": siteURL}))

	if err := utils.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewLocAppError("SendMfaChangeEmail", "api.user.send_mfa_change_email.error", nil, err.Error())
	}

	return nil
}

func SendInviteEmails(team *model.Team, senderName string, invites []string, siteURL string) {
	for _, invite := range invites {
		if len(invite) > 0 {
			senderRole := utils.T("api.team.invite_members.member")

			subject := utils.T("api.templates.invite_subject",
				map[string]interface{}{"SenderName": senderName,
					"TeamDisplayName": team.DisplayName,
					"SiteName":        utils.ClientCfg["SiteName"]})

			bodyPage := utils.NewHTMLTemplate("invite_body", model.DEFAULT_LOCALE)
			bodyPage.Props["SiteURL"] = siteURL
			bodyPage.Props["Title"] = utils.T("api.templates.invite_body.title")
			bodyPage.Html["Info"] = template.HTML(utils.T("api.templates.invite_body.info",
				map[string]interface{}{"SenderStatus": senderRole, "SenderName": senderName, "TeamDisplayName": team.DisplayName}))
			bodyPage.Props["Button"] = utils.T("api.templates.invite_body.button")
			bodyPage.Html["ExtraInfo"] = template.HTML(utils.T("api.templates.invite_body.extra_info",
				map[string]interface{}{"TeamDisplayName": team.DisplayName, "TeamURL": siteURL + "/" + team.Name}))

			props := make(map[string]string)
			props["email"] = invite
			props["id"] = team.Id
			props["display_name"] = team.DisplayName
			props["name"] = team.Name
			props["time"] = fmt.Sprintf("%v", model.GetMillis())
			data := model.MapToJson(props)
			hash := utils.HashSha256(fmt.Sprintf("%v:%v", data, utils.Cfg.EmailSettings.InviteSalt))
			bodyPage.Props["Link"] = fmt.Sprintf("%s/signup_user_complete/?d=%s&h=%s", siteURL, url.QueryEscape(data), url.QueryEscape(hash))

			if !utils.Cfg.EmailSettings.SendEmailNotifications {
				l4g.Info(utils.T("api.team.invite_members.sending.info"), invite, bodyPage.Props["Link"])
			}

			if err := utils.SendMail(invite, subject, bodyPage.Render()); err != nil {
				l4g.Error(utils.T("api.team.invite_members.send.error"), err)
			}
		}
	}
}
