// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mail"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/shared/templates"
	"github.com/pkg/errors"

	"github.com/microcosm-cc/bluemonday"
)

const serverInactivityHours = 100

func (es *Service) SendChangeUsernameEmail(newUsername, email, locale, siteURL string) error {
	T := i18n.GetUserTranslations(locale)

	subject := T("api.templates.username_change_subject",
		map[string]any{"SiteName": es.config().TeamSettings.SiteName,
			"TeamDisplayName": es.config().TeamSettings.SiteName})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.username_change_body.title")
	data.Props["Info"] = T("api.templates.username_change_body.info",
		map[string]any{"TeamDisplayName": es.config().TeamSettings.SiteName, "NewUsername": newUsername})
	data.Props["Warning"] = T("api.templates.email_warning")

	body, err := es.templatesContainer.RenderToString("email_change_body", data)
	if err != nil {
		return err
	}

	if err := es.sendMail(email, subject, body); err != nil {
		return err
	}

	return nil
}

func (es *Service) SendEmailChangeVerifyEmail(newUserEmail, locale, siteURL, token string) error {
	T := i18n.GetUserTranslations(locale)

	link := fmt.Sprintf("%s/do_verify_email?token=%s&email=%s", siteURL, token, url.QueryEscape(newUserEmail))

	subject := T("api.templates.email_change_verify_subject",
		map[string]any{"SiteName": es.config().TeamSettings.SiteName,
			"TeamDisplayName": es.config().TeamSettings.SiteName})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.email_change_verify_body.title")
	data.Props["Info"] = T("api.templates.email_change_verify_body.info",
		map[string]any{"TeamDisplayName": es.config().TeamSettings.SiteName})
	data.Props["VerifyUrl"] = link
	data.Props["VerifyButton"] = T("api.templates.email_change_verify_body.button")
	data.Props["QuestionTitle"] = T("api.templates.questions_footer.title")
	data.Props["EmailInfo1"] = T("api.templates.email_us_anytime_at")
	data.Props["SupportEmail"] = "feedback@mattermost.com"
	data.Props["FooterV2"] = T("api.templates.email_footer_v2")

	body, err := es.templatesContainer.RenderToString("email_change_verify_body", data)
	if err != nil {
		return err
	}

	if err := es.sendMail(newUserEmail, subject, body); err != nil {
		return err
	}

	return nil
}

func (es *Service) SendEmailChangeEmail(oldEmail, newEmail, locale, siteURL string) error {
	T := i18n.GetUserTranslations(locale)

	subject := T("api.templates.email_change_subject",
		map[string]any{"SiteName": es.config().TeamSettings.SiteName,
			"TeamDisplayName": es.config().TeamSettings.SiteName})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.email_change_body.title")
	data.Props["Info"] = T("api.templates.email_change_body.info",
		map[string]any{"TeamDisplayName": es.config().TeamSettings.SiteName, "NewEmail": newEmail})
	data.Props["Warning"] = T("api.templates.email_warning")

	body, err := es.templatesContainer.RenderToString("email_change_body", data)
	if err != nil {
		return err
	}

	if err := es.sendMail(oldEmail, subject, body); err != nil {
		return err
	}

	return nil
}

func (es *Service) SendVerifyEmail(userEmail, locale, siteURL, token, redirect string) error {
	T := i18n.GetUserTranslations(locale)

	link := fmt.Sprintf("%s/do_verify_email?token=%s&email=%s", siteURL, token, url.QueryEscape(userEmail))
	if redirect != "" {
		link += fmt.Sprintf("&redirect_to=%s", redirect)
	}

	serverURL := condenseSiteURL(siteURL)

	subject := T("api.templates.verify_subject",
		map[string]any{"SiteName": es.config().TeamSettings.SiteName})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.verify_body.title")
	data.Props["SubTitle1"] = T("api.templates.verify_body.subTitle1")
	data.Props["ServerURL"] = T("api.templates.verify_body.serverURL", map[string]any{"ServerURL": serverURL})
	data.Props["SubTitle2"] = T("api.templates.verify_body.subTitle2")
	data.Props["ButtonURL"] = link
	data.Props["Button"] = T("api.templates.verify_body.button")
	data.Props["Info"] = T("api.templates.verify_body.info")
	data.Props["Info1"] = T("api.templates.verify_body.info1")
	data.Props["QuestionTitle"] = T("api.templates.questions_footer.title")
	data.Props["QuestionInfo"] = T("api.templates.questions_footer.info")

	body, err := es.templatesContainer.RenderToString("verify_body", data)
	if err != nil {
		return err
	}

	if err := es.sendMail(userEmail, subject, body); err != nil {
		return err
	}

	return nil
}

func (es *Service) SendSignInChangeEmail(email, method, locale, siteURL string) error {
	T := i18n.GetUserTranslations(locale)

	subject := T("api.templates.signin_change_email.subject",
		map[string]any{"SiteName": es.config().TeamSettings.SiteName})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.signin_change_email.body.title")
	data.Props["Info"] = T("api.templates.signin_change_email.body.info",
		map[string]any{"SiteName": es.config().TeamSettings.SiteName, "Method": method})
	data.Props["Warning"] = T("api.templates.email_warning")

	body, err := es.templatesContainer.RenderToString("signin_change_body", data)
	if err != nil {
		return err
	}

	if err := es.sendMail(email, subject, body); err != nil {
		return err
	}

	return nil
}

func (es *Service) SendWelcomeEmail(userID string, email string, verified bool, disableWelcomeEmail bool, locale, siteURL, redirect string) error {
	if disableWelcomeEmail {
		return nil
	}
	if !*es.config().EmailSettings.SendEmailNotifications && !*es.config().EmailSettings.RequireEmailVerification {
		return errors.New("send email notifications and require email verification is disabled in the system console")
	}

	T := i18n.GetUserTranslations(locale)

	serverURL := condenseSiteURL(siteURL)

	subject := T("api.templates.welcome_subject",
		map[string]any{"SiteName": es.config().TeamSettings.SiteName,
			"ServerURL": serverURL})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.welcome_body.title")
	data.Props["SubTitle1"] = T("api.templates.welcome_body.subTitle1")
	data.Props["ServerURL"] = T("api.templates.welcome_body.serverURL", map[string]any{"ServerURL": serverURL})
	data.Props["SubTitle2"] = T("api.templates.welcome_body.subTitle2")
	data.Props["Button"] = T("api.templates.welcome_body.button")
	data.Props["Info"] = T("api.templates.welcome_body.info")
	data.Props["Info1"] = T("api.templates.welcome_body.info1")
	data.Props["SiteURL"] = siteURL

	if *es.config().NativeAppSettings.AppDownloadLink != "" {
		data.Props["AppDownloadTitle"] = T("api.templates.welcome_body.app_download_title")
		data.Props["AppDownloadInfo"] = T("api.templates.welcome_body.app_download_info")
		data.Props["AppDownloadButton"] = T("api.templates.welcome_body.app_download_button")
		data.Props["AppDownloadLink"] = *es.config().NativeAppSettings.AppDownloadLink
	}

	if !verified && *es.config().EmailSettings.RequireEmailVerification {
		token, err := es.CreateVerifyEmailToken(userID, email)
		if err != nil {
			return err
		}
		link := fmt.Sprintf("%s/do_verify_email?token=%s&email=%s", siteURL, token.Token, url.QueryEscape(email))
		if redirect != "" {
			link += fmt.Sprintf("&redirect_to=%s", redirect)
		}
		data.Props["ButtonURL"] = link
	}

	body, err := es.templatesContainer.RenderToString("welcome_body", data)
	if err != nil {
		return err
	}

	if err := es.sendMail(email, subject, body); err != nil {
		return err
	}

	return nil
}

func (es *Service) SendCloudUpgradeConfirmationEmail(userEmail, name, date, locale, siteURL, workspaceName string, isYearly bool, embeddedFiles map[string]io.Reader) error {
	T := i18n.GetUserTranslations(locale)
	subject := T("api.templates.cloud_upgrade_confirmation.subject")

	data := es.NewEmailTemplateData(locale)
	data.Props["Title"] = T("api.templates.cloud_upgrade_confirmation.title")
	data.Props["SubTitle"] = T("api.templates.cloud_upgrade_confirmation_monthly.subtitle", map[string]any{"WorkspaceName": workspaceName, "Date": date})
	data.Props["SiteURL"] = siteURL
	data.Props["ButtonURL"] = siteURL
	data.Props["Button"] = T("api.templates.cloud_welcome_email.button")
	data.Props["QuestionTitle"] = T("api.templates.questions_footer.title")
	data.Props["QuestionInfo"] = T("api.templates.questions_footer.info")
	data.Props["SupportEmail"] = *es.config().SupportSettings.SupportEmail

	if isYearly {
		data.Props["SubTitle"] = T("api.templates.cloud_upgrade_confirmation_yearly.subtitle", map[string]any{"WorkspaceName": workspaceName})
		data.Props["ButtonURL"] = siteURL + "/admin_console/billing/billing_history"
		data.Props["Button"] = T("api.templates.cloud_welcome_email.yearly_plan_button")
	}

	body, err := es.templatesContainer.RenderToString("cloud_upgrade_confirmation", data)
	if err != nil {
		return err
	}

	if isYearly {
		if err := es.SendMailWithEmbeddedFilesAndCustomReplyTo(userEmail, subject, body, *es.config().SupportSettings.SupportEmail, embeddedFiles); err != nil {
			return err
		}
	} else {
		if err := es.sendEmailWithCustomReplyTo(userEmail, subject, body, *es.config().SupportSettings.SupportEmail); err != nil {
			return err
		}
	}

	return nil
}

// SendCloudWelcomeEmail sends the cloud version of the welcome email
func (es *Service) SendCloudWelcomeEmail(userEmail, locale, teamInviteID, workSpaceName, dns, siteURL string) error {
	T := i18n.GetUserTranslations(locale)
	subject := T("api.templates.cloud_welcome_email.subject")

	data := es.NewEmailTemplateData(locale)
	data.Props["Title"] = T("api.templates.cloud_welcome_email.title")
	data.Props["SubTitle"] = T("api.templates.cloud_welcome_email.subtitle")
	data.Props["SubTitleInfo"] = T("api.templates.cloud_welcome_email.subtitle_info")
	data.Props["Info"] = T("api.templates.cloud_welcome_email.info")
	data.Props["Info2"] = T("api.templates.cloud_welcome_email.info2")
	data.Props["WorkSpacePath"] = siteURL
	data.Props["DNS"] = dns
	data.Props["InviteInfo"] = T("api.templates.cloud_welcome_email.invite_info")
	data.Props["InviteSubInfo"] = T("api.templates.cloud_welcome_email.invite_sub_info", map[string]any{"WorkSpace": workSpaceName})
	data.Props["InviteSubInfoLink"] = fmt.Sprintf("%s/signup_user_complete/?id=%s", siteURL, teamInviteID)
	data.Props["AddAppsInfo"] = T("api.templates.cloud_welcome_email.add_apps_info")
	data.Props["AddAppsSubInfo"] = T("api.templates.cloud_welcome_email.add_apps_sub_info")
	data.Props["AppMarketPlace"] = T("api.templates.cloud_welcome_email.app_market_place")
	data.Props["AppMarketPlaceLink"] = "https://integrations.mattermost.com/"
	data.Props["DownloadMMInfo"] = T("api.templates.cloud_welcome_email.download_mm_info")
	data.Props["SignInSubInfo"] = T("api.templates.cloud_welcome_email.signin_sub_info")
	data.Props["MMApps"] = T("api.templates.cloud_welcome_email.mm_apps")
	data.Props["SignInSubInfo2"] = T("api.templates.cloud_welcome_email.signin_sub_info2")
	data.Props["DownloadMMAppsLink"] = "https://mattermost.com/download/"
	data.Props["Button"] = T("api.templates.cloud_welcome_email.button")
	data.Props["GettingStartedQuestions"] = T("api.templates.cloud_welcome_email.start_questions")

	body, err := es.templatesContainer.RenderToString("cloud_welcome_email", data)
	if err != nil {
		return err
	}

	if err := es.sendEmailWithCustomReplyTo(userEmail, subject, body, *es.config().SupportSettings.SupportEmail); err != nil {
		return err
	}

	return nil
}

func (es *Service) SendPasswordChangeEmail(email, method, locale, siteURL string) error {
	T := i18n.GetUserTranslations(locale)

	subject := T("api.templates.password_change_subject",
		map[string]any{"SiteName": es.config().TeamSettings.SiteName,
			"TeamDisplayName": es.config().TeamSettings.SiteName})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.password_change_body.title")
	data.Props["Info"] = T("api.templates.password_change_body.info",
		map[string]any{"TeamDisplayName": es.config().TeamSettings.SiteName, "TeamURL": siteURL, "Method": method})
	data.Props["Warning"] = T("api.templates.email_warning")

	body, err := es.templatesContainer.RenderToString("password_change_body", data)
	if err != nil {
		return err
	}

	if err := es.sendMail(email, subject, body); err != nil {
		return err
	}

	return nil
}

func (es *Service) SendUserAccessTokenAddedEmail(email, locale, siteURL string) error {
	T := i18n.GetUserTranslations(locale)

	subject := T("api.templates.user_access_token_subject",
		map[string]any{"SiteName": es.config().TeamSettings.SiteName})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.user_access_token_body.title")
	data.Props["Info"] = T("api.templates.user_access_token_body.info",
		map[string]any{"SiteName": es.config().TeamSettings.SiteName, "SiteURL": siteURL})
	data.Props["Warning"] = T("api.templates.email_warning")

	body, err := es.templatesContainer.RenderToString("password_change_body", data)
	if err != nil {
		return err
	}

	if err := es.sendMail(email, subject, body); err != nil {
		return err
	}

	return nil
}

func (es *Service) SendPasswordResetEmail(email string, token *model.Token, locale, siteURL string) (bool, error) {
	T := i18n.GetUserTranslations(locale)

	link := fmt.Sprintf("%s/reset_password_complete?token=%s", siteURL, url.QueryEscape(token.Token))

	subject := T("api.templates.reset_subject",
		map[string]any{"SiteName": es.config().TeamSettings.SiteName})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.reset_body.title")
	data.Props["SubTitle"] = T("api.templates.reset_body.subTitle")
	data.Props["Info"] = T("api.templates.reset_body.info")
	data.Props["ButtonURL"] = link
	data.Props["Button"] = T("api.templates.reset_body.button")
	data.Props["QuestionTitle"] = T("api.templates.questions_footer.title")
	data.Props["QuestionInfo"] = T("api.templates.questions_footer.info")

	body, err := es.templatesContainer.RenderToString("reset_body", data)
	if err != nil {
		return false, err
	}

	if err := es.sendMail(email, subject, body); err != nil {
		return false, err
	}

	return true, nil
}

func (es *Service) SendMfaChangeEmail(email string, activated bool, locale, siteURL string) error {
	T := i18n.GetUserTranslations(locale)

	subject := T("api.templates.mfa_change_subject",
		map[string]any{"SiteName": es.config().TeamSettings.SiteName})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL

	if activated {
		data.Props["Info"] = T("api.templates.mfa_activated_body.info", map[string]any{"SiteURL": siteURL})
		data.Props["Title"] = T("api.templates.mfa_activated_body.title")
	} else {
		data.Props["Info"] = T("api.templates.mfa_deactivated_body.info", map[string]any{"SiteURL": siteURL})
		data.Props["Title"] = T("api.templates.mfa_deactivated_body.title")
	}
	data.Props["Warning"] = T("api.templates.email_warning")

	body, err := es.templatesContainer.RenderToString("mfa_change_body", data)
	if err != nil {
		return err
	}

	if err := es.sendMail(email, subject, body); err != nil {
		return err
	}

	return nil
}

func (es *Service) SendInviteEmails(
	team *model.Team,
	senderName string,
	senderUserId string,
	invites []string,
	siteURL string,
	reminderData *model.TeamInviteReminderData,
	errorWhenNotSent bool,
	isSystemAdmin bool,
	isFirstAdmin bool,
) error {
	if es.perHourEmailRateLimiter == nil {
		return NoRateLimiterError
	}
	rateLimited, result, err := es.perHourEmailRateLimiter.RateLimit(senderUserId, len(invites))
	if err != nil {
		return SetupRateLimiterError
	}

	if rateLimited {
		mlog.Error("rate limit exceeded", mlog.Duration("RetryAfter", result.RetryAfter), mlog.Duration("ResetAfter", result.ResetAfter), mlog.String("user_id", senderUserId),
			mlog.String("team_id", team.Id), mlog.String("retry_after_secs", fmt.Sprintf("%f", result.RetryAfter.Seconds())), mlog.String("reset_after_secs", fmt.Sprintf("%f", result.ResetAfter.Seconds())))
		return RateLimitExceededError
	}

	for _, invite := range invites {
		if invite != "" {
			subject := i18n.T("api.templates.invite_subject",
				map[string]any{"SenderName": senderName,
					"TeamDisplayName": team.DisplayName,
					"SiteName":        es.config().TeamSettings.SiteName})

			data := es.NewEmailTemplateData("")
			data.Props["SiteURL"] = siteURL
			data.Props["SubTitle"] = i18n.T("api.templates.invite_body.subTitle")
			data.Props["Button"] = i18n.T("api.templates.invite_body.button")
			data.Props["SenderName"] = senderName
			data.Props["InviteFooterTitle"] = i18n.T("api.templates.invite_body_footer.title")
			data.Props["InviteFooterInfo"] = i18n.T("api.templates.invite_body_footer.info")
			data.Props["InviteFooterLearnMore"] = i18n.T("api.templates.invite_body_footer.learn_more")

			token := model.NewToken(
				TokenTypeTeamInvitation,
				model.MapToJSON(map[string]string{"teamId": team.Id, "email": invite}),
			)

			tokenProps := make(map[string]string)
			tokenProps["email"] = invite
			tokenProps["display_name"] = team.DisplayName
			tokenProps["name"] = team.Name

			title := i18n.T("api.templates.invite_body.title", map[string]any{"SenderName": senderName, "TeamDisplayName": team.DisplayName})
			if reminderData != nil {
				reminder := i18n.T("api.templates.invite_body.title.reminder")
				title = fmt.Sprintf("%s: %s", reminder, title)
				tokenProps["reminder_interval"] = reminderData.Interval
			}

			data.Props["Title"] = title

			tokenData := model.MapToJSON(tokenProps)

			if err := es.store.Token().Save(token); err != nil {
				mlog.Error("Failed to send invite email successfully ", mlog.Err(err))
				continue
			}

			data.Props["ButtonURL"] = fmt.Sprintf("%s/signup_user_complete/?d=%s&t=%s&sbr=%s", siteURL, url.QueryEscape(tokenData), url.QueryEscape(token.Token), es.GetTrackFlowStartedByRole(isFirstAdmin, isSystemAdmin))

			body, err := es.templatesContainer.RenderToString("invite_body", data)
			if err != nil {
				mlog.Error("Failed to send invite email successfully ", mlog.Err(err))
			}

			if err := es.sendMail(invite, subject, body); err != nil {
				mlog.Error("Failed to send invite email successfully ", mlog.Err(err))
				if errorWhenNotSent {
					return SendMailError
				}
			}
		}
	}
	return nil
}

func (es *Service) SendGuestInviteEmails(
	team *model.Team,
	channels []*model.Channel,
	senderName string,
	senderUserId string,
	senderProfileImage []byte,
	invites []string,
	siteURL string,
	message string,
	errorWhenNotSent bool,
	isSystemAdmin bool,
	isFirstAdmin bool,
) error {
	if es.perHourEmailRateLimiter == nil {
		return NoRateLimiterError
	}
	rateLimited, result, err := es.perHourEmailRateLimiter.RateLimit(senderUserId, len(invites))
	if err != nil {
		return SetupRateLimiterError
	}

	if rateLimited {
		mlog.Error("rate limit exceeded", mlog.Duration("RetryAfter", result.RetryAfter), mlog.Duration("ResetAfter", result.ResetAfter), mlog.String("user_id", senderUserId),
			mlog.String("team_id", team.Id), mlog.String("retry_after_secs", fmt.Sprintf("%f", result.RetryAfter.Seconds())), mlog.String("reset_after_secs", fmt.Sprintf("%f", result.ResetAfter.Seconds())))
		return RateLimitExceededError
	}

	for _, invite := range invites {
		if invite != "" {
			subject := i18n.T("api.templates.invite_guest_subject",
				map[string]any{"SenderName": senderName,
					"TeamDisplayName": team.DisplayName,
					"SiteName":        es.config().TeamSettings.SiteName})

			data := es.NewEmailTemplateData("")
			data.Props["SiteURL"] = siteURL
			data.Props["Title"] = i18n.T("api.templates.invite_body.title", map[string]any{"SenderName": senderName, "TeamDisplayName": team.DisplayName})
			data.Props["SubTitle"] = i18n.T("api.templates.invite_body_guest.subTitle")
			data.Props["Button"] = i18n.T("api.templates.invite_body.button")
			data.Props["SenderName"] = senderName
			if message != "" {
				message = bluemonday.NewPolicy().Sanitize(message)
			}
			data.Props["Message"] = message
			data.Props["InviteFooterTitle"] = i18n.T("api.templates.invite_body_footer.title")
			data.Props["InviteFooterInfo"] = i18n.T("api.templates.invite_body_footer.info")
			data.Props["InviteFooterLearnMore"] = i18n.T("api.templates.invite_body_footer.learn_more")

			channelIDs := []string{}
			for _, channel := range channels {
				channelIDs = append(channelIDs, channel.Id)
			}

			token := model.NewToken(
				TokenTypeGuestInvitation,
				model.MapToJSON(map[string]string{
					"teamId":   team.Id,
					"channels": strings.Join(channelIDs, " "),
					"email":    invite,
					"guest":    "true",
					"senderId": senderUserId,
				}),
			)

			tokenProps := make(map[string]string)
			tokenProps["email"] = invite
			tokenProps["display_name"] = team.DisplayName
			tokenProps["name"] = team.Name
			tokenData := model.MapToJSON(tokenProps)

			if err := es.store.Token().Save(token); err != nil {
				mlog.Error("Failed to send invite email successfully ", mlog.Err(err))
				continue
			}

			data.Props["ButtonURL"] = fmt.Sprintf("%s/signup_user_complete/?d=%s&t=%s&sbr=%s", siteURL, url.QueryEscape(tokenData), url.QueryEscape(token.Token), es.GetTrackFlowStartedByRole(isFirstAdmin, isSystemAdmin))

			if !*es.config().EmailSettings.SendEmailNotifications {
				mlog.Info("sending invitation ", mlog.String("to", invite), mlog.String("link", data.Props["ButtonURL"].(string)))
			}

			senderPhoto := ""
			embeddedFiles := make(map[string]io.Reader)
			if message != "" {
				if senderProfileImage != nil {
					senderPhoto = "user-avatar.png"
					embeddedFiles = map[string]io.Reader{
						senderPhoto: bytes.NewReader(senderProfileImage),
					}
				}
			}

			pData := postData{
				SenderName:  senderName,
				Message:     template.HTML(message),
				SenderPhoto: senderPhoto,
			}

			data.Props["Posts"] = []postData{pData}

			body, err := es.templatesContainer.RenderToString("invite_body", data)
			if err != nil {
				mlog.Error("Failed to send invite email successfully", mlog.Err(err))
			}

			if nErr := es.SendMailWithEmbeddedFiles(invite, subject, body, embeddedFiles, "", "", ""); nErr != nil {
				mlog.Error("Failed to send invite email successfully", mlog.Err(nErr))
				if errorWhenNotSent {
					return SendMailError
				}
			}
		}
	}
	return nil
}

func (es *Service) SendInviteEmailsToTeamAndChannels(
	team *model.Team,
	channels []*model.Channel,
	senderName string,
	senderUserId string,
	senderProfileImage []byte,
	invites []string,
	siteURL string,
	reminderData *model.TeamInviteReminderData,
	message string,
	errorWhenNotSent bool,
	isSystemAdmin bool,
	isFirstAdmin bool,
) ([]*model.EmailInviteWithError, error) {
	if es.perHourEmailRateLimiter == nil {
		return nil, NoRateLimiterError
	}
	rateLimited, result, err := es.perHourEmailRateLimiter.RateLimit(senderUserId, len(invites))
	if err != nil {
		return nil, SetupRateLimiterError
	}

	if rateLimited {
		mlog.Error("rate limit exceeded", mlog.Duration("RetryAfter", result.RetryAfter), mlog.Duration("ResetAfter", result.ResetAfter), mlog.String("user_id", senderUserId),
			mlog.String("team_id", team.Id), mlog.String("retry_after_secs", fmt.Sprintf("%f", result.RetryAfter.Seconds())), mlog.String("reset_after_secs", fmt.Sprintf("%f", result.ResetAfter.Seconds())))
		return nil, RateLimitExceededError
	}

	channelsLen := len(channels)

	subject := i18n.T("api.templates.invite_team_and_channels_subject", map[string]any{
		"SenderName":      senderName,
		"TeamDisplayName": team.DisplayName,
		"ChannelsLen":     channelsLen,
		"SiteName":        es.config().TeamSettings.SiteName})

	title := i18n.T("api.templates.invite_team_and_channels_body.title", map[string]any{
		"SenderName":      senderName,
		"ChannelsLen":     channelsLen,
		"TeamDisplayName": team.DisplayName})

	if channelsLen == 1 {
		channelName := channels[0].DisplayName

		subject = i18n.T("api.templates.invite_team_and_channel_subject",
			map[string]any{"SenderName": senderName,
				"TeamDisplayName": team.DisplayName,
				"ChannelName":     channelName,
				"SiteName":        es.config().TeamSettings.SiteName},
		)

		title = i18n.T("api.templates.invite_team_and_channel_body.title", map[string]any{
			"SenderName":      senderName,
			"ChannelName":     channelName,
			"TeamDisplayName": team.DisplayName,
		})
	}

	var invitesWithErrors []*model.EmailInviteWithError
	for _, invite := range invites {
		if invite == "" {
			continue
		}
		channelIDs := []string{}
		for _, channel := range channels {
			channelIDs = append(channelIDs, channel.Id)
		}

		data := es.NewEmailTemplateData("")
		data.Props["SiteURL"] = siteURL
		data.Props["SubTitle"] = i18n.T("api.templates.invite_body.subTitle")
		data.Props["Button"] = i18n.T("api.templates.invite_body.button")
		data.Props["SenderName"] = senderName
		data.Props["InviteFooterTitle"] = i18n.T("api.templates.invite_body_footer.title")
		data.Props["InviteFooterInfo"] = i18n.T("api.templates.invite_body_footer.info")
		data.Props["InviteFooterLearnMore"] = i18n.T("api.templates.invite_body_footer.learn_more")

		if message != "" {
			message = bluemonday.NewPolicy().Sanitize(message)
		}
		data.Props["Message"] = message

		token := model.NewToken(
			TokenTypeTeamInvitation,
			model.MapToJSON(map[string]string{
				"teamId":   team.Id,
				"email":    invite,
				"channels": strings.Join(channelIDs, " "),
				"senderId": senderUserId,
			}),
		)

		tokenProps := make(map[string]string)
		tokenProps["email"] = invite
		tokenProps["display_name"] = team.DisplayName
		tokenProps["name"] = team.Name

		if reminderData != nil {
			reminder := i18n.T("api.templates.invite_body.title.reminder")
			title = fmt.Sprintf("%s: %s", reminder, title)
			tokenProps["reminder_interval"] = reminderData.Interval
		}

		data.Props["Title"] = title

		tokenData := model.MapToJSON(tokenProps)

		if err := es.store.Token().Save(token); err != nil {
			mlog.Error("Failed to send invite email successfully ", mlog.Err(err))
			continue
		}

		data.Props["ButtonURL"] = fmt.Sprintf("%s/signup_user_complete/?d=%s&t=%s&sbr=%s", siteURL, url.QueryEscape(tokenData), url.QueryEscape(token.Token), es.GetTrackFlowStartedByRole(isFirstAdmin, isSystemAdmin))

		senderPhoto := ""
		embeddedFiles := make(map[string]io.Reader)
		if message != "" {
			if senderProfileImage != nil {
				senderPhoto = "user-avatar.png"
				embeddedFiles = map[string]io.Reader{
					senderPhoto: bytes.NewReader(senderProfileImage),
				}
			}
		}
		pData := postData{
			SenderName:  senderName,
			Message:     template.HTML(message),
			SenderPhoto: senderPhoto,
		}

		data.Props["Posts"] = []postData{pData}

		body, err := es.templatesContainer.RenderToString("invite_body", data)
		if err != nil {
			mlog.Error("Failed to send invite email successfully ", mlog.Err(err))
		}

		if nErr := es.SendMailWithEmbeddedFiles(invite, subject, body, embeddedFiles, "", "", ""); nErr != nil {
			mlog.Error("Failed to send invite email successfully", mlog.Err(nErr))
			if errorWhenNotSent {
				inviteWithError := &model.EmailInviteWithError{
					Email: invite,
					Error: &model.AppError{Message: nErr.Error()},
				}
				invitesWithErrors = append(invitesWithErrors, inviteWithError)
			}
		}
	}
	return invitesWithErrors, nil
}

func (es *Service) NewEmailTemplateData(locale string) templates.Data {
	var localT i18n.TranslateFunc
	if locale != "" {
		localT = i18n.GetUserTranslations(locale)
	} else {
		localT = i18n.T
	}
	organization := ""

	if *es.config().EmailSettings.FeedbackOrganization != "" {
		organization = localT("api.templates.email_organization") + *es.config().EmailSettings.FeedbackOrganization
	}

	return templates.Data{
		Props: map[string]any{
			"EmailInfo1": localT("api.templates.email_info1"),
			"EmailInfo2": localT("api.templates.email_info2"),
			"EmailInfo3": localT("api.templates.email_info3",
				map[string]any{"SiteName": es.config().TeamSettings.SiteName}),
			"SupportEmail": *es.config().SupportSettings.SupportEmail,
			"Footer":       localT("api.templates.email_footer"),
			"FooterV2":     localT("api.templates.email_footer_v2"),
			"Organization": organization,
		},
		HTML: map[string]template.HTML{},
	}
}

func (es *Service) SendDeactivateAccountEmail(email string, locale, siteURL string) error {
	T := i18n.GetUserTranslations(locale)

	serverURL := condenseSiteURL(siteURL)

	subject := T("api.templates.deactivate_subject",
		map[string]any{"SiteName": es.config().TeamSettings.SiteName,
			"ServerURL": serverURL})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.deactivate_body.title", map[string]any{"ServerURL": serverURL})
	data.Props["Info"] = T("api.templates.deactivate_body.info",
		map[string]any{"SiteURL": siteURL})
	data.Props["Warning"] = T("api.templates.deactivate_body.warning")

	body, err := es.templatesContainer.RenderToString("deactivate_body", data)
	if err != nil {
		return err
	}

	if err := es.sendMail(email, subject, body); err != nil { // this needs to receive the header options
		return err
	}

	return nil
}

func (es *Service) SendNotificationMail(to, subject, htmlBody string) error {
	if !*es.config().EmailSettings.SendEmailNotifications {
		return nil
	}
	return es.sendMail(to, subject, htmlBody)
}

func (es *Service) sendMail(to, subject, htmlBody string) error {
	return es.sendMailWithCC(to, subject, htmlBody, "")
}

func (es *Service) sendEmailWithCustomReplyTo(to, subject, htmlBody, replyToAddress string) error {
	license := es.license()
	mailConfig := es.mailServiceConfig(replyToAddress)

	return mail.SendMailUsingConfig(to, subject, htmlBody, mailConfig, license != nil && *license.Features.Compliance, "", "", "", "")
}

func (es *Service) sendMailWithCC(to, subject, htmlBody string, ccMail string) error {
	license := es.license()
	mailConfig := es.mailServiceConfig("")

	return mail.SendMailUsingConfig(to, subject, htmlBody, mailConfig, license != nil && *license.Features.Compliance, "", "", "", ccMail)
}

func (es *Service) SendMailWithEmbeddedFilesAndCustomReplyTo(to, subject, htmlBody, replyToAddress string, embeddedFiles map[string]io.Reader) error {
	license := es.license()
	mailConfig := es.mailServiceConfig(replyToAddress)

	return mail.SendMailWithEmbeddedFilesUsingConfig(to, subject, htmlBody, embeddedFiles, mailConfig, license != nil && *license.Features.Compliance, "", "", "", "")
}

func (es *Service) SendMailWithEmbeddedFiles(to, subject, htmlBody string, embeddedFiles map[string]io.Reader, messageID string, inReplyTo string, references string) error {
	license := es.license()
	mailConfig := es.mailServiceConfig("")

	return mail.SendMailWithEmbeddedFilesUsingConfig(to, subject, htmlBody, embeddedFiles, mailConfig, license != nil && *license.Features.Compliance, messageID, inReplyTo, references, "")
}

func (es *Service) InvalidateVerifyEmailTokensForUser(userID string) *model.AppError {
	tokens, err := es.store.Token().GetAllTokensByType(TokenTypeVerifyEmail)
	if err != nil {
		return model.NewAppError("InvalidateVerifyEmailTokensForUser", "api.user.invalidate_verify_email_tokens.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	var appErr *model.AppError = nil
	for _, token := range tokens {
		tokenExtra := struct {
			UserId string
			Email  string
		}{}
		if err := json.Unmarshal([]byte(token.Extra), &tokenExtra); err != nil {
			appErr = model.NewAppError("InvalidateVerifyEmailTokensForUser", "api.user.invalidate_verify_email_tokens_parse.error", nil, "", http.StatusInternalServerError).Wrap(err)
			continue
		}

		if tokenExtra.UserId != userID {
			continue
		}

		if err := es.store.Token().Delete(token.Token); err != nil {
			appErr = model.NewAppError("InvalidateVerifyEmailTokensForUser", "api.user.invalidate_verify_email_tokens_delete.error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	return appErr
}

func (es *Service) CreateVerifyEmailToken(userID string, newEmail string) (*model.Token, error) {
	tokenExtra := struct {
		UserId string
		Email  string
	}{
		userID,
		newEmail,
	}

	jsonData, err := json.Marshal(tokenExtra)
	if err != nil {
		return nil, errors.Wrap(CreateEmailTokenError, err.Error())
	}

	token := model.NewToken(TokenTypeVerifyEmail, string(jsonData))

	if err := es.InvalidateVerifyEmailTokensForUser(userID); err != nil {
		return nil, err
	}

	if err = es.store.Token().Save(token); err != nil {
		return nil, err
	}

	return token, nil
}

func (es *Service) SendLicenseInactivityEmail(email, name, locale, siteURL string) error {
	T := i18n.GetUserTranslations(locale)
	subject := T("api.templates.server_inactivity_subject")
	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.server_inactivity_title")
	data.Props["SubTitle"] = T("api.templates.server_inactivity_subtitle", map[string]any{"Name": name})
	data.Props["InfoBullet"] = T("api.templates.server_inactivity_info_bullet")
	data.Props["InfoBullet1"] = T("api.templates.server_inactivity_info_bullet1")
	data.Props["InfoBullet2"] = T("api.templates.server_inactivity_info_bullet2")
	data.Props["Info"] = T("api.templates.server_inactivity_info")
	data.Props["EmailUs"] = T("api.templates.email_us_anytime_at")
	data.Props["QuestionTitle"] = T("api.templates.questions_footer.title")
	data.Props["QuestionInfo"] = T("api.templates.questions_footer.info")
	data.Props["Button"] = T("api.templates.server_inactivity_button")
	data.Props["SupportEmail"] = "feedback@mattermost.com"
	data.Props["ButtonURL"] = siteURL
	data.Props["Channels"] = T("Channels")
	data.Props["Playbooks"] = T("Playbooks")
	data.Props["Boards"] = T("Boards")

	inactivityDurationHoursEnv := os.Getenv("MM_INACTIVITY_DURATION")
	inactivityDurationHours, parseError := strconv.ParseFloat(inactivityDurationHoursEnv, 64)
	if parseError != nil {
		// default to 100 hours
		inactivityDurationHours = serverInactivityHours
	}

	data.Props["FooterDisclaimer"] = T("api.templates.server_inactivity_footer_disclaimer", map[string]any{"Hours": inactivityDurationHours})

	body, err := es.templatesContainer.RenderToString("inactivity_body", data)
	if err != nil {
		return err
	}

	if err := es.sendMail(email, subject, body); err != nil {
		return err
	}

	return nil
}

func (es *Service) SendLicenseUpForRenewalEmail(email, name, locale, siteURL, renewalLink string, daysToExpiration int) error {
	T := i18n.GetUserTranslations(locale)
	subject := T("api.templates.license_up_for_renewal_subject")

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.license_up_for_renewal_title")
	data.Props["SubTitle"] = T("api.templates.license_up_for_renewal_subtitle", map[string]any{"UserName": name, "Days": daysToExpiration})
	data.Props["SubTitleTwo"] = T("api.templates.license_up_for_renewal_subtitle_two")
	data.Props["EmailUs"] = T("api.templates.email_us_anytime_at")
	data.Props["Button"] = T("api.templates.license_up_for_renewal_renew_now")
	data.Props["ButtonURL"] = renewalLink
	data.Props["QuestionTitle"] = T("api.templates.questions_footer.title")
	data.Props["SupportEmail"] = "feedback@mattermost.com"
	data.Props["QuestionInfo"] = T("api.templates.questions_footer.info")

	body, err := es.templatesContainer.RenderToString("license_up_for_renewal", data)
	if err != nil {
		return err
	}

	if err := es.sendMail(email, subject, body); err != nil {
		return err
	}

	return nil
}

func (es *Service) SendPaymentFailedEmail(email string, locale string, failedPayment *model.FailedPayment, planName, siteURL string) (bool, error) {
	T := i18n.GetUserTranslations(locale)

	subject := T("api.templates.payment_failed.subject", map[string]any{"Plan": planName})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.payment_failed.title")
	data.Props["SubTitle1"] = T("api.templates.payment_failed.info1", map[string]any{"CardBrand": failedPayment.CardBrand, "LastFour": failedPayment.LastFour})
	data.Props["SubTitle2"] = T("api.templates.payment_failed.info2")
	data.Props["FailedReason"] = failedPayment.FailureMessage
	data.Props["SubTitle3"] = T("api.templates.payment_failed.info3", map[string]any{"Plan": planName})
	data.Props["QuestionTitle"] = T("api.templates.questions_footer.title")
	data.Props["QuestionInfo"] = T("api.templates.questions_footer.info")
	data.Props["SupportEmail"] = *es.config().SupportSettings.SupportEmail
	data.Props["Button"] = T("api.templates.delinquency_45.button")
	data.Props["IncludeSecondaryActionButton"] = false
	data.Props["EmailUs"] = T("api.templates.email_us_anytime_at")

	data.Props["Footer"] = T("api.templates.copyright")

	body, err := es.templatesContainer.RenderToString("payment_failed_body", data)
	if err != nil {
		return false, err
	}

	if err := es.sendEmailWithCustomReplyTo(email, subject, body, *es.config().SupportSettings.SupportEmail); err != nil {
		return false, err
	}

	return true, nil
}

func (es *Service) SendNoCardPaymentFailedEmail(email string, locale string, siteURL string) error {
	T := i18n.GetUserTranslations(locale)

	subject := T("api.templates.payment_failed_no_card.subject")

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.payment_failed_no_card.title")
	data.Props["Info1"] = T("api.templates.payment_failed_no_card.info1")
	data.Props["Info3"] = T("api.templates.payment_failed_no_card.info3")
	data.Props["Button"] = T("api.templates.payment_failed_no_card.button")
	data.Props["EmailUs"] = T("api.templates.email_us_anytime_at")

	data.Props["Footer"] = T("api.templates.copyright")

	body, err := es.templatesContainer.RenderToString("payment_failed_no_card_body", data)
	if err != nil {
		return err
	}

	if err := es.sendEmailWithCustomReplyTo(email, subject, body, *es.config().SupportSettings.SupportEmail); err != nil {
		return err
	}

	return nil
}

func (es *Service) SendDelinquencyEmail7(email, locale, siteURL, planName string) error {
	T := i18n.GetUserTranslations(locale)

	subject := T("api.templates.payment_failed.subject", map[string]any{"Plan": planName})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.delinquency_7.title")
	data.Props["SubTitle1"] = T("api.templates.delinquency_7.subtitle1")
	data.Props["SubTitle2"] = T("api.templates.delinquency_7.subtitle2", map[string]any{"Plan": planName})
	data.Props["QuestionTitle"] = T("api.templates.questions_footer.title")
	data.Props["QuestionInfo"] = T("api.templates.questions_footer.info")
	data.Props["SupportEmail"] = *es.config().SupportSettings.SupportEmail
	data.Props["Button"] = T("api.templates.delinquency_7.button")
	data.Props["EmailUs"] = T("api.templates.email_us_anytime_at")

	data.Props["Footer"] = T("api.templates.copyright")

	body, err := es.templatesContainer.RenderToString("cloud_7_day_arrears", data)
	if err != nil {
		return err
	}

	if err := es.sendEmailWithCustomReplyTo(email, subject, body, *es.config().SupportSettings.SupportEmail); err != nil {
		return err
	}

	return nil
}
func (es *Service) SendDelinquencyEmail14(email, locale, siteURL, planName string) error {
	T := i18n.GetUserTranslations(locale)

	subject := T("api.templates.delinquency_14.subject", map[string]any{"Plan": planName})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.delinquency_14.title")
	data.Props["SubTitle1"] = T("api.templates.delinquency_14.subtitle1")
	data.Props["SubTitle2"] = T("api.templates.delinquency_14.subtitle2")
	data.Props["QuestionTitle"] = T("api.templates.questions_footer.title")
	data.Props["QuestionInfo"] = T("api.templates.questions_footer.info")
	data.Props["SupportEmail"] = *es.config().SupportSettings.SupportEmail
	data.Props["Button"] = T("api.templates.delinquency_14.button")
	data.Props["EmailUs"] = T("api.templates.email_us_anytime_at")

	data.Props["Footer"] = T("api.templates.copyright")

	body, err := es.templatesContainer.RenderToString("cloud_14_day_arrears", data)
	if err != nil {
		return err
	}

	if err := es.sendEmailWithCustomReplyTo(email, subject, body, *es.config().SupportSettings.SupportEmail); err != nil {
		return err
	}

	return nil
}
func (es *Service) SendDelinquencyEmail30(email, locale, siteURL, planName string) error {
	T := i18n.GetUserTranslations(locale)

	subject := T("api.templates.delinquency_30.subject", map[string]any{"Plan": planName})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.delinquency_30.title")
	data.Props["SubTitle1"] = T("api.templates.delinquency_30.subtitle1", map[string]any{"Plan": planName})
	data.Props["SubTitle2"] = T("api.templates.delinquency_30.subtitle2")
	data.Props["QuestionTitle"] = T("api.templates.questions_footer.title")
	data.Props["QuestionInfo"] = T("api.templates.questions_footer.info")
	data.Props["SupportEmail"] = *es.config().SupportSettings.SupportEmail
	data.Props["Button"] = T("api.templates.delinquency_30.button")
	data.Props["EmailUs"] = T("api.templates.email_us_anytime_at")
	data.Props["BulletListItems"] = []string{T("api.templates.delinquency_30.bullet.message_history"), T("api.templates.delinquency_30.bullet.files")}
	data.Props["LimitsDocs"] = T("api.templates.delinquency_30.limits_documentation")
	data.Props["Footer"] = T("api.templates.copyright")

	body, err := es.templatesContainer.RenderToString("cloud_30_day_arrears", data)
	if err != nil {
		return err
	}

	if err := es.sendEmailWithCustomReplyTo(email, subject, body, *es.config().SupportSettings.SupportEmail); err != nil {
		return err
	}

	return nil
}

func (es *Service) SendDelinquencyEmail45(email, locale, siteURL, planName, delinquencyDate string) error {
	T := i18n.GetUserTranslations(locale)

	subject := T("api.templates.delinquency_45.subject", map[string]any{"Plan": planName})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.delinquency_45.title")
	data.Props["SubTitle1"] = T("api.templates.delinquency_45.subtitle1", map[string]any{"DelinquencyDate": delinquencyDate})
	data.Props["SubTitle2"] = T("api.templates.delinquency_45.subtitle2")
	data.Props["SubTitle3"] = T("api.templates.delinquency_45.subtitle3")
	data.Props["QuestionTitle"] = T("api.templates.questions_footer.title")
	data.Props["QuestionInfo"] = T("api.templates.questions_footer.info")
	data.Props["SupportEmail"] = *es.config().SupportSettings.SupportEmail
	data.Props["Button"] = T("api.templates.delinquency_45.button")
	data.Props["IncludeSecondaryActionButton"] = false
	data.Props["EmailUs"] = T("api.templates.email_us_anytime_at")

	data.Props["Footer"] = T("api.templates.copyright")

	body, err := es.templatesContainer.RenderToString("cloud_45_day_arrears", data)
	if err != nil {
		return err
	}

	if err := es.sendEmailWithCustomReplyTo(email, subject, body, *es.config().SupportSettings.SupportEmail); err != nil {
		return err
	}

	return nil
}

func (es *Service) SendDelinquencyEmail60(email, locale, siteURL string) error {
	T := i18n.GetUserTranslations(locale)

	subject := T("api.templates.delinquency_60.subject")

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.delinquency_60.title")
	data.Props["SubTitle1"] = T("api.templates.delinquency_60.subtitle1")
	data.Props["SubTitle2"] = T("api.templates.delinquency_60.subtitle2")
	data.Props["SubTitle3"] = T("api.templates.delinquency_60.subtitle3")
	data.Props["QuestionTitle"] = T("api.templates.questions_footer.title")
	data.Props["QuestionInfo"] = T("api.templates.questions_footer.info")
	data.Props["SupportEmail"] = *es.config().SupportSettings.SupportEmail
	data.Props["Button"] = T("api.templates.delinquency_60.button")
	data.Props["EmailUs"] = T("api.templates.email_us_anytime_at")
	data.Props["IncludeSecondaryActionButton"] = true
	data.Props["SecondaryActionButtonText"] = T("api.templates.delinquency_60.downgrade_to_free")
	data.Props["Footer"] = T("api.templates.copyright")

	// 45 day template is the same as the 60 day one so its reused
	body, err := es.templatesContainer.RenderToString("cloud_45_day_arrears", data)
	if err != nil {
		return err
	}

	if err := es.sendEmailWithCustomReplyTo(email, subject, body, *es.config().SupportSettings.SupportEmail); err != nil {
		return err
	}

	return nil
}

func (es *Service) SendDelinquencyEmail75(email, locale, siteURL, planName, delinquencyDate string) error {
	T := i18n.GetUserTranslations(locale)

	subject := T("api.templates.delinquency_75.subject", map[string]any{"Plan": planName})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.delinquency_75.title")
	data.Props["SubTitle1"] = T("api.templates.delinquency_75.subtitle1", map[string]any{"DelinquencyDate": delinquencyDate})
	data.Props["SubTitle2"] = T("api.templates.delinquency_75.subtitle2", map[string]any{"Plan": planName})
	data.Props["SubTitle3"] = T("api.templates.delinquency_75.subtitle3")
	data.Props["QuestionTitle"] = T("api.templates.questions_footer.title")
	data.Props["QuestionInfo"] = T("api.templates.questions_footer.info")
	data.Props["SupportEmail"] = *es.config().SupportSettings.SupportEmail
	data.Props["Button"] = T("api.templates.delinquency_75.button")
	data.Props["EmailUs"] = T("api.templates.email_us_anytime_at")
	data.Props["IncludeSecondaryActionButton"] = true
	data.Props["SecondaryActionButtonText"] = T("api.templates.delinquency_75.downgrade_to_free")
	data.Props["Footer"] = T("api.templates.copyright")

	// 45 day template is the same as the 75 day one so its reused
	body, err := es.templatesContainer.RenderToString("cloud_45_day_arrears", data)
	if err != nil {
		return err
	}

	if err := es.sendEmailWithCustomReplyTo(email, subject, body, *es.config().SupportSettings.SupportEmail); err != nil {
		return err
	}

	return nil
}

func (es *Service) SendDelinquencyEmail90(email, locale, siteURL string) error {
	T := i18n.GetUserTranslations(locale)

	subject := T("api.templates.delinquency_90.subject")

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.delinquency_90.title")
	data.Props["SubTitle1"] = T("api.templates.delinquency_90.subtitle1", map[string]any{"SiteURL": siteURL})
	data.Props["SubTitle2"] = T("api.templates.delinquency_90.subtitle2")
	data.Props["SubTitle3"] = T("api.templates.delinquency_90.subtitle3")
	data.Props["QuestionTitle"] = T("api.templates.questions_footer.title")
	data.Props["QuestionInfo"] = T("api.templates.questions_footer.info")
	data.Props["SupportEmail"] = *es.config().SupportSettings.SupportEmail
	data.Props["Button"] = T("api.templates.delinquency_90.button")
	data.Props["EmailUs"] = T("api.templates.email_us_anytime_at")
	data.Props["IncludeSecondaryActionButton"] = true
	data.Props["SecondaryActionButtonText"] = T("api.templates.delinquency_90.secondary_action_button")
	data.Props["Footer"] = T("api.templates.copyright")

	body, err := es.templatesContainer.RenderToString("cloud_90_day_arrears", data)
	if err != nil {
		return err
	}

	if err := es.sendEmailWithCustomReplyTo(email, subject, body, *es.config().SupportSettings.SupportEmail); err != nil {
		return err
	}

	return nil
}

// SendRemoveExpiredLicenseEmail formats an email and uses the email service to send the email to user with link pointing to CWS
// to renew the user license
func (es *Service) SendRemoveExpiredLicenseEmail(renewalLink, email string, locale, siteURL string) error {
	T := i18n.GetUserTranslations(locale)
	subject := T("api.templates.remove_expired_license.subject",
		map[string]any{"SiteName": es.config().TeamSettings.SiteName})

	data := es.NewEmailTemplateData(locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = T("api.templates.remove_expired_license.body.title")
	data.Props["Link"] = renewalLink
	data.Props["LinkButton"] = T("api.templates.remove_expired_license.body.renew_button")

	body, err := es.templatesContainer.RenderToString("remove_expired_license", data)
	if err != nil {
		return err
	}

	if err := es.sendMail(email, subject, body); err != nil {
		return err
	}

	return nil
}
