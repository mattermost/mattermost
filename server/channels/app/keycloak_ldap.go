// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package app – KeycloakLdap implements einterfaces.LdapInterface for group
// management backed by the Keycloak Admin REST API. User authentication is
// handled by the OIDC provider; only group-related methods are real.
package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// KeycloakLdap implements einterfaces.LdapInterface using the Keycloak Admin
// REST API for group operations. It is registered as ch.Ldap when no
// enterprise LDAP plugin is present, so standard group-sync UI works.
type KeycloakLdap struct {
	app *App
}

// NewKeycloakLdap creates a KeycloakLdap backed by the given App.
func NewKeycloakLdap(a *App) *KeycloakLdap {
	return &KeycloakLdap{app: a}
}

// ─── Keycloak Admin API helpers ──────────────────────────────────────────────

type kcGroup struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Path      string    `json:"path"`
	SubGroups []kcGroup `json:"subGroups"`
}

type kcTokenResp struct {
	AccessToken string `json:"access_token"`
}

// adminBase derives the Keycloak Admin API base URL from DiscoveryEndpoint.
// https://kc/realms/corp/.well-known/openid-configuration → https://kc/admin/realms/corp
func (k *KeycloakLdap) adminBase() (string, error) {
	disc := model.SafeDereference(k.app.Config().OpenIdSettings.DiscoveryEndpoint)
	if disc == "" {
		return "", fmt.Errorf("OpenIdSettings.DiscoveryEndpoint is not configured")
	}
	u, err := url.Parse(disc)
	if err != nil {
		return "", err
	}
	p := strings.TrimSuffix(u.Path, "/.well-known/openid-configuration")
	p = strings.Replace(p, "/realms/", "/admin/realms/", 1)
	u.Path = p
	return u.String(), nil
}

// tokenURL derives the OIDC token endpoint from DiscoveryEndpoint.
func (k *KeycloakLdap) tokenURL() (string, error) {
	disc := model.SafeDereference(k.app.Config().OpenIdSettings.DiscoveryEndpoint)
	if disc == "" {
		return "", fmt.Errorf("OpenIdSettings.DiscoveryEndpoint is not configured")
	}
	u, err := url.Parse(disc)
	if err != nil {
		return "", err
	}
	p := strings.TrimSuffix(u.Path, "/.well-known/openid-configuration")
	u.Path = p + "/protocol/openid-connect/token"
	return u.String(), nil
}

var httpClient = &http.Client{Timeout: 15 * time.Second}

// getAdminToken fetches a service-account token via client_credentials using
// the same client ID / secret as the OIDC login flow.
func (k *KeycloakLdap) getAdminToken() (string, error) {
	tokenURL, err := k.tokenURL()
	if err != nil {
		return "", err
	}
	cfg := k.app.Config().OpenIdSettings
	resp, err := httpClient.PostForm(tokenURL, url.Values{
		"grant_type":    {"client_credentials"},
		"client_id":     {model.SafeDereference(cfg.Id)},
		"client_secret": {model.SafeDereference(cfg.Secret)},
	})
	if err != nil {
		return "", fmt.Errorf("keycloak token request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("keycloak token request failed: %s", resp.Status)
	}
	var t kcTokenResp
	if err := json.NewDecoder(resp.Body).Decode(&t); err != nil {
		return "", err
	}
	return t.AccessToken, nil
}

// fetchGroups calls GET /admin/realms/{realm}/groups with optional search,
// pagination, and returns a flat list (top-level + subgroups flattened).
func (k *KeycloakLdap) fetchGroups(token, query string, first, max int) ([]kcGroup, error) {
	base, err := k.adminBase()
	if err != nil {
		return nil, err
	}
	params := url.Values{
		"first":               {fmt.Sprintf("%d", first)},
		"max":                 {fmt.Sprintf("%d", max)},
		"briefRepresentation": {"true"},
	}
	if query != "" {
		params.Set("search", query)
	}
	req, err := http.NewRequest(http.MethodGet, base+"/groups?"+params.Encode(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("keycloak groups request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("keycloak groups request failed: %s", resp.Status)
	}
	var groups []kcGroup
	if err := json.NewDecoder(resp.Body).Decode(&groups); err != nil {
		return nil, err
	}
	return flattenGroups(groups), nil
}

// fetchGroupCount calls GET /admin/realms/{realm}/groups/count.
// Returns -1 if the endpoint is not available (Keycloak < 14).
func (k *KeycloakLdap) fetchGroupCount(token, query string) int {
	base, err := k.adminBase()
	if err != nil {
		return -1
	}
	params := url.Values{}
	if query != "" {
		params.Set("search", query)
	}
	req, err := http.NewRequest(http.MethodGet, base+"/groups/count?"+params.Encode(), nil)
	if err != nil {
		return -1
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := httpClient.Do(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		return -1
	}
	defer resp.Body.Close()
	var body struct {
		Count int `json:"count"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return -1
	}
	return body.Count
}

// flattenGroups recursively flattens nested Keycloak subgroups into a single list.
func flattenGroups(groups []kcGroup) []kcGroup {
	var result []kcGroup
	for _, g := range groups {
		result = append(result, g)
		if len(g.SubGroups) > 0 {
			result = append(result, flattenGroups(g.SubGroups)...)
		}
	}
	return result
}

var nonAlphanumHyphen = regexp.MustCompile(`[^a-z0-9-]`)

// kcGroupToModel converts a Keycloak group to a Mattermost model.Group.
// RemoteId is the Keycloak group UUID; Name is a sanitised slug.
func kcGroupToModel(g kcGroup) *model.Group {
	slug := strings.ToLower(strings.ReplaceAll(g.Name, " ", "-"))
	slug = nonAlphanumHyphen.ReplaceAllString(slug, "")
	if len(slug) > 64 {
		slug = slug[:64]
	}
	if slug == "" {
		slug = "group-" + g.ID[:8]
	}
	remoteID := g.ID
	return &model.Group{
		DisplayName: g.Name,
		Name:        &slug,
		Source:      model.GroupSourceLdap,
		RemoteId:    &remoteID,
		Description: g.Path,
	}
}

// IsKeycloakProvider signals that this LdapInterface implementation is backed
// by the Keycloak Admin API rather than a real LDAP server. The API layer uses
// this to skip the enterprise-license LDAPGroups gate.
func (k *KeycloakLdap) IsKeycloakProvider() bool { return true }

// ─── LdapInterface: group methods ────────────────────────────────────────────

// GetAllGroupsPage searches Keycloak groups and returns a paginated list.
func (k *KeycloakLdap) GetAllGroupsPage(rctx request.CTX, page, perPage int, opts model.LdapGroupSearchOpts) ([]*model.Group, int, *model.AppError) {
	token, err := k.getAdminToken()
	if err != nil {
		rctx.Logger().Error("KeycloakLdap.GetAllGroupsPage: failed to get admin token", mlog.Err(err))
		return nil, 0, model.NewAppError("KeycloakLdap.GetAllGroupsPage", "app.keycloak_ldap.token.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	total := k.fetchGroupCount(token, opts.Q)

	groups, err := k.fetchGroups(token, opts.Q, page*perPage, perPage)
	if err != nil {
		rctx.Logger().Error("KeycloakLdap.GetAllGroupsPage: failed to fetch groups", mlog.Err(err))
		return nil, 0, model.NewAppError("KeycloakLdap.GetAllGroupsPage", "app.keycloak_ldap.groups.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	result := make([]*model.Group, len(groups))
	for i, g := range groups {
		result[i] = kcGroupToModel(g)
	}

	if total < 0 {
		// count endpoint not available — estimate from page data
		total = page*perPage + len(groups)
		if len(groups) == perPage {
			total++
		}
	}
	return result, total, nil
}

// GetGroup fetches a single Keycloak group by its UUID (RemoteId).
func (k *KeycloakLdap) GetGroup(rctx request.CTX, groupUID string) (*model.Group, *model.AppError) {
	base, err := k.adminBase()
	if err != nil {
		return nil, model.NewAppError("KeycloakLdap.GetGroup", "app.keycloak_ldap.groups.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	token, err := k.getAdminToken()
	if err != nil {
		return nil, model.NewAppError("KeycloakLdap.GetGroup", "app.keycloak_ldap.token.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	req, err := http.NewRequest(http.MethodGet, base+"/groups/"+groupUID, nil)
	if err != nil {
		return nil, model.NewAppError("KeycloakLdap.GetGroup", "app.keycloak_ldap.groups.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, model.NewAppError("KeycloakLdap.GetGroup", "app.keycloak_ldap.groups.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, model.NewAppError("KeycloakLdap.GetGroup", "app.keycloak_ldap.group_not_found.app_error", nil, groupUID, http.StatusNotFound)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, model.NewAppError("KeycloakLdap.GetGroup", "app.keycloak_ldap.groups.app_error", nil, resp.Status, http.StatusInternalServerError)
	}
	var g kcGroup
	if err := json.NewDecoder(resp.Body).Decode(&g); err != nil {
		return nil, model.NewAppError("KeycloakLdap.GetGroup", "app.keycloak_ldap.groups.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return kcGroupToModel(g), nil
}

// ─── LdapInterface: user auth stubs (handled by OIDC, not LDAP) ─────────────

func kcNotSupported(method string) *model.AppError {
	return model.NewAppError(method, "app.keycloak_ldap.not_supported.app_error", nil,
		"user auth is handled by OIDC, not LDAP", http.StatusNotImplemented)
}

func (k *KeycloakLdap) DoLogin(rctx request.CTX, id, password string) (*model.User, *model.AppError) {
	return nil, kcNotSupported("KeycloakLdap.DoLogin")
}
func (k *KeycloakLdap) GetUser(rctx request.CTX, id string) (*model.User, *model.AppError) {
	return nil, kcNotSupported("KeycloakLdap.GetUser")
}
func (k *KeycloakLdap) GetLDAPUserForMMUser(rctx request.CTX, mmUser *model.User) (*model.User, string, *model.AppError) {
	return nil, "", kcNotSupported("KeycloakLdap.GetLDAPUserForMMUser")
}
func (k *KeycloakLdap) GetUserAttributes(rctx request.CTX, id string, attributes []string) (map[string]string, *model.AppError) {
	return nil, kcNotSupported("KeycloakLdap.GetUserAttributes")
}
func (k *KeycloakLdap) CheckProviderAttributes(_ request.CTX, _ *model.LdapSettings, _ *model.User, _ *model.UserPatch) string {
	return ""
}
func (k *KeycloakLdap) SwitchToLdap(rctx request.CTX, userID, ldapID, ldapPassword string) *model.AppError {
	return kcNotSupported("KeycloakLdap.SwitchToLdap")
}
func (k *KeycloakLdap) StartSynchronizeJob(rctx request.CTX, _ bool) (*model.Job, *model.AppError) {
	return k.app.Srv().Jobs.CreateJob(rctx, model.JobTypeLdapSync, nil)
}
func (k *KeycloakLdap) GetAllLdapUsers(_ request.CTX) ([]*model.User, *model.AppError) {
	return []*model.User{}, nil
}
func (k *KeycloakLdap) MigrateIDAttribute(_ request.CTX, _ string) error { return nil }
func (k *KeycloakLdap) FirstLoginSync(_ request.CTX, _ *model.User) *model.AppError { return nil }
func (k *KeycloakLdap) UpdateProfilePictureIfNecessary(_ request.CTX, _ model.User, _ model.Session) {
}
