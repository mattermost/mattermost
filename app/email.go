// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"html/template"
	"net/url"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func SendChangeUsernameEmail(oldUsername, newUsername, email, locale string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	subject := fmt.Sprintf("[%v] %v", utils.Cfg.TeamSettings.SiteName, T("api.templates.username_change_subject",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName}))

	bodyPage := utils.NewHTMLTemplate("email_change_body", locale)
	bodyPage.Props["SiteURL"] = utils.GetSiteURL()
	bodyPage.Props["Title"] = T("api.templates.username_change_body.title")
	bodyPage.Html["Info"] = template.HTML(T("api.templates.username_change_body.info",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName, "NewUsername": newUsername}))

	if err := utils.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewLocAppError("SendChangeUsernameEmail", "api.user.send_email_change_username_and_forget.error", nil, err.Error())
	}

	return nil
}

func SendEmailChangeVerifyEmail(userId, newUserEmail, locale string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	link := fmt.Sprintf("%s/do_verify_email?uid=%s&hid=%s&email=%s", utils.GetSiteURL(), userId, model.HashPassword(userId+utils.Cfg.EmailSettings.InviteSalt), url.QueryEscape(newUserEmail))

	subject := fmt.Sprintf("[%v] %v", utils.Cfg.TeamSettings.SiteName, T("api.templates.email_change_verify_subject",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName}))

	bodyPage := utils.NewHTMLTemplate("email_change_verify_body", locale)
	bodyPage.Props["SiteURL"] = utils.GetSiteURL()
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

func SendEmailChangeEmail(oldEmail, newEmail, locale string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	subject := fmt.Sprintf("[%v] %v", utils.Cfg.TeamSettings.SiteName, T("api.templates.email_change_subject",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName}))

	bodyPage := utils.NewHTMLTemplate("email_change_body", locale)
	bodyPage.Props["SiteURL"] = utils.GetSiteURL()
	bodyPage.Props["Title"] = T("api.templates.email_change_body.title")
	bodyPage.Html["Info"] = template.HTML(T("api.templates.email_change_body.info",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName, "NewEmail": newEmail}))

	if err := utils.SendMail(oldEmail, subject, bodyPage.Render()); err != nil {
		return model.NewLocAppError("SendEmailChangeEmail", "api.user.send_email_change_email_and_forget.error", nil, err.Error())
	}

	return nil
}

func SendVerifyEmail(userId, userEmail, locale string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	link := fmt.Sprintf("%s/do_verify_email?uid=%s&hid=%s&email=%s", utils.GetSiteURL(), userId, model.HashPassword(userId+utils.Cfg.EmailSettings.InviteSalt), url.QueryEscape(userEmail))

	url, _ := url.Parse(utils.GetSiteURL())

	subject := T("api.templates.verify_subject",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"]})

	bodyPage := utils.NewHTMLTemplate("verify_body", locale)
	bodyPage.Props["SiteURL"] = utils.GetSiteURL()
	bodyPage.Props["Title"] = T("api.templates.verify_body.title", map[string]interface{}{"ServerURL": url.Host})
	bodyPage.Props["Info"] = T("api.templates.verify_body.info")
	bodyPage.Props["VerifyUrl"] = link
	bodyPage.Props["Button"] = T("api.templates.verify_body.button")

	if err := utils.SendMail(userEmail, subject, bodyPage.Render()); err != nil {
		return model.NewLocAppError("SendVerifyEmail", "api.user.send_verify_email_and_forget.failed.error", nil, err.Error())
	}

	return nil
}

func SendSignInChangeEmail(email, method, locale string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	subject := T("api.templates.singin_change_email.subject",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"]})

	bodyPage := utils.NewHTMLTemplate("signin_change_body", locale)
	bodyPage.Props["SiteURL"] = utils.GetSiteURL()
	bodyPage.Props["Title"] = T("api.templates.signin_change_email.body.title")
	bodyPage.Html["Info"] = template.HTML(T("api.templates.singin_change_email.body.info",
		map[string]interface{}{"SiteName": utils.ClientCfg["SiteName"], "Method": method}))

	if err := utils.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewLocAppError("SendSignInChangeEmail", "api.user.send_sign_in_change_email_and_forget.error", nil, err.Error())
	}

	return nil
}

func SendWelcomeEmail(userId string, email string, verified bool, locale string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	rawUrl, _ := url.Parse(utils.GetSiteURL())

	subject := T("api.templates.welcome_subject", map[string]interface{}{"ServerURL": rawUrl.Host})

	bodyPage := utils.NewHTMLTemplate("welcome_body", locale)
	bodyPage.Props["SiteURL"] = utils.GetSiteURL()
	bodyPage.Props["Title"] = T("api.templates.welcome_body.title", map[string]interface{}{"ServerURL": rawUrl.Host})
	bodyPage.Props["Info"] = T("api.templates.welcome_body.info")
	bodyPage.Props["Button"] = T("api.templates.welcome_body.button")
	bodyPage.Props["Info2"] = T("api.templates.welcome_body.info2")
	bodyPage.Props["Info3"] = T("api.templates.welcome_body.info3")
	bodyPage.Props["SiteURL"] = utils.GetSiteURL()

	if *utils.Cfg.NativeAppSettings.AppDownloadLink != "" {
		bodyPage.Props["AppDownloadInfo"] = T("api.templates.welcome_body.app_download_info")
		bodyPage.Props["AppDownloadLink"] = *utils.Cfg.NativeAppSettings.AppDownloadLink
	}

	if !verified {
		link := fmt.Sprintf("%s/do_verify_email?uid=%s&hid=%s&email=%s", utils.GetSiteURL(), userId, model.HashPassword(userId+utils.Cfg.EmailSettings.InviteSalt), url.QueryEscape(email))
		bodyPage.Props["VerifyUrl"] = link
	}

	if err := utils.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewLocAppError("SendWelcomeEmail", "api.user.send_welcome_email_and_forget.failed.error", nil, err.Error())
	}

	return nil
}

func SendPasswordChangeEmail(email, method, locale string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	subject := T("api.templates.password_change_subject",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName, "SiteName": utils.Cfg.TeamSettings.SiteName})

	bodyPage := utils.NewHTMLTemplate("password_change_body", locale)
	bodyPage.Props["SiteURL"] = utils.GetSiteURL()
	bodyPage.Props["Title"] = T("api.templates.password_change_body.title")
	bodyPage.Html["Info"] = template.HTML(T("api.templates.password_change_body.info",
		map[string]interface{}{"TeamDisplayName": utils.Cfg.TeamSettings.SiteName, "TeamURL": utils.GetSiteURL(), "Method": method}))

	if err := utils.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewLocAppError("SendPasswordChangeEmail", "api.user.send_password_change_email_and_forget.error", nil, err.Error())
	}

	return nil
}

func SendMfaChangeEmail(email string, activated bool, locale string) *model.AppError {
	T := utils.GetUserTranslations(locale)

	subject := T("api.templates.mfa_change_subject",
		map[string]interface{}{"SiteName": utils.Cfg.TeamSettings.SiteName})

	bodyPage := utils.NewHTMLTemplate("mfa_change_body", locale)
	bodyPage.Props["SiteURL"] = utils.GetSiteURL()

	bodyText := ""
	if activated {
		bodyText = "api.templates.mfa_activated_body.info"
		bodyPage.Props["Title"] = T("api.templates.mfa_activated_body.title")
	} else {
		bodyText = "api.templates.mfa_deactivated_body.info"
		bodyPage.Props["Title"] = T("api.templates.mfa_deactivated_body.title")
	}

	bodyPage.Html["Info"] = template.HTML(T(bodyText,
		map[string]interface{}{"SiteURL": utils.GetSiteURL()}))

	if err := utils.SendMail(email, subject, bodyPage.Render()); err != nil {
		return model.NewLocAppError("SendMfaChangeEmail", "api.user.send_mfa_change_email.error", nil, err.Error())
	}

	return nil
}
