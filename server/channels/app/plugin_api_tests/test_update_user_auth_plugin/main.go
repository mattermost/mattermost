// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/v8/channels/app/plugin_api_tests"
)

type MyPlugin struct {
	plugin.MattermostPlugin
	configuration plugin_api_tests.BasicConfig
}

func (p *MyPlugin) OnConfigurationChange() error {
	if err := p.API.LoadPluginConfiguration(&p.configuration); err != nil {
		return err
	}
	return nil
}

func (p *MyPlugin) expectUserAuth(userID string, expectedUserAuth *model.UserAuth) error {
	user, err := p.API.GetUser(userID)
	if err != nil {
		return err
	}
	if user.AuthService != expectedUserAuth.AuthService {
		return fmt.Errorf("expected '%s' got '%s'", expectedUserAuth.AuthService, user.AuthService)
	}
	if user.AuthData == nil && expectedUserAuth.AuthData != nil {
		return fmt.Errorf("expected '%s' got nil", *expectedUserAuth.AuthData)
	} else if user.AuthData != nil && expectedUserAuth.AuthData == nil {
		return fmt.Errorf("expected nil got '%s'", *user.AuthData)
	} else if user.AuthData != nil && expectedUserAuth.AuthData != nil && *user.AuthData != *expectedUserAuth.AuthData {
		return fmt.Errorf("expected '%s' got '%s'", *expectedUserAuth.AuthData, *user.AuthData)
	}

	return nil
}

func (p *MyPlugin) MessageWillBePosted(_ *plugin.Context, _ *model.Post) (*model.Post, string) {
	// BasicUser2 should remain unchanged throughout
	user, appErr := p.API.GetUser(p.configuration.BasicUser2Id)
	if appErr != nil {
		return nil, appErr.Error()
	}
	expectedUser2Auth := &model.UserAuth{
		AuthService: user.AuthService,
		AuthData:    user.AuthData,
	}

	// Update BasicUser to SAML
	expectedUserAuth := &model.UserAuth{
		AuthService: model.UserAuthServiceSaml,
		AuthData:    model.NewPointer("saml_auth_data"),
	}
	_, appErr = p.API.UpdateUserAuth(p.configuration.BasicUserID, expectedUserAuth)
	if appErr != nil {
		return nil, appErr.Error()
	}

	err := p.expectUserAuth(p.configuration.BasicUserID, expectedUserAuth)
	if err != nil {
		return nil, err.Error()
	}
	err = p.expectUserAuth(p.configuration.BasicUser2Id, expectedUser2Auth)
	if err != nil {
		return nil, err.Error()
	}

	// Update BasicUser to LDAP
	expectedUserAuth = &model.UserAuth{
		AuthService: model.UserAuthServiceLdap,
		AuthData:    model.NewPointer("ldap_auth_data"),
	}
	_, appErr = p.API.UpdateUserAuth(p.configuration.BasicUserID, expectedUserAuth)
	if appErr != nil {
		return nil, appErr.Error()
	}

	err = p.expectUserAuth(p.configuration.BasicUserID, expectedUserAuth)
	if err != nil {
		return nil, err.Error()
	}
	err = p.expectUserAuth(p.configuration.BasicUser2Id, expectedUser2Auth)
	if err != nil {
		return nil, err.Error()
	}

	return nil, "OK"
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
