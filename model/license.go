// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const (
	DayInSeconds      = 24 * 60 * 60
	DayInMilliseconds = DayInSeconds * 1000

	ExpiredLicenseError = "api.license.add_license.expired.app_error"
	InvalidLicenseError = "api.license.add_license.invalid.app_error"
	LicenseGracePeriod  = DayInMilliseconds * 10 //10 days
	LicenseRenewalLink  = "https://mattermost.com/renew/"

	LicenseShortSkuE10          = "E10"
	LicenseShortSkuE20          = "E20"
	LicenseShortSkuProfessional = "professional"
	LicenseShortSkuEnterprise   = "enterprise"
)

const (
	LicenseUpForRenewalEmailSent = "LicenseUpForRenewalEmailSent"
)

var (
	trialDuration      = 30*(time.Hour*24) + (time.Hour * 8)                                            // 720 hours (30 days) + 8 hours is trial license duration
	adminTrialDuration = 30*(time.Hour*24) + (time.Hour * 23) + (time.Minute * 59) + (time.Second * 59) // 720 hours (30 days) + 23 hours, 59 mins and 59 seconds

	// a sanctioned trial's duration is either more than the upper bound,
	// or less than the lower bound
	sanctionedTrialDurationLowerBound = 31*(time.Hour*24) + (time.Hour * 23) + (time.Minute * 59) + (time.Second * 59) // 744 hours (31 days) + 23 hours, 59 mins and 59 seconds
	sanctionedTrialDurationUpperBound = 29*(time.Hour*24) + (time.Hour * 23) + (time.Minute * 59) + (time.Second * 59) // 696 hours (29 days) + 23 hours, 59 mins and 59 seconds
)

type LicenseRecord struct {
	Id       string `json:"id"`
	CreateAt int64  `json:"create_at"`
	Bytes    string `json:"-"`
}

type License struct {
	Id           string    `json:"id"`
	IssuedAt     int64     `json:"issued_at"`
	StartsAt     int64     `json:"starts_at"`
	ExpiresAt    int64     `json:"expires_at"`
	Customer     *Customer `json:"customer"`
	Features     *Features `json:"features"`
	SkuName      string    `json:"sku_name"`
	SkuShortName string    `json:"sku_short_name"`
	IsTrial      bool      `json:"is_trial"`
	IsGovSku     bool      `json:"is_gov_sku"`
}

type Customer struct {
	Id      string `json:"id"`
	Name    string `json:"name"`
	Email   string `json:"email"`
	Company string `json:"company"`
}

type TrialLicenseRequest struct {
	ServerID              string `json:"server_id"`
	Email                 string `json:"email"`
	Name                  string `json:"name"`
	SiteURL               string `json:"site_url"`
	SiteName              string `json:"site_name"`
	Users                 int    `json:"users"`
	TermsAccepted         bool   `json:"terms_accepted"`
	ReceiveEmailsAccepted bool   `json:"receive_emails_accepted"`
}

type Features struct {
	Users                     *int  `json:"users"`
	LDAP                      *bool `json:"ldap"`
	LDAPGroups                *bool `json:"ldap_groups"`
	MFA                       *bool `json:"mfa"`
	GoogleOAuth               *bool `json:"google_oauth"`
	Office365OAuth            *bool `json:"office365_oauth"`
	OpenId                    *bool `json:"openid"`
	Compliance                *bool `json:"compliance"`
	Cluster                   *bool `json:"cluster"`
	Metrics                   *bool `json:"metrics"`
	MHPNS                     *bool `json:"mhpns"`
	SAML                      *bool `json:"saml"`
	Elasticsearch             *bool `json:"elastic_search"`
	Announcement              *bool `json:"announcement"`
	ThemeManagement           *bool `json:"theme_management"`
	EmailNotificationContents *bool `json:"email_notification_contents"`
	DataRetention             *bool `json:"data_retention"`
	MessageExport             *bool `json:"message_export"`
	CustomPermissionsSchemes  *bool `json:"custom_permissions_schemes"`
	CustomTermsOfService      *bool `json:"custom_terms_of_service"`
	GuestAccounts             *bool `json:"guest_accounts"`
	GuestAccountsPermissions  *bool `json:"guest_accounts_permissions"`
	IDLoadedPushNotifications *bool `json:"id_loaded"`
	LockTeammateNameDisplay   *bool `json:"lock_teammate_name_display"`
	EnterprisePlugins         *bool `json:"enterprise_plugins"`
	AdvancedLogging           *bool `json:"advanced_logging"`
	Cloud                     *bool `json:"cloud"`
	SharedChannels            *bool `json:"shared_channels"`
	RemoteClusterService      *bool `json:"remote_cluster_service"`

	// after we enabled more features we'll need to control them with this
	FutureFeatures *bool `json:"future_features"`
}

func (f *Features) ToMap() map[string]any {
	return map[string]any{
		"ldap":                        *f.LDAP,
		"ldap_groups":                 *f.LDAPGroups,
		"mfa":                         *f.MFA,
		"google":                      *f.GoogleOAuth,
		"office365":                   *f.Office365OAuth,
		"openid":                      *f.OpenId,
		"compliance":                  *f.Compliance,
		"cluster":                     *f.Cluster,
		"metrics":                     *f.Metrics,
		"mhpns":                       *f.MHPNS,
		"saml":                        *f.SAML,
		"elastic_search":              *f.Elasticsearch,
		"email_notification_contents": *f.EmailNotificationContents,
		"data_retention":              *f.DataRetention,
		"message_export":              *f.MessageExport,
		"custom_permissions_schemes":  *f.CustomPermissionsSchemes,
		"guest_accounts":              *f.GuestAccounts,
		"guest_accounts_permissions":  *f.GuestAccountsPermissions,
		"id_loaded":                   *f.IDLoadedPushNotifications,
		"lock_teammate_name_display":  *f.LockTeammateNameDisplay,
		"enterprise_plugins":          *f.EnterprisePlugins,
		"advanced_logging":            *f.AdvancedLogging,
		"cloud":                       *f.Cloud,
		"shared_channels":             *f.SharedChannels,
		"remote_cluster_service":      *f.RemoteClusterService,
		"future":                      *f.FutureFeatures,
	}
}

func (f *Features) SetDefaults() {
	if f.FutureFeatures == nil {
		f.FutureFeatures = NewBool(true)
	}

	if f.Users == nil {
		f.Users = NewInt(0)
	}

	if f.LDAP == nil {
		f.LDAP = NewBool(*f.FutureFeatures)
	}

	if f.LDAPGroups == nil {
		f.LDAPGroups = NewBool(*f.FutureFeatures)
	}

	if f.MFA == nil {
		f.MFA = NewBool(*f.FutureFeatures)
	}

	if f.GoogleOAuth == nil {
		f.GoogleOAuth = NewBool(*f.FutureFeatures)
	}

	if f.Office365OAuth == nil {
		f.Office365OAuth = NewBool(*f.FutureFeatures)
	}

	if f.OpenId == nil {
		f.OpenId = NewBool(*f.FutureFeatures)
	}

	if f.Compliance == nil {
		f.Compliance = NewBool(*f.FutureFeatures)
	}

	if f.Cluster == nil {
		f.Cluster = NewBool(*f.FutureFeatures)
	}

	if f.Metrics == nil {
		f.Metrics = NewBool(*f.FutureFeatures)
	}

	if f.MHPNS == nil {
		f.MHPNS = NewBool(*f.FutureFeatures)
	}

	if f.SAML == nil {
		f.SAML = NewBool(*f.FutureFeatures)
	}

	if f.Elasticsearch == nil {
		f.Elasticsearch = NewBool(*f.FutureFeatures)
	}

	if f.Announcement == nil {
		f.Announcement = NewBool(true)
	}

	if f.ThemeManagement == nil {
		f.ThemeManagement = NewBool(true)
	}

	if f.EmailNotificationContents == nil {
		f.EmailNotificationContents = NewBool(*f.FutureFeatures)
	}

	if f.DataRetention == nil {
		f.DataRetention = NewBool(*f.FutureFeatures)
	}

	if f.MessageExport == nil {
		f.MessageExport = NewBool(*f.FutureFeatures)
	}

	if f.CustomPermissionsSchemes == nil {
		f.CustomPermissionsSchemes = NewBool(*f.FutureFeatures)
	}

	if f.GuestAccounts == nil {
		f.GuestAccounts = NewBool(*f.FutureFeatures)
	}

	if f.GuestAccountsPermissions == nil {
		f.GuestAccountsPermissions = NewBool(*f.FutureFeatures)
	}

	if f.CustomTermsOfService == nil {
		f.CustomTermsOfService = NewBool(*f.FutureFeatures)
	}

	if f.IDLoadedPushNotifications == nil {
		f.IDLoadedPushNotifications = NewBool(*f.FutureFeatures)
	}

	if f.LockTeammateNameDisplay == nil {
		f.LockTeammateNameDisplay = NewBool(*f.FutureFeatures)
	}

	if f.EnterprisePlugins == nil {
		f.EnterprisePlugins = NewBool(*f.FutureFeatures)
	}

	if f.AdvancedLogging == nil {
		f.AdvancedLogging = NewBool(*f.FutureFeatures)
	}

	if f.Cloud == nil {
		f.Cloud = NewBool(false)
	}

	if f.SharedChannels == nil {
		f.SharedChannels = NewBool(*f.FutureFeatures)
	}

	if f.RemoteClusterService == nil {
		f.RemoteClusterService = NewBool(*f.FutureFeatures)
	}
}

func (l *License) IsExpired() bool {
	return l.ExpiresAt < GetMillis()
}

func (l *License) IsPastGracePeriod() bool {
	timeDiff := GetMillis() - l.ExpiresAt
	return timeDiff > LicenseGracePeriod
}

func (l *License) IsWithinExpirationPeriod() bool {
	days := l.DaysToExpiration()
	return days <= 60 && days >= 58
}

func (l *License) DaysToExpiration() int {
	dif := l.ExpiresAt - GetMillis()
	d, _ := time.ParseDuration(fmt.Sprint(dif) + "ms")
	days := d.Hours() / 24
	return int(days)
}

func (l *License) IsStarted() bool {
	return l.StartsAt < GetMillis()
}

func (l *License) IsCloud() bool {
	return l != nil && l.Features != nil && l.Features.Cloud != nil && *l.Features.Cloud
}

func (l *License) IsTrialLicense() bool {
	return l.IsTrial || (l.ExpiresAt-l.StartsAt) == trialDuration.Milliseconds() || (l.ExpiresAt-l.StartsAt) == adminTrialDuration.Milliseconds()
}

func (l *License) IsSanctionedTrial() bool {
	duration := l.ExpiresAt - l.StartsAt

	return l.IsTrialLicense() &&
		(duration >= sanctionedTrialDurationLowerBound.Milliseconds() || duration <= sanctionedTrialDurationUpperBound.Milliseconds())
}

func (l *License) HasEnterpriseMarketplacePlugins() bool {
	return *l.Features.EnterprisePlugins ||
		l.SkuShortName == LicenseShortSkuE20 ||
		l.SkuShortName == LicenseShortSkuProfessional ||
		l.SkuShortName == LicenseShortSkuEnterprise
}

// NewTestLicense returns a license that expires in the future and has the given features.
func NewTestLicense(features ...string) *License {
	ret := &License{
		ExpiresAt: GetMillis() + 90*DayInMilliseconds,
		Customer:  &Customer{},
		Features:  &Features{},
	}
	ret.Features.SetDefaults()

	featureMap := map[string]bool{}
	for _, feature := range features {
		featureMap[feature] = true
	}
	featureJson, _ := json.Marshal(featureMap)
	json.Unmarshal(featureJson, &ret.Features)

	return ret
}

// NewTestLicense returns a license that expires in the future and set as false the given features.
func NewTestLicenseWithFalseDefaults(features ...string) *License {
	ret := &License{
		ExpiresAt: GetMillis() + 90*DayInMilliseconds,
		Customer:  &Customer{},
		Features:  &Features{},
	}
	ret.Features.SetDefaults()

	featureMap := map[string]bool{}
	for _, feature := range features {
		featureMap[feature] = false
	}
	featureJson, _ := json.Marshal(featureMap)
	json.Unmarshal(featureJson, &ret.Features)

	return ret
}

func NewTestLicenseSKU(skuShortName string, features ...string) *License {
	lic := NewTestLicense(features...)
	lic.SkuShortName = skuShortName
	return lic
}

func (lr *LicenseRecord) IsValid() *AppError {
	if !IsValidId(lr.Id) {
		return NewAppError("LicenseRecord.IsValid", "model.license_record.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if lr.CreateAt == 0 {
		return NewAppError("LicenseRecord.IsValid", "model.license_record.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	if lr.Bytes == "" || len(lr.Bytes) > 10000 {
		return NewAppError("LicenseRecord.IsValid", "model.license_record.is_valid.create_at.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func (lr *LicenseRecord) PreSave() {
	lr.CreateAt = GetMillis()
}
