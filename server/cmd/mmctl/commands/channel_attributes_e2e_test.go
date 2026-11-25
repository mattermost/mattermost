// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build e2e

package commands

import (
	"encoding/json"

	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

// setupChannelAttributesHelper builds a helper with the channel attribute flags
// on from the start: the property routes are registered at startup.
func (s *MmctlE2ETestSuite) setupChannelAttributesHelper() {
	s.SetupTestHelperWithConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.ChannelAttributes = true
		cfg.FeatureFlags.ChannelAttributesRequired = true
	}).InitBasic(s.T())
	s.th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
}

// createChannelAttribute creates a channel attribute through the property
// service, which unlike the API accepts a required field while active channels
// still lack a value. It returns the field and its option IDs by name. A
// required field applies to every channel, so each one lives for one subtest.
func (s *MmctlE2ETestSuite) createChannelAttribute(fieldType model.PropertyFieldType, level model.PermissionLevel, required bool, optionNames ...string) (*model.PropertyField, map[string]string) {
	s.T().Helper()

	group, appErr := s.th.App.GetPropertyGroup(s.th.Context, model.AccessControlPropertyGroupName)
	s.Require().Nil(appErr)

	attrs := model.StringInterface{}
	optionIDs := make(map[string]string, len(optionNames))
	if len(optionNames) > 0 {
		options := make([]map[string]any, 0, len(optionNames))
		for _, name := range optionNames {
			id := model.NewId()
			optionIDs[name] = id
			options = append(options, map[string]any{"id": id, "name": name})
		}
		attrs[model.PropertyFieldAttributeOptions] = options
	}
	if required {
		attrs[model.PropertyFieldAttrRequired] = true
	}

	memberLevel := model.PermissionLevelMember
	field, err := s.th.App.Srv().PropertyService().CreatePropertyField(s.th.Context, &model.PropertyField{
		Name:              "attr_" + model.NewId(),
		Type:              fieldType,
		GroupID:           group.ID,
		ObjectType:        model.PropertyFieldObjectTypeChannel,
		TargetType:        model.PropertyValueTargetTypeSystem,
		PermissionField:   &memberLevel,
		PermissionValues:  &level,
		PermissionOptions: &memberLevel,
		Attrs:             attrs,
	})
	s.Require().NoError(err)
	s.T().Cleanup(func() {
		s.Require().Nil(s.th.App.DeletePropertyField(s.th.Context, group.ID, field.ID, true, ""))
	})
	return field, optionIDs
}

// channelAttributeValue returns the raw value the channel holds for the field,
// read through the app so the check doesn't depend on the client under test.
func (s *MmctlE2ETestSuite) channelAttributeValue(channelID, fieldID string) json.RawMessage {
	s.T().Helper()

	group, appErr := s.th.App.GetPropertyGroup(s.th.Context, model.AccessControlPropertyGroupName)
	s.Require().Nil(appErr)
	values, appErr := s.th.App.SearchPropertyValues(s.th.Context, group.ID, model.PropertyValueSearchOpts{
		TargetType: model.PropertyValueTargetTypeChannel,
		TargetIDs:  []string{channelID},
		FieldID:    fieldID,
		PerPage:    20,
	})
	s.Require().Nil(appErr)
	if len(values) == 0 {
		return nil
	}
	return values[0].Value
}

func (s *MmctlE2ETestSuite) newChannelAttributeCreateCmd(name string, attributes ...string) *cobra.Command {
	s.T().Helper()

	cmd := newTestCmd(s.T(), ChannelCreateCmd)
	s.Require().NoError(cmd.Flags().Set("name", name))
	s.Require().NoError(cmd.Flags().Set("display-name", name))
	s.Require().NoError(cmd.Flags().Set("team", s.th.BasicTeam.Name))
	for _, attribute := range attributes {
		s.Require().NoError(cmd.Flags().Set("attribute", attribute))
	}
	return cmd
}

func (s *MmctlE2ETestSuite) newChannelAttributeModifyCmd(attributes ...string) *cobra.Command {
	s.T().Helper()

	cmd := newTestCmd(s.T(), ModifyChannelCmd)
	s.Require().NoError(cmd.Flags().Set("private", "true"))
	for _, attribute := range attributes {
		s.Require().NoError(cmd.Flags().Set("attribute", attribute))
	}
	return cmd
}

func (s *MmctlE2ETestSuite) newChannelAttributeUnarchiveCmd(attributes ...string) *cobra.Command {
	s.T().Helper()

	cmd := newTestCmd(s.T(), UnarchiveChannelCmd)
	for _, attribute := range attributes {
		s.Require().NoError(cmd.Flags().Set("attribute", attribute))
	}
	return cmd
}

func (s *MmctlE2ETestSuite) newChannelAttributeSetCmd(attributes ...string) *cobra.Command {
	s.T().Helper()

	cmd := newTestCmd(s.T(), ChannelAttributesSetCmd)
	for _, attribute := range attributes {
		s.Require().NoError(cmd.Flags().Set("attribute", attribute))
	}
	return cmd
}

func (s *MmctlE2ETestSuite) TestChannelAttributeValues() {
	s.setupChannelAttributesHelper()
	adminLevel := model.PermissionLevelAdmin
	memberLevel := model.PermissionLevelMember
	sysadminLevel := model.PermissionLevelSysadmin

	s.RunForSystemAdminAndLocal("create without the required attribute is refused", func(c client.Client) {
		field, _ := s.createChannelAttribute(model.PropertyFieldTypeSelect, adminLevel, true, "Alpha", "Beta")

		name := "attr-" + model.NewId()
		err := createChannelCmdF(c, s.newChannelAttributeCreateCmd(name), nil)
		s.Require().Error(err)
		s.CheckErrorID(err, missingRequiredAttributesErrorID)
		s.Require().Contains(err.Error(), "Required channel attributes not passed: ")
		s.Require().Contains(err.Error(), field.Name)
		s.Require().Empty(printer.GetLines())

		_, appErr := s.th.App.GetChannelByName(s.th.Context, name, s.th.BasicTeam.Id, false)
		s.Require().NotNil(appErr)
	})

	s.RunForSystemAdminAndLocal("create with the required attribute", func(c client.Client) {
		field, options := s.createChannelAttribute(model.PropertyFieldTypeSelect, adminLevel, true, "Alpha", "Beta")

		name := "attr-" + model.NewId()
		err := createChannelCmdF(c, s.newChannelAttributeCreateCmd(name, field.Name+"=Beta"), nil)
		s.Require().NoError(err)
		s.Require().Empty(printer.GetErrorLines())
		s.Require().Len(printer.GetLines(), 1)

		channel, appErr := s.th.App.GetChannelByName(s.th.Context, name, s.th.BasicTeam.Id, false)
		s.Require().Nil(appErr)
		s.Require().JSONEq(`"`+options["Beta"]+`"`, string(s.channelAttributeValue(channel.Id, field.ID)))
	})

	s.RunForSystemAdminAndLocal("create without any required attribute", func(c client.Client) {
		name := "attr-" + model.NewId()
		err := createChannelCmdF(c, s.newChannelAttributeCreateCmd(name), nil)
		s.Require().NoError(err)

		_, appErr := s.th.App.GetChannelByName(s.th.Context, name, s.th.BasicTeam.Id, false)
		s.Require().Nil(appErr)
	})

	s.RunForSystemAdminAndLocal("create with an unknown option sends nothing", func(c client.Client) {
		field, _ := s.createChannelAttribute(model.PropertyFieldTypeSelect, adminLevel, true, "Alpha")

		name := "attr-" + model.NewId()
		err := createChannelCmdF(c, s.newChannelAttributeCreateCmd(name, field.Name+"=Gamma"), nil)
		s.Require().ErrorContains(err, `unknown option "Gamma"`)

		_, appErr := s.th.App.GetChannelByName(s.th.Context, name, s.th.BasicTeam.Id, false)
		s.Require().NotNil(appErr)
	})

	s.RunForSystemAdminAndLocal("channel attributes fields lists the field as required", func(c client.Client) {
		required, _ := s.createChannelAttribute(model.PropertyFieldTypeSelect, adminLevel, true, "Alpha", "Beta")
		optional, _ := s.createChannelAttribute(model.PropertyFieldTypeText, adminLevel, false)

		printer.SetFormat(printer.FormatPlain)
		s.T().Cleanup(func() { printer.SetFormat(printer.FormatJSON) })

		err := channelAttributesFieldsCmdF(c, newTestCmd(s.T(), ChannelAttributesFieldsCmd), nil)
		s.Require().NoError(err)
		s.Require().Contains(printer.GetLines(), required.Name+" (select, required): Alpha, Beta")
		s.Require().Contains(printer.GetLines(), optional.Name+" (text)")
	})

	s.RunForSystemAdminAndLocal("channel attributes list and set", func(c client.Client) {
		field, options := s.createChannelAttribute(model.PropertyFieldTypeSelect, adminLevel, false, "Alpha", "Beta")
		channel := s.th.BasicChannel
		target := s.th.BasicTeam.Name + ":" + channel.Name

		printer.SetFormat(printer.FormatPlain)
		s.T().Cleanup(func() { printer.SetFormat(printer.FormatJSON) })

		err := channelAttributesListCmdF(c, newTestCmd(s.T(), ChannelAttributesListCmd), []string{target})
		s.Require().NoError(err)
		s.Require().Empty(printer.GetLines())

		err = channelAttributesSetCmdF(c, s.newChannelAttributeSetCmd(field.Name+"=Alpha"), []string{target})
		s.Require().NoError(err)
		s.Require().Equal([]any{field.Name + ": Alpha"}, printer.GetLines())
		s.Require().JSONEq(`"`+options["Alpha"]+`"`, string(s.channelAttributeValue(channel.Id, field.ID)))

		printer.Clean()
		err = channelAttributesListCmdF(c, newTestCmd(s.T(), ChannelAttributesListCmd), []string{target})
		s.Require().NoError(err)
		s.Require().Equal([]any{field.Name + ": Alpha"}, printer.GetLines())

		printer.Clean()
		err = channelAttributesSetCmdF(c, s.newChannelAttributeSetCmd(field.Name+"=Beta"), []string{target})
		s.Require().NoError(err)
		s.Require().Equal([]any{field.Name + ": Beta"}, printer.GetLines())
		s.Require().JSONEq(`"`+options["Beta"]+`"`, string(s.channelAttributeValue(channel.Id, field.ID)))
	})

	s.RunForSystemAdminAndLocal("channel attributes list prints JSON with the option resolved", func(c client.Client) {
		field, options := s.createChannelAttribute(model.PropertyFieldTypeSelect, adminLevel, false, "Alpha")
		channel := s.th.BasicChannel2
		target := s.th.BasicTeam.Name + ":" + channel.Name

		err := channelAttributesSetCmdF(c, s.newChannelAttributeSetCmd(field.Name+"=Alpha"), []string{target})
		s.Require().NoError(err)

		printer.Clean()
		err = channelAttributesListCmdF(c, newTestCmd(s.T(), ChannelAttributesListCmd), []string{target})
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)
		line := printer.GetLines()[0].(channelAttributeValueOutput)
		s.Require().Equal(field.ID, line.FieldID)
		s.Require().Equal(field.Name, line.FieldName)
		s.Require().Equal(channelAttributeOptionOutput{ID: options["Alpha"], Name: "Alpha"}, line.Value)
	})

	s.RunForSystemAdminAndLocal("create and set with a graph attribute", func(c client.Client) {
		field, options := s.createChannelAttribute(model.PropertyFieldTypeGraph, adminLevel, false, "Company", "Engineering", "Sales")

		name := "attr-" + model.NewId()
		err := createChannelCmdF(c, s.newChannelAttributeCreateCmd(name, field.Name+"=Engineering", field.Name+"=company", field.Name+"="+options["Engineering"]), nil)
		s.Require().NoError(err)
		s.Require().Empty(printer.GetErrorLines())

		channel, appErr := s.th.App.GetChannelByName(s.th.Context, name, s.th.BasicTeam.Id, false)
		s.Require().Nil(appErr)
		s.Require().JSONEq(`["`+options["Engineering"]+`","`+options["Company"]+`"]`, string(s.channelAttributeValue(channel.Id, field.ID)))

		printer.SetFormat(printer.FormatPlain)
		s.T().Cleanup(func() { printer.SetFormat(printer.FormatJSON) })
		printer.Clean()
		target := s.th.BasicTeam.Name + ":" + name
		err = channelAttributesSetCmdF(c, s.newChannelAttributeSetCmd(field.Name+"=Sales"), []string{target})
		s.Require().NoError(err)
		s.Require().Equal([]any{field.Name + ": Sales"}, printer.GetLines())
		s.Require().JSONEq(`["`+options["Sales"]+`"]`, string(s.channelAttributeValue(channel.Id, field.ID)))

		printer.Clean()
		err = channelAttributesListCmdF(c, newTestCmd(s.T(), ChannelAttributesListCmd), []string{target})
		s.Require().NoError(err)
		s.Require().Equal([]any{field.Name + ": Sales"}, printer.GetLines())

		printer.Clean()
		err = channelAttributesFieldsCmdF(c, newTestCmd(s.T(), ChannelAttributesFieldsCmd), nil)
		s.Require().NoError(err)
		s.Require().Contains(printer.GetLines(), field.Name+" (graph): Company, Engineering, Sales")
	})

	s.Run("regular user creates with a member-level required attribute", func() {
		field, options := s.createChannelAttribute(model.PropertyFieldTypeSelect, memberLevel, true, "Alpha", "Beta")

		name := "attr-" + model.NewId()
		err := createChannelCmdF(s.th.Client, s.newChannelAttributeCreateCmd(name, field.Name+"=Alpha"), nil)
		s.Require().NoError(err)

		channel, appErr := s.th.App.GetChannelByName(s.th.Context, name, s.th.BasicTeam.Id, false)
		s.Require().Nil(appErr)
		s.Require().JSONEq(`"`+options["Alpha"]+`"`, string(s.channelAttributeValue(channel.Id, field.ID)))
	})

	s.Run("regular user isn't asked for a sysadmin-level required attribute", func() {
		field, _ := s.createChannelAttribute(model.PropertyFieldTypeSelect, sysadminLevel, true, "Alpha")

		name := "attr-" + model.NewId()
		err := createChannelCmdF(s.th.Client, s.newChannelAttributeCreateCmd(name), nil)
		s.Require().NoError(err)

		channel, appErr := s.th.App.GetChannelByName(s.th.Context, name, s.th.BasicTeam.Id, false)
		s.Require().Nil(appErr)
		s.Require().Nil(s.channelAttributeValue(channel.Id, field.ID))
	})

	s.Run("regular user can't set values on a channel they don't manage", func() {
		field, _ := s.createChannelAttribute(model.PropertyFieldTypeSelect, adminLevel, false, "Alpha")
		channel := s.th.CreateChannelWithClientAndTeam(s.T(), s.th.SystemAdminClient, model.ChannelTypeOpen, s.th.BasicTeam.Id)

		err := channelAttributesSetCmdF(s.th.Client, s.newChannelAttributeSetCmd(field.Name+"=Alpha"), []string{s.th.BasicTeam.Name + ":" + channel.Name})
		s.Require().Error(err)
		s.Require().ErrorContains(err, "failed to set the channel attribute values")
		s.Require().Nil(s.channelAttributeValue(channel.Id, field.ID))
	})
}

func (s *MmctlE2ETestSuite) TestModifyChannelAttributeValues() {
	s.setupChannelAttributesHelper()
	adminLevel := model.PermissionLevelAdmin

	s.RunForSystemAdminAndLocal("modify --private without the required attribute is refused", func(c client.Client) {
		channel := s.th.CreateChannelWithClientAndTeam(s.T(), s.th.SystemAdminClient, model.ChannelTypeOpen, s.th.BasicTeam.Id)
		field, _ := s.createChannelAttribute(model.PropertyFieldTypeSelect, adminLevel, true, "Alpha", "Beta")

		err := modifyChannelCmdF(c, s.newChannelAttributeModifyCmd(), []string{s.th.BasicTeam.Name + ":" + channel.Name})
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "Required channel attributes not passed: ")
		s.Require().Contains(err.Error(), field.Name)

		current, appErr := s.th.App.GetChannel(s.th.Context, channel.Id)
		s.Require().Nil(appErr)
		s.Require().Equal(model.ChannelTypeOpen, current.Type)
		s.Require().Nil(s.channelAttributeValue(channel.Id, field.ID))
	})

	s.RunForSystemAdminAndLocal("modify --private with the required attribute", func(c client.Client) {
		channel := s.th.CreateChannelWithClientAndTeam(s.T(), s.th.SystemAdminClient, model.ChannelTypeOpen, s.th.BasicTeam.Id)
		field, options := s.createChannelAttribute(model.PropertyFieldTypeSelect, adminLevel, true, "Alpha", "Beta")

		err := modifyChannelCmdF(c, s.newChannelAttributeModifyCmd(field.Name+"=Alpha"), []string{s.th.BasicTeam.Name + ":" + channel.Name})
		s.Require().NoError(err)

		current, appErr := s.th.App.GetChannel(s.th.Context, channel.Id)
		s.Require().Nil(appErr)
		s.Require().Equal(model.ChannelTypePrivate, current.Type)
		s.Require().JSONEq(`"`+options["Alpha"]+`"`, string(s.channelAttributeValue(channel.Id, field.ID)))
	})

	s.RunForSystemAdminAndLocal("modify --public with --attribute is refused before any request", func(c client.Client) {
		channel := s.th.CreateChannelWithClientAndTeam(s.T(), s.th.SystemAdminClient, model.ChannelTypePrivate, s.th.BasicTeam.Id)
		field, _ := s.createChannelAttribute(model.PropertyFieldTypeSelect, adminLevel, false, "Alpha")

		cmd := newTestCmd(s.T(), ModifyChannelCmd)
		s.Require().NoError(cmd.Flags().Set("public", "true"))
		s.Require().NoError(cmd.Flags().Set("attribute", field.Name+"=Alpha"))

		err := modifyChannelCmdF(c, cmd, []string{s.th.BasicTeam.Name + ":" + channel.Name})
		s.Require().ErrorContains(err, "--attribute can be used only with --private")

		current, appErr := s.th.App.GetChannel(s.th.Context, channel.Id)
		s.Require().Nil(appErr)
		s.Require().Equal(model.ChannelTypePrivate, current.Type)
	})
}

func (s *MmctlE2ETestSuite) TestUnarchiveChannelAttributeValues() {
	s.setupChannelAttributesHelper()
	adminLevel := model.PermissionLevelAdmin

	archiveChannels := func() []*model.Channel {
		channels := make([]*model.Channel, 0, 2)
		for range 2 {
			channel := s.th.CreateChannelWithClientAndTeam(s.T(), s.th.SystemAdminClient, model.ChannelTypeOpen, s.th.BasicTeam.Id)
			s.Require().Nil(s.th.App.DeleteChannel(s.th.Context, channel, s.th.SystemAdminUser.Id))
			channels = append(channels, channel)
		}
		return channels
	}
	targets := func(channels []*model.Channel) []string {
		args := make([]string, 0, len(channels))
		for _, channel := range channels {
			args = append(args, s.th.BasicTeam.Id+":"+channel.Name)
		}
		return args
	}

	s.RunForSystemAdminAndLocal("unarchive without the required attribute is refused", func(c client.Client) {
		channels := archiveChannels()
		field, _ := s.createChannelAttribute(model.PropertyFieldTypeSelect, adminLevel, true, "Alpha", "Beta")

		err := unarchiveChannelsCmdF(c, newTestCmd(s.T(), UnarchiveChannelCmd), targets(channels))
		s.Require().Error(err)
		s.Require().Contains(err.Error(), "Required channel attributes not passed: ")
		s.Require().Contains(err.Error(), field.Name)

		for _, channel := range channels {
			current, appErr := s.th.App.GetChannel(s.th.Context, channel.Id)
			s.Require().Nil(appErr)
			s.Require().NotZero(current.DeleteAt)
		}
	})

	s.RunForSystemAdminAndLocal("unarchive two channels with the required attribute", func(c client.Client) {
		channels := archiveChannels()
		field, options := s.createChannelAttribute(model.PropertyFieldTypeSelect, adminLevel, true, "Alpha", "Beta")

		err := unarchiveChannelsCmdF(c, s.newChannelAttributeUnarchiveCmd(field.Name+"=Beta"), targets(channels))
		s.Require().NoError(err)
		s.Require().Empty(printer.GetErrorLines())

		for _, channel := range channels {
			current, appErr := s.th.App.GetChannel(s.th.Context, channel.Id)
			s.Require().Nil(appErr)
			s.Require().Zero(current.DeleteAt)
			s.Require().JSONEq(`"`+options["Beta"]+`"`, string(s.channelAttributeValue(channel.Id, field.ID)))
		}
	})

	s.Run("a team admin who can't read the values back still succeeds with a warning", func() {
		_, appErr := s.th.App.UpdateTeamMemberRoles(s.th.Context, s.th.BasicTeam.Id, s.th.BasicUser.Id, model.TeamUserRoleId+" "+model.TeamAdminRoleId)
		s.Require().Nil(appErr)

		channel := s.th.CreateChannelWithClientAndTeam(s.T(), s.th.SystemAdminClient, model.ChannelTypePrivate, s.th.BasicTeam.Id)
		s.Require().Nil(s.th.App.DeleteChannel(s.th.Context, channel, s.th.SystemAdminUser.Id))
		field, options := s.createChannelAttribute(model.PropertyFieldTypeSelect, adminLevel, false, "Alpha")

		err := unarchiveChannelsCmdF(s.th.Client, s.newChannelAttributeUnarchiveCmd(field.Name+"=Alpha"), []string{s.th.BasicTeam.Id + ":" + channel.Name})
		s.Require().NoError(err)
		s.Require().Len(printer.GetErrorLines(), 1)
		s.Require().Contains(printer.GetErrorLines()[0], "could not be checked because you don't have permission to read them")

		restored, appErr := s.th.App.GetChannel(s.th.Context, channel.Id)
		s.Require().Nil(appErr)
		s.Require().Zero(restored.DeleteAt)
		s.Require().JSONEq(`"`+options["Alpha"]+`"`, string(s.channelAttributeValue(channel.Id, field.ID)))
	})

	s.RunForSystemAdminAndLocal("unarchive restores the other channel when one fails", func(c client.Client) {
		channels := archiveChannels()
		field, options := s.createChannelAttribute(model.PropertyFieldTypeSelect, adminLevel, true, "Alpha")

		err := unarchiveChannelsCmdF(c, s.newChannelAttributeUnarchiveCmd(field.Name+"=Alpha"), []string{s.th.BasicTeam.Id + ":" + "no-such-channel", targets(channels)[0]})
		s.Require().ErrorContains(err, "Unable to find channel '"+s.th.BasicTeam.Id+":no-such-channel'")

		restored, appErr := s.th.App.GetChannel(s.th.Context, channels[0].Id)
		s.Require().Nil(appErr)
		s.Require().Zero(restored.DeleteAt)
		s.Require().JSONEq(`"`+options["Alpha"]+`"`, string(s.channelAttributeValue(channels[0].Id, field.ID)))
	})
}

func (s *MmctlE2ETestSuite) TestChannelAttributeValuesFlagOff() {
	s.SetupTestHelperWithConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.ChannelAttributes = false
		cfg.FeatureFlags.ChannelAttributesRequired = false
		cfg.FeatureFlags.IntegratedBoards = false
		cfg.FeatureFlags.ManagedChannelCategories = false
		cfg.FeatureFlags.ClassificationMarkings = false
		cfg.FeatureFlags.SessionAttributes = false
		cfg.FeatureFlags.PostAttributes = false
	}).InitBasic(s.T())
	s.th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	s.RunForSystemAdminAndLocal("plain create works", func(c client.Client) {
		name := "attr-" + model.NewId()
		err := createChannelCmdF(c, s.newChannelAttributeCreateCmd(name), nil)
		s.Require().NoError(err)
		s.Require().Len(printer.GetLines(), 1)

		_, appErr := s.th.App.GetChannelByName(s.th.Context, name, s.th.BasicTeam.Id, false)
		s.Require().Nil(appErr)
	})

	s.RunForSystemAdminAndLocal("create with --attribute says attributes aren't enabled", func(c client.Client) {
		name := "attr-" + model.NewId()
		err := createChannelCmdF(c, s.newChannelAttributeCreateCmd(name, "Classification=Secret"), nil)
		s.Require().EqualError(err, "channel attributes aren't enabled on this server")

		_, appErr := s.th.App.GetChannelByName(s.th.Context, name, s.th.BasicTeam.Id, false)
		s.Require().NotNil(appErr)
	})

	s.RunForSystemAdminAndLocal("channel attributes fields says attributes aren't enabled", func(c client.Client) {
		err := channelAttributesFieldsCmdF(c, newTestCmd(s.T(), ChannelAttributesFieldsCmd), nil)
		s.Require().EqualError(err, "channel attributes aren't enabled on this server")
	})
}
