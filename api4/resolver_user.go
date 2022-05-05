// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/http"

	"github.com/graph-gophers/dataloader/v6"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/web"
)

// user is an internal graphQL wrapper struct to add resolver methods.
type user struct {
	model.User
}

// match with api4.getUser
func getGraphQLUser(ctx context.Context, id string) (*user, error) {
	c, err := getCtx(ctx)
	if err != nil {
		return nil, err
	}

	if id == model.Me {
		id = c.AppContext.Session().UserId
	}

	if !model.IsValidId(id) {
		return nil, web.NewInvalidParamError("user_id")
	}

	canSee, appErr := c.App.UserCanSeeOtherUser(c.AppContext.Session().UserId, id)
	if appErr != nil || !canSee {
		c.SetPermissionError(model.PermissionViewMembers)
		return nil, c.Err
	}

	usr, appErr := c.App.GetUser(id)
	if appErr != nil {
		return nil, appErr
	}

	if c.IsSystemAdmin() || c.AppContext.Session().UserId == usr.Id {
		userTermsOfService, appErr := c.App.GetUserTermsOfService(usr.Id)
		if appErr != nil && appErr.StatusCode != http.StatusNotFound {
			return nil, appErr
		}

		if userTermsOfService != nil {
			usr.TermsOfServiceId = userTermsOfService.TermsOfServiceId
			usr.TermsOfServiceCreateAt = userTermsOfService.CreateAt
		}
	}

	if c.AppContext.Session().UserId == usr.Id {
		usr.Sanitize(map[string]bool{})
	} else {
		c.App.SanitizeProfile(usr, c.IsSystemAdmin())
	}
	c.App.UpdateLastActivityAtIfNeeded(*c.AppContext.Session())

	return &user{*usr}, nil
}

// match with api4.getRolesByNames
func (u *user) Roles(ctx context.Context) ([]*model.Role, error) {
	roleNames := u.GetRoles()
	if len(roleNames) == 0 {
		return nil, nil
	}

	loader, err := getRolesLoader(ctx)
	if err != nil {
		return nil, err
	}

	thunk := loader.LoadMany(ctx, dataloader.NewKeysFromStrings(roleNames))
	results, errs := thunk()
	// All errors are the same. We just return the first one.
	if len(errs) > 0 && errs[0] != nil {
		return nil, err
	}

	roles := make([]*model.Role, len(results))
	for i, res := range results {
		roles[i] = res.(*model.Role)
	}

	return roles, nil
}

// match with api4.getPreferences
func (u *user) Preferences(ctx context.Context) ([]model.Preference, error) {
	c, err := getCtx(ctx)
	if err != nil {
		return nil, err
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), u.Id) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return nil, c.Err
	}

	preferences, appErr := c.App.GetPreferencesForUser(u.Id)
	if appErr != nil {
		return nil, appErr
	}
	return preferences, nil
}

// match with api4.getUserStatus
func (u *user) Status(ctx context.Context) (*model.Status, error) {
	c, err := getCtx(ctx)
	if err != nil {
		return nil, err
	}

	statuses, appErr := c.App.GetUserStatusesByIds([]string{u.Id})
	if appErr != nil {
		return nil, appErr
	}

	if len(statuses) == 0 {
		return nil, model.NewAppError("UserStatus", "api.status.user_not_found.app_error", nil, "", http.StatusNotFound)
	}

	return statuses[0], nil
}

// match with api4.getSessions
func (u *user) Sessions(ctx context.Context) ([]*model.Session, error) {
	c, err := getCtx(ctx)
	if err != nil {
		return nil, err
	}

	if !c.App.SessionHasPermissionToUser(*c.AppContext.Session(), u.Id) {
		c.SetPermissionError(model.PermissionEditOtherUsers)
		return nil, c.Err
	}

	sessions, appErr := c.App.GetSessions(u.Id)
	if appErr != nil {
		return nil, appErr
	}

	for _, session := range sessions {
		session.Sanitize()
	}

	return sessions, nil
}
