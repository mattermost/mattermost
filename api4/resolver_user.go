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

	loader, err := getUsersLoader(ctx)
	if err != nil {
		return nil, err
	}

	thunk := loader.Load(ctx, dataloader.StringKey(id))
	result, err := thunk()
	if err != nil {
		return nil, err
	}
	usr := result.(*model.User)

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

func graphQLUsersLoader(ctx context.Context, keys dataloader.Keys) []*dataloader.Result {
	stringKeys := keys.Keys()
	result := make([]*dataloader.Result, len(stringKeys))

	c, err := getCtx(ctx)
	if err != nil {
		for i := range result {
			result[i] = &dataloader.Result{Error: err}
		}
		return result
	}

	users, err := getGraphQLUsers(c, stringKeys)
	if err != nil {
		for i := range result {
			result[i] = &dataloader.Result{Error: err}
		}
		return result
	}

	for i, user := range users {
		result[i] = &dataloader.Result{Data: user}
	}

	return result
}

func getGraphQLUsers(c *web.Context, userIDs []string) ([]*model.User, error) {
	// Usually this will be called only for one user
	// and cached for the rest of the query. So it's not an issue
	// to run this in a loop.
	for _, id := range userIDs {
		canSee, appErr := c.App.UserCanSeeOtherUser(c.AppContext.Session().UserId, id)
		if appErr != nil || !canSee {
			c.SetPermissionError(model.PermissionViewMembers)
			return nil, c.Err
		}
	}

	users, appErr := c.App.GetUsers(userIDs)
	if appErr != nil {
		return nil, appErr
	}

	// Same as earlier, we want to pre-compute this only once
	// because otherwise the resolvers run in multiple goroutines
	// and *User.Sanitize causes a race, and we want to avoid
	// deep-copying every user in all goroutines.
	for _, user := range users {
		if c.AppContext.Session().UserId == user.Id {
			user.Sanitize(map[string]bool{})
		} else {
			c.App.SanitizeProfile(user, c.IsSystemAdmin())
		}
	}

	// The users need to be in the exact same order as the input slice.
	tmp := make(map[string]*model.User)
	for _, u := range users {
		tmp[u.Id] = u
	}

	// We reuse the same slice and just rewrite the roles.
	for i, uID := range userIDs {
		users[i] = tmp[uID]
	}

	return users, nil
}
