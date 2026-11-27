// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package email

import (
	"io"
	"net/url"
	"os"
	"path"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/pkg/errors"
	"github.com/throttled/throttled/v2"
	"github.com/throttled/throttled/v2/store/memstore"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/users"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/shared/templates"
)

const (
	emailRateLimitingMemstoreSize = 65536
	magicLinkEmailsPerMinute      = 60
	magicLinkEmailsMaxBurst       = 20

	TokenTypePasswordRecovery         = "password_recovery"
	TokenTypeVerifyEmail              = "verify_email"
	TokenTypeTeamInvitation           = "team_invitation"
	TokenTypeGuestInvitation          = "guest_invitation"
	TokenTypeCWSAccess                = "cws_access_token"
	TokenTypeGuestMagicLinkInvitation = "guest_magic_link_invitation"
	TokenTypeGuestMagicLink           = "guest_magic_link"

	// InviteTokenRemindAtKey is the team invitation token extra holding when its reminder email is due.
	InviteTokenRemindAtKey = "remindAt"
	// InviteReminderInterval is passed through the reminder link for the webapp, as before.
	InviteReminderInterval = "48"
)

// inviteReminderDelay is due an hour before the 48h invite expiry, so the hourly token cleanup
// cannot delete the token before the reminder sweep sees it. Tests can shorten it.
func inviteReminderDelay() int64 {
	if delay, err := strconv.ParseInt(os.Getenv("MM_RESEND_INVITATION_EMAIL_JOB_DURATION"), 10, 64); err == nil {
		return delay
	}
	return model.InvitationExpiryTime - time.Hour.Milliseconds()
}

func condenseSiteURL(siteURL string) string {
	parsedSiteURL, _ := url.Parse(siteURL)
	if parsedSiteURL.Path == "" || parsedSiteURL.Path == "/" {
		return parsedSiteURL.Host
	}

	return path.Join(parsedSiteURL.Host, parsedSiteURL.Path)
}

type Service struct {
	config  func() *model.Config
	license func() *model.License
	logger  mlog.LoggerIFace

	userService *users.UserService
	store       store.Store

	templatesContainer        *templates.Container
	magicLinkEmailRateLimiter *throttled.GCRARateLimiterCtx
	inviteEmailRateLimiter    atomic.Pointer[inviteRateLimiter]
	EmailBatching             *EmailBatchingJob

	postDeliveryRecorder func(userID string, post *model.Post)
}

type ServiceConfig struct {
	ConfigFn  func() *model.Config
	LicenseFn func() *model.License

	TemplatesContainer     *templates.Container
	UserService            *users.UserService
	Store                  store.Store
	Logger                 mlog.LoggerIFace
	PostDeliveryRecorderFn func(userID string, post *model.Post)
}

func NewService(config ServiceConfig) (*Service, error) {
	if err := config.validate(); err != nil {
		return nil, err
	}
	service := &Service{
		config:               config.ConfigFn,
		templatesContainer:   config.TemplatesContainer,
		license:              config.LicenseFn,
		logger:               config.Logger,
		store:                config.Store,
		userService:          config.UserService,
		postDeliveryRecorder: config.PostDeliveryRecorderFn,
	}
	if err := service.setUpRateLimiters(); err != nil {
		return nil, err
	}
	service.InitEmailBatching()
	return service, nil
}

func (es *Service) Stop() {
	mlog.Info("Shutting down Email batching service...")
	if es.EmailBatching != nil {
		es.EmailBatching.Stop()
	}
}

func (c *ServiceConfig) validate() error {
	if c.ConfigFn == nil || c.Store == nil || c.LicenseFn == nil || c.TemplatesContainer == nil {
		return errors.New("invalid service config")
	}
	return nil
}

func (es *Service) setUpRateLimiters() error {
	store, err := memstore.NewCtx(emailRateLimitingMemstoreSize)
	if err != nil {
		return errors.Wrap(err, "Unable to setup email rate limiting memstore.")
	}

	magicLinkQuota := throttled.RateQuota{
		MaxRate:  throttled.PerMin(magicLinkEmailsPerMinute),
		MaxBurst: magicLinkEmailsMaxBurst,
	}

	magicLinkRateLimiter, err := throttled.NewGCRARateLimiterCtx(store, magicLinkQuota)
	if err != nil {
		return errors.Wrap(err, "Unable to setup email rate limiting GCRA rate limiter.")
	}

	es.magicLinkEmailRateLimiter = magicLinkRateLimiter
	return es.UpdateInviteRateLimit()
}

// UpdateInviteRateLimit applies ServiceSettings.MaxEmailInvitationsPerUserPerHour to the per-sender
// invitation email limit. Changing it starts every sender with a full allowance.
func (es *Service) UpdateInviteRateLimit() error {
	store, err := memstore.NewCtx(emailRateLimitingMemstoreSize)
	if err != nil {
		return errors.Wrap(err, "Unable to setup email rate limiting memstore.")
	}

	perHour := *es.config().ServiceSettings.MaxEmailInvitationsPerUserPerHour
	// GCRA admits MaxBurst+1 at once, so this allows exactly perHour invitations in a burst.
	limiter, err := throttled.NewGCRARateLimiterCtx(store, throttled.RateQuota{
		MaxRate:  throttled.PerHour(perHour),
		MaxBurst: perHour - 1,
	})
	if err != nil {
		return errors.Wrap(err, "Unable to setup email rate limiting GCRA rate limiter.")
	}

	es.inviteEmailRateLimiter.Store(&inviteRateLimiter{limiter: limiter, perHour: perHour})
	return nil
}

type inviteRateLimiter struct {
	limiter *throttled.GCRARateLimiterCtx
	perHour int
}

type InviteEmailData struct {
	Team               *model.Team
	Channels           []*model.Channel
	SenderName         string
	SenderUserID       string
	SenderProfileImage []byte
	Invites            []string
	Profiles           map[string]*model.MemberInviteProfile
	SiteURL            string
	ReminderData       *model.TeamInviteReminderData
	ScheduleReminder   bool
	Message            string
	ErrorWhenNotSent   bool
	IsSystemAdmin      bool
	IsFirstAdmin       bool
}

type ServiceInterface interface {
	NewEmailTemplateData(locale string) templates.Data
	SendEmailChangeVerifyEmail(newUserEmail, locale, siteURL, token string) error
	SendEmailChangeEmail(oldEmail, newEmail, locale, siteURL string) error
	SendVerifyEmail(userEmail, locale, siteURL, token, redirect string) error
	SendSignInChangeEmail(email, method, locale, siteURL string) error
	SendWelcomeEmail(userID string, email string, verified bool, disableWelcomeEmail bool, locale, siteURL, redirect string) error
	SendCloudWelcomeEmail(userEmail, locale, teamInviteID, workSpaceName, dns, siteURL string) error
	SendPasswordChangeEmail(email, method, locale, siteURL string) error
	SendUserAccessTokenAddedEmail(email, locale, siteURL string) error
	SendUserAccessTokenRotatedEmail(email, locale, siteURL string) error
	SendPasswordResetEmail(email string, token *model.Token, locale, siteURL string) (bool, error)
	SendMfaChangeEmail(email string, activated bool, locale, siteURL string) error
	SendInviteEmails(rctx request.CTX, inviteData InviteEmailData) error
	SendGuestInviteEmails(rctx request.CTX, team *model.Team, channels []*model.Channel, senderName string, senderUserId string, senderProfileImage []byte, invites []string, siteURL string, message string, errorWhenNotSent bool, isSystemAdmin bool, isFirstAdmin bool, isGuestMagicLink bool) error
	SendMagicLinkEmailSelfService(rctx request.CTX, invite string, siteURL string) error
	SendInviteEmailsToTeamAndChannels(rctx request.CTX, inviteData InviteEmailData) ([]*model.EmailInviteWithError, error)
	SendDeactivateAccountEmail(email string, locale, siteURL string) error
	SendNotificationMail(to, subject, htmlBody string) error
	SendMailWithEmbeddedFiles(to, subject, htmlBody string, embeddedFiles map[string]io.Reader, messageID string, inReplyTo string, references string, category string) error
	SendLicenseUpForRenewalEmail(email, locale string, daysToExpiration int) error
	SendRemoveExpiredLicenseEmail(email, locale string) error
	AddNotificationEmailToBatch(user *model.User, post *model.Post, team *model.Team, withholdContents bool) *model.AppError
	GetMessageForNotification(post *model.Post, teamName, siteUrl string, translateFunc i18n.TranslateFunc) string
	GenerateHyperlinkForChannels(postMessage, teamName, teamURL string) (string, error)
	InitEmailBatching()
	UpdateInviteRateLimit() error
	SendChangeUsernameEmail(newUsername, email, locale, siteURL string) error
	CreateVerifyEmailToken(userID string, newEmail string) (*model.Token, error)
	SendIPFiltersChangedEmail(email string, userWhoChangedFilter *model.User, siteURL, portalURL, locale string, isWorkspaceOwner bool) error
	SetStore(st store.Store)
	Stop()
}

// getLicenseSkuName returns the license tier descriptor (e.g. "Professional",
// "Entry", "E20"), stripping the "Mattermost " prefix if the license server
// included it. Falls back to "Mattermost" when the SKU name is absent so
// that body text like "Your {{.SkuName}} license..." still reads naturally.
func (es *Service) getLicenseSkuName() string {
	if license := es.license(); license != nil && license.SkuName != "" {
		return strings.TrimPrefix(license.SkuName, "Mattermost ")
	}
	return "Mattermost"
}

// getPrefixedLicenseSkuName returns the full product name including "Mattermost"
// (e.g. "Mattermost Professional"), suitable for email subjects. Falls back
// to "Mattermost" when no license exists or the SKU name is empty.
func (es *Service) getPrefixedLicenseSkuName() string {
	skuName := es.getLicenseSkuName()
	if skuName == "Mattermost" {
		return "Mattermost"
	}
	return "Mattermost " + skuName
}

func (es *Service) getConfigSiteName() string {
	if siteName := *es.config().TeamSettings.SiteName; siteName != "" {
		return siteName
	}
	return "Mattermost"
}

func (es *Service) Store() store.Store {
	return es.store
}

func (es *Service) SetStore(st store.Store) {
	es.store = st
}
