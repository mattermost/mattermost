// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package email

import (
	"io"
	"net/url"
	"path"

	"github.com/pkg/errors"
	"github.com/throttled/throttled"
	"github.com/throttled/throttled/store/memstore"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/app/users"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/shared/templates"
	"github.com/mattermost/mattermost-server/v6/store"
)

const (
	emailRateLimitingMemstoreSize = 65536
	emailRateLimitingPerHour      = 20
	emailRateLimitingMaxBurst     = 20

	TokenTypePasswordRecovery = "password_recovery"
	TokenTypeVerifyEmail      = "verify_email"
	TokenTypeTeamInvitation   = "team_invitation"
	TokenTypeGuestInvitation  = "guest_invitation"
	TokenTypeCWSAccess        = "cws_access_token"
)

func condenseSiteURL(siteURL string) string {
	parsedSiteURL, _ := url.Parse(siteURL)
	if parsedSiteURL.Path == "" || parsedSiteURL.Path == "/" {
		return parsedSiteURL.Host
	}

	return path.Join(parsedSiteURL.Host, parsedSiteURL.Path)
}

type Service struct {
	config  func() *model.Config
	goFn    func(f func())
	license func() *model.License

	userService *users.UserService
	store       store.Store
	ctx         request.CTX

	templatesContainer      *templates.Container
	perHourEmailRateLimiter *throttled.GCRARateLimiter
	perDayEmailRateLimiter  *throttled.GCRARateLimiter
	EmailBatching           *EmailBatchingJob
}

type ServiceConfig struct {
	ConfigFn  func() *model.Config
	LicenseFn func() *model.License
	GoFn      func(f func())

	TemplatesContainer *templates.Container
	UserService        *users.UserService
	Store              store.Store
	Context            request.CTX
}

func NewService(config ServiceConfig) (*Service, error) {
	if err := config.validate(); err != nil {
		return nil, err
	}
	service := &Service{
		config:             config.ConfigFn,
		templatesContainer: config.TemplatesContainer,
		license:            config.LicenseFn,
		goFn:               config.GoFn,
		store:              config.Store,
		ctx:                config.Context,
		userService:        config.UserService,
	}
	if err := service.setUpRateLimiters(); err != nil {
		return nil, err
	}
	service.InitEmailBatching()
	return service, nil
}

func (c *ServiceConfig) validate() error {
	if c.ConfigFn == nil || c.GoFn == nil || c.Store == nil || c.LicenseFn == nil || c.TemplatesContainer == nil {
		return errors.New("invalid service config")
	}
	return nil
}

func (es *Service) setUpRateLimiters() error {
	store, err := memstore.New(emailRateLimitingMemstoreSize)
	if err != nil {
		return errors.Wrap(err, "Unable to setup email rate limiting memstore.")
	}

	perHourQuota := throttled.RateQuota{
		MaxRate:  throttled.PerHour(emailRateLimitingPerHour),
		MaxBurst: emailRateLimitingMaxBurst,
	}

	perDayQuota := throttled.RateQuota{
		MaxRate:  throttled.PerDay(1),
		MaxBurst: 0,
	}

	perHourRateLimiter, err := throttled.NewGCRARateLimiter(store, perHourQuota)
	if err != nil || perHourRateLimiter == nil {
		return errors.Wrap(err, "Unable to setup email rate limiting GCRA rate limiter.")
	}

	perDayRateLimiter, err := throttled.NewGCRARateLimiter(store, perDayQuota)
	if err != nil || perDayRateLimiter == nil {
		return errors.Wrap(err, "Unable to setup per day email rate limiting GCRA rate limiter.")
	}

	es.perHourEmailRateLimiter = perHourRateLimiter
	es.perDayEmailRateLimiter = perDayRateLimiter
	return nil
}

type ServiceInterface interface {
	GetPerDayEmailRateLimiter() *throttled.GCRARateLimiter
	NewEmailTemplateData(locale string) templates.Data
	SendEmailChangeVerifyEmail(newUserEmail, locale, siteURL, token string) error
	SendEmailChangeEmail(oldEmail, newEmail, locale, siteURL string) error
	SendVerifyEmail(userEmail, locale, siteURL, token, redirect string) error
	SendSignInChangeEmail(email, method, locale, siteURL string) error
	SendWelcomeEmail(userID string, email string, verified bool, disableWelcomeEmail bool, locale, siteURL, redirect string) error
	SendCloudUpgradeConfirmationEmail(userEmail, name, trialEndDate, locale, siteURL, workspaceName string) error
	SendCloudWelcomeEmail(userEmail, locale, teamInviteID, workSpaceName, dns, siteURL string) error
	SendPasswordChangeEmail(email, method, locale, siteURL string) error
	SendUserAccessTokenAddedEmail(email, locale, siteURL string) error
	SendPasswordResetEmail(email string, token *model.Token, locale, siteURL string) (bool, error)
	SendMfaChangeEmail(email string, activated bool, locale, siteURL string) error
	SendInviteEmails(c request.CTX, team *model.Team, senderName string, senderUserId string, invites []string, siteURL string, reminderData *model.TeamInviteReminderData, errorWhenNotSent bool) error
	SendGuestInviteEmails(c request.CTX, team *model.Team, channels []*model.Channel, senderName string, senderUserId string, senderProfileImage []byte, invites []string, siteURL string, message string, errorWhenNotSent bool) error
	SendInviteEmailsToTeamAndChannels(c request.CTX, team *model.Team, channels []*model.Channel, senderName string, senderUserId string, senderProfileImage []byte, invites []string, siteURL string, reminderData *model.TeamInviteReminderData, message string, errorWhenNotSent bool) ([]*model.EmailInviteWithError, error)
	SendDeactivateAccountEmail(email string, locale, siteURL string) error
	SendNotificationMail(to, subject, htmlBody string) error
	SendMailWithEmbeddedFiles(to, subject, htmlBody string, embeddedFiles map[string]io.Reader, messageID string, inReplyTo string, references string) error
	SendLicenseUpForRenewalEmail(email, name, locale, siteURL, renewalLink string, daysToExpiration int) error
	SendPaymentFailedEmail(email string, locale string, failedPayment *model.FailedPayment, planName, siteURL string) (bool, error)
	// Cloud delinquency email sequence
	SendDelinquencyEmail7(email, locale, siteURL, planName string) error
	SendDelinquencyEmail14(email, locale, siteURL, planName string) error
	SendDelinquencyEmail30(email, locale, siteURL, planName string) error
	SendDelinquencyEmail45(email, locale, siteURL, planName, delinquencyDate string) error
	SendDelinquencyEmail60(email, locale, siteURL string) error
	SendDelinquencyEmail75(email, locale, siteURL, planName, delinquencyDate string) error
	SendDelinquencyEmail90(email, locale, siteURL string) error
	SendNoCardPaymentFailedEmail(email string, locale string, siteURL string) error
	SendRemoveExpiredLicenseEmail(renewalLink, email string, locale, siteURL string) error
	AddNotificationEmailToBatch(user *model.User, post *model.Post, team *model.Team) *model.AppError
	GetMessageForNotification(post *model.Post, translateFunc i18n.TranslateFunc) string
	InitEmailBatching()
	SendChangeUsernameEmail(newUsername, email, locale, siteURL string) error
	CreateVerifyEmailToken(userID string, newEmail string) (*model.Token, error)
	SendLicenseInactivityEmail(email, name, locale, siteURL string) error
}

func (es *Service) GetPerDayEmailRateLimiter() *throttled.GCRARateLimiter {
	return es.perDayEmailRateLimiter
}

func (es *Service) GetPerHourEmailRateLimiter() *throttled.GCRARateLimiter {
	return es.perHourEmailRateLimiter
}

func (es *Service) Log() mlog.LoggerIFace {
	return es.ctx.Logger()
}
