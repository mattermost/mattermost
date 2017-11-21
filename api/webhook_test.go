// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func TestCreateIncomingHook(t *testing.T) {
	th := Setup().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient
	user := th.SystemAdminUser
	team := th.SystemAdminTeam
	channel1 := th.CreateChannel(Client, team)
	channel2 := th.CreatePrivateChannel(Client, team)
	channel3 := th.CreateChannel(Client, team)
	user2 := th.CreateUser(Client)
	th.LinkUserToTeam(user2, team)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = true })

	hook := &model.IncomingWebhook{ChannelId: channel1.Id}

	var rhook *model.IncomingWebhook
	if result, err := Client.CreateIncomingWebhook(hook); err != nil {
		t.Fatal(err)
	} else {
		rhook = result.Data.(*model.IncomingWebhook)
	}

	if hook.ChannelId != rhook.ChannelId {
		t.Fatal("channel ids didn't match")
	}

	if rhook.UserId != user.Id {
		t.Fatal("user ids didn't match")
	}

	if rhook.TeamId != team.Id {
		t.Fatal("team ids didn't match")
	}

	hook = &model.IncomingWebhook{ChannelId: "junk"}
	if _, err := Client.CreateIncomingWebhook(hook); err == nil {
		t.Fatal("should have failed - bad channel id")
	}

	hook = &model.IncomingWebhook{ChannelId: channel2.Id, UserId: "123", TeamId: "456"}
	if result, err := Client.CreateIncomingWebhook(hook); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.IncomingWebhook).UserId != user.Id {
			t.Fatal("bad user id wasn't overwritten")
		}
		if result.Data.(*model.IncomingWebhook).TeamId != team.Id {
			t.Fatal("bad team id wasn't overwritten")
		}
	}

	Client.Must(Client.LeaveChannel(channel3.Id))

	hook = &model.IncomingWebhook{ChannelId: channel3.Id, UserId: user.Id, TeamId: team.Id}
	if _, err := Client.CreateIncomingWebhook(hook); err != nil {
		t.Fatal(err)
	}

	Client.Logout()
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)

	hook = &model.IncomingWebhook{ChannelId: channel1.Id}

	if _, err := Client.CreateIncomingWebhook(hook); err == nil {
		t.Fatal("should have failed - not system/team admin")
	}

	Client.Logout()
	th.UpdateUserToTeamAdmin(user2, team)
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)

	if _, err := Client.CreateIncomingWebhook(hook); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = false })
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.CreateIncomingWebhook(hook); err != nil {
		t.Fatal(err)
	}

	hook = &model.IncomingWebhook{ChannelId: channel2.Id}

	if _, err := Client.CreateIncomingWebhook(hook); err == nil {
		t.Fatal("should have failed - channel is private and not a member")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = false })

	if _, err := Client.CreateIncomingWebhook(hook); err == nil {
		t.Fatal("should have errored - webhooks turned off")
	}
}

func TestUpdateIncomingHook(t *testing.T) {
	th := Setup().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient
	team := th.SystemAdminTeam

	channel1 := th.CreateChannel(Client, team)
	channel2 := th.CreatePrivateChannel(Client, team)
	channel3 := th.CreateChannel(Client, team)

	user2 := th.CreateUser(Client)
	th.LinkUserToTeam(user2, team)

	team2 := th.CreateTeam(Client)
	user3 := th.CreateUser(Client)
	th.LinkUserToTeam(user3, team2)
	th.UpdateUserToTeamAdmin(user3, team2)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = true })
	th.App.SetDefaultRolesBasedOnConfig()

	hook := createIncomingWebhook(channel1.Id, Client, t)

	t.Run("UpdateIncomingHook", func(t *testing.T) {
		hook.DisplayName = "hook2"
		hook.Description = "description"
		hook.ChannelId = channel3.Id

		if result, err := Client.UpdateIncomingWebhook(hook); err != nil {
			t.Fatal("Update hook should not fail")
		} else {
			updatedHook := result.Data.(*model.IncomingWebhook)

			if updatedHook.DisplayName != "hook2" {
				t.Fatal("Hook name is not updated")
			}

			if updatedHook.Description != "description" {
				t.Fatal("Hook description is not updated")
			}

			if updatedHook.ChannelId != channel3.Id {
				t.Fatal("Hook channel is not updated")
			}
		}
	})

	t.Run("RetainCreateAt", func(t *testing.T) {
		hook2 := &model.IncomingWebhook{ChannelId: channel1.Id, CreateAt: 100}

		if result, err := Client.CreateIncomingWebhook(hook2); err != nil {
			t.Fatal("hook creation failed")
		} else {
			createdHook := result.Data.(*model.IncomingWebhook)
			createdHook.DisplayName = "Name2"

			if result, err := Client.UpdateIncomingWebhook(createdHook); err != nil {
				t.Fatal("Update hook should not fail")
			} else {
				updatedHook := result.Data.(*model.IncomingWebhook)

				if updatedHook.CreateAt != createdHook.CreateAt {
					t.Fatal("failed - hook create at should not be changed")
				}
			}
		}
	})

	t.Run("ModifyUpdateAt", func(t *testing.T) {
		hook.DisplayName = "Name3"

		if result, err := Client.UpdateIncomingWebhook(hook); err != nil {
			t.Fatal("Update hook should not fail")
		} else {
			updatedHook := result.Data.(*model.IncomingWebhook)

			if updatedHook.UpdateAt == hook.UpdateAt {
				t.Fatal("failed - hook updateAt is not updated")
			}
		}
	})

	t.Run("UpdateNonExistentHook", func(t *testing.T) {
		nonExistentHook := &model.IncomingWebhook{ChannelId: channel1.Id}

		if _, err := Client.UpdateIncomingWebhook(nonExistentHook); err == nil {
			t.Fatal("should have failed - update a non-existent hook")
		}
	})

	Client.Logout()
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)
	t.Run("UserIsNotAdminOfTeam", func(t *testing.T) {
		if _, err := Client.UpdateIncomingWebhook(hook); err == nil {
			t.Fatal("should have failed - user is not admin of team")
		}
	})

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = true })

	t.Run("OnlyAdminIntegrationsDisabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = false })
		th.App.SetDefaultRolesBasedOnConfig()

		t.Run("UpdateHookOfSameUser", func(t *testing.T) {
			sameUserHook := &model.IncomingWebhook{ChannelId: channel1.Id, UserId: user2.Id}
			if result, err := Client.CreateIncomingWebhook(sameUserHook); err != nil {
				t.Fatal("Hook creation failed")
			} else {
				sameUserHook = result.Data.(*model.IncomingWebhook)
			}

			if _, err := Client.UpdateIncomingWebhook(sameUserHook); err != nil {
				t.Fatal("should not fail - only admin integrations are disabled & hook of same user")
			}
		})

		t.Run("UpdateHookOfDifferentUser", func(t *testing.T) {
			if _, err := Client.UpdateIncomingWebhook(hook); err == nil {
				t.Fatal("should have failed - user does not have permissions to update other user's hooks")
			}
		})
	})

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = true })
	th.App.SetDefaultRolesBasedOnConfig()

	Client.Logout()
	th.UpdateUserToTeamAdmin(user2, team)
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)
	t.Run("UpdateByDifferentUser", func(t *testing.T) {
		if result, err := Client.UpdateIncomingWebhook(hook); err != nil {
			t.Fatal("Update hook should not fail")
		} else {
			updatedHook := result.Data.(*model.IncomingWebhook)

			if updatedHook.UserId == user2.Id {
				t.Fatal("Hook's creator userId is not retained")
			}
		}
	})

	t.Run("IncomingHooksDisabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = false })
		if _, err := Client.UpdateIncomingWebhook(hook); err == nil {
			t.Fatal("should have failed - incoming hooks are disabled")
		}
	})

	t.Run("PrivateChannel", func(t *testing.T) {
		hook.ChannelId = channel2.Id

		if _, err := Client.UpdateIncomingWebhook(hook); err == nil {
			t.Fatal("should have failed - updating to a private channel where the user is not a member")
		}
	})

	t.Run("UpdateToNonExistentChannel", func(t *testing.T) {
		hook.ChannelId = "junk"
		if _, err := Client.UpdateIncomingWebhook(hook); err == nil {
			t.Fatal("should have failed - bad channel id")
		}
	})

	Client.Logout()
	Client.Must(Client.LoginById(user3.Id, user3.Password))
	Client.SetTeamId(team2.Id)
	t.Run("UpdateToADifferentTeam", func(t *testing.T) {
		if _, err := Client.UpdateIncomingWebhook(hook); err == nil {
			t.Fatal("should have failed - update to a different team is not allowed")
		}
	})
}

func createIncomingWebhook(channelID string, Client *model.Client, t *testing.T) *model.IncomingWebhook {
	hook := &model.IncomingWebhook{ChannelId: channelID}
	if result, err := Client.CreateIncomingWebhook(hook); err != nil {
		t.Fatal("Hook creation failed")
	} else {
		hook = result.Data.(*model.IncomingWebhook)
	}

	return hook
}

func createOutgoingWebhook(channelID string, callbackURLs []string, triggerWords []string, Client *model.Client, t *testing.T) *model.OutgoingWebhook {
	hook := &model.OutgoingWebhook{ChannelId: channelID, CallbackURLs: callbackURLs, TriggerWords: triggerWords}
	if result, err := Client.CreateOutgoingWebhook(hook); err != nil {
		t.Fatal("Hook creation failed")
	} else {
		hook = result.Data.(*model.OutgoingWebhook)
	}

	return hook
}

func TestListIncomingHooks(t *testing.T) {
	th := Setup().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient
	team := th.SystemAdminTeam
	channel1 := th.CreateChannel(Client, team)
	user2 := th.CreateUser(Client)
	th.LinkUserToTeam(user2, team)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = true })
	th.App.SetDefaultRolesBasedOnConfig()

	hook1 := &model.IncomingWebhook{ChannelId: channel1.Id}
	hook1 = Client.Must(Client.CreateIncomingWebhook(hook1)).Data.(*model.IncomingWebhook)

	hook2 := &model.IncomingWebhook{ChannelId: channel1.Id}
	hook2 = Client.Must(Client.CreateIncomingWebhook(hook2)).Data.(*model.IncomingWebhook)

	if result, err := Client.ListIncomingWebhooks(); err != nil {
		t.Fatal(err)
	} else {
		hooks := result.Data.([]*model.IncomingWebhook)

		if len(hooks) != 2 {
			t.Fatal("incorrect number of hooks")
		}
	}

	Client.Logout()
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)

	if _, err := Client.ListIncomingWebhooks(); err == nil {
		t.Fatal("should have errored - not system/team admin")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = false })
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.ListIncomingWebhooks(); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = false })

	if _, err := Client.ListIncomingWebhooks(); err == nil {
		t.Fatal("should have errored - webhooks turned off")
	}
}

func TestDeleteIncomingHook(t *testing.T) {
	th := Setup().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient
	team := th.SystemAdminTeam
	channel1 := th.CreateChannel(Client, team)
	user2 := th.CreateUser(Client)
	th.LinkUserToTeam(user2, team)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = true })
	th.App.SetDefaultRolesBasedOnConfig()

	hook := &model.IncomingWebhook{ChannelId: channel1.Id}
	hook = Client.Must(Client.CreateIncomingWebhook(hook)).Data.(*model.IncomingWebhook)

	if _, err := Client.DeleteIncomingWebhook(hook.Id); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DeleteIncomingWebhook("junk"); err == nil {
		t.Fatal("should have failed - bad id")
	}

	if _, err := Client.DeleteIncomingWebhook(""); err == nil {
		t.Fatal("should have failed - empty id")
	}

	hooks := Client.Must(Client.ListIncomingWebhooks()).Data.([]*model.IncomingWebhook)
	if len(hooks) != 0 {
		t.Fatal("delete didn't work properly")
	}

	hook = &model.IncomingWebhook{ChannelId: channel1.Id}
	hook = Client.Must(Client.CreateIncomingWebhook(hook)).Data.(*model.IncomingWebhook)

	Client.Logout()
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)

	if _, err := Client.DeleteIncomingWebhook(hook.Id); err == nil {
		t.Fatal("should have failed - not system/team admin")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = false })
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.DeleteIncomingWebhook(hook.Id); err == nil {
		t.Fatal("should have failed - not creator or team admin")
	}

	hook = &model.IncomingWebhook{ChannelId: channel1.Id}
	hook = Client.Must(Client.CreateIncomingWebhook(hook)).Data.(*model.IncomingWebhook)

	if _, err := Client.DeleteIncomingWebhook(hook.Id); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = false })

	if _, err := Client.DeleteIncomingWebhook(hook.Id); err == nil {
		t.Fatal("should have errored - webhooks turned off")
	}
}

func TestCreateOutgoingHook(t *testing.T) {
	th := Setup().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient
	user := th.SystemAdminUser
	team := th.SystemAdminTeam
	team2 := th.CreateTeam(Client)
	channel1 := th.CreateChannel(Client, team)
	channel2 := th.CreatePrivateChannel(Client, team)
	user2 := th.CreateUser(Client)
	th.LinkUserToTeam(user2, team)
	user3 := th.CreateUser(Client)
	th.LinkUserToTeam(user3, team2)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = true })
	th.App.SetDefaultRolesBasedOnConfig()

	hook := &model.OutgoingWebhook{ChannelId: channel1.Id, CallbackURLs: []string{"http://nowhere.com"}}

	var rhook *model.OutgoingWebhook
	if result, err := Client.CreateOutgoingWebhook(hook); err != nil {
		t.Fatal(err)
	} else {
		rhook = result.Data.(*model.OutgoingWebhook)
	}

	if hook.ChannelId != rhook.ChannelId {
		t.Fatal("channel ids didn't match")
	}

	if rhook.CreatorId != user.Id {
		t.Fatal("user ids didn't match")
	}

	if rhook.TeamId != team.Id {
		t.Fatal("team ids didn't match")
	}

	hook = &model.OutgoingWebhook{ChannelId: channel1.Id, TriggerWords: []string{"cats", "dogs"}, CallbackURLs: []string{"http://nowhere.com", "http://cats.com"}}
	hook1 := &model.OutgoingWebhook{ChannelId: channel1.Id, TriggerWords: []string{"cats"}, CallbackURLs: []string{"http://nowhere.com"}}

	if _, err := Client.CreateOutgoingWebhook(hook); err != nil {
		t.Fatal("multiple trigger words and urls failed")
	}

	if _, err := Client.CreateOutgoingWebhook(hook1); err == nil {
		t.Fatal("should have failed - duplicate trigger words and urls")
	}

	hook = &model.OutgoingWebhook{ChannelId: "junk", CallbackURLs: []string{"http://nowhere.com"}}
	if _, err := Client.CreateOutgoingWebhook(hook); err == nil {
		t.Fatal("should have failed - bad channel id")
	}

	hook = &model.OutgoingWebhook{ChannelId: channel1.Id, CreatorId: "123", TeamId: "456", CallbackURLs: []string{"http://nowhere.com"}}
	if result, err := Client.CreateOutgoingWebhook(hook); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.OutgoingWebhook).CreatorId != user.Id {
			t.Fatal("bad user id wasn't overwritten")
		}
		if result.Data.(*model.OutgoingWebhook).TeamId != team.Id {
			t.Fatal("bad team id wasn't overwritten")
		}
	}

	hook = &model.OutgoingWebhook{ChannelId: channel2.Id, CallbackURLs: []string{"http://nowhere.com"}}
	if _, err := Client.CreateOutgoingWebhook(hook); err == nil {
		t.Fatal("should have failed - private channel")
	}

	hook = &model.OutgoingWebhook{CallbackURLs: []string{"http://nowhere.com"}}
	if _, err := Client.CreateOutgoingWebhook(hook); err == nil {
		t.Fatal("should have failed - blank channel and trigger words")
	}

	Client.Logout()
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)

	hook = &model.OutgoingWebhook{ChannelId: channel1.Id, CallbackURLs: []string{"http://nowhere.com"}}
	if _, err := Client.CreateOutgoingWebhook(hook); err == nil {
		t.Fatal("should have failed - not system/team admin")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = false })
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.CreateOutgoingWebhook(hook); err != nil {
		t.Fatal(err)
	}

	Client.Logout()
	Client.Must(Client.LoginById(user3.Id, user3.Password))
	Client.SetTeamId(team2.Id)

	if _, err := Client.CreateOutgoingWebhook(hook); err == nil {
		t.Fatal("should have failed - wrong team")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = false })

	if _, err := Client.CreateOutgoingWebhook(hook); err == nil {
		t.Fatal("should have errored - webhooks turned off")
	}
}

func TestListOutgoingHooks(t *testing.T) {
	th := Setup().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient
	team := th.SystemAdminTeam
	channel1 := th.CreateChannel(Client, team)
	user2 := th.CreateUser(Client)
	th.LinkUserToTeam(user2, team)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = true })
	th.App.SetDefaultRolesBasedOnConfig()

	hook1 := &model.OutgoingWebhook{ChannelId: channel1.Id, CallbackURLs: []string{"http://nowhere.com"}}
	hook1 = Client.Must(Client.CreateOutgoingWebhook(hook1)).Data.(*model.OutgoingWebhook)

	hook2 := &model.OutgoingWebhook{TriggerWords: []string{"trigger"}, CallbackURLs: []string{"http://nowhere.com"}}
	hook2 = Client.Must(Client.CreateOutgoingWebhook(hook2)).Data.(*model.OutgoingWebhook)

	if result, err := Client.ListOutgoingWebhooks(); err != nil {
		t.Fatal(err)
	} else {
		hooks := result.Data.([]*model.OutgoingWebhook)

		if len(hooks) != 2 {
			t.Fatal("incorrect number of hooks")
		}
	}

	Client.Logout()
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)

	if _, err := Client.ListOutgoingWebhooks(); err == nil {
		t.Fatal("should have failed - not system/team admin")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = false })
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.ListOutgoingWebhooks(); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = false })

	if _, err := Client.ListOutgoingWebhooks(); err == nil {
		t.Fatal("should have errored - webhooks turned off")
	}
}

func TestUpdateOutgoingHook(t *testing.T) {
	th := Setup().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient
	user := th.SystemAdminUser
	team := th.SystemAdminTeam
	team2 := th.CreateTeam(Client)
	channel1 := th.CreateChannel(Client, team)
	channel2 := th.CreatePrivateChannel(Client, team)
	channel3 := th.CreateChannel(Client, team)
	user2 := th.CreateUser(Client)
	th.LinkUserToTeam(user2, team)
	user3 := th.CreateUser(Client)
	th.LinkUserToTeam(user3, team2)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = true })
	th.App.SetDefaultRolesBasedOnConfig()

	hook := createOutgoingWebhook(channel1.Id, []string{"http://nowhere.com"}, []string{"cats"}, Client, t)
	createOutgoingWebhook(channel1.Id, []string{"http://nowhere.com"}, []string{"dogs"}, Client, t)

	hook.DisplayName = "Cats"
	hook.Description = "Get me some cats"
	t.Run("OutgoingHooksDisabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = false })
		if _, err := Client.UpdateOutgoingWebhook(hook); err == nil {
			t.Fatal("should have failed - outgoing webhooks disabled")
		}
	})

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	t.Run("UpdateOutgoingWebhook", func(t *testing.T) {
		if result, err := Client.UpdateOutgoingWebhook(hook); err != nil {
			t.Fatal("failed to update outgoing web hook")
		} else {
			updatedHook := result.Data.(*model.OutgoingWebhook)

			if updatedHook.DisplayName != hook.DisplayName {
				t.Fatal("Hook display name did not get updated")
			}

			if updatedHook.Description != hook.Description {
				t.Fatal("Hook description did not get updated")
			}
		}
	})

	t.Run("RetainCreateAt", func(t *testing.T) {
		hook2 := &model.OutgoingWebhook{ChannelId: channel1.Id, CallbackURLs: []string{"http://nowhere.com"}, TriggerWords: []string{"rats"}}

		if result, err := Client.CreateOutgoingWebhook(hook2); err != nil {
			t.Fatal("hook creation failed")
		} else {
			createdHook := result.Data.(*model.OutgoingWebhook)
			createdHook.DisplayName = "Name2"

			if result, err := Client.UpdateOutgoingWebhook(createdHook); err != nil {
				t.Fatal("Update hook should not fail")
			} else {
				updatedHook := result.Data.(*model.OutgoingWebhook)

				if updatedHook.CreateAt != createdHook.CreateAt {
					t.Fatal("failed - hook create at should not be changed")
				}
			}
		}
	})

	t.Run("ModifyUpdateAt", func(t *testing.T) {
		hook.DisplayName = "Name3"

		if result, err := Client.UpdateOutgoingWebhook(hook); err != nil {
			t.Fatal("Update hook should not fail")
		} else {
			updatedHook := result.Data.(*model.OutgoingWebhook)

			if updatedHook.UpdateAt == hook.UpdateAt {
				t.Fatal("failed - hook updateAt is not updated")
			}
		}
	})

	Client.Logout()
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)
	if _, err := Client.UpdateOutgoingWebhook(hook); err == nil {
		t.Fatal("should have failed - user does not have permissions to manage webhooks")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = false })
	th.App.SetDefaultRolesBasedOnConfig()
	hook2 := createOutgoingWebhook(channel1.Id, []string{"http://nowhereelse.com"}, []string{"dogs"}, Client, t)

	if _, err := Client.UpdateOutgoingWebhook(hook2); err != nil {
		t.Fatal("update webhook failed when admin only integrations is turned off")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = true })
	th.App.SetDefaultRolesBasedOnConfig()

	Client.Logout()
	th.LinkUserToTeam(user3, team)
	th.UpdateUserToTeamAdmin(user3, team)
	Client.Must(Client.LoginById(user3.Id, user3.Password))
	Client.SetTeamId(team.Id)
	t.Run("RetainHookCreator", func(t *testing.T) {
		if result, err := Client.UpdateOutgoingWebhook(hook); err != nil {
			t.Fatal("failed to update outgoing web hook")
		} else {
			updatedHook := result.Data.(*model.OutgoingWebhook)

			if updatedHook.CreatorId != user.Id {
				t.Fatal("hook creator should not be changed")
			}
		}
	})

	Client.Logout()
	Client.Must(Client.LoginById(user.Id, user.Password))
	Client.SetTeamId(team.Id)
	t.Run("UpdateToExistingTriggerWordAndCallback", func(t *testing.T) {
		t.Run("OnSameChannel", func(t *testing.T) {
			hook.TriggerWords = []string{"dogs"}

			if _, err := Client.UpdateOutgoingWebhook(hook); err == nil {
				t.Fatal("should have failed - duplicate trigger words & channel urls")
			}
		})

		t.Run("OnDifferentChannel", func(t *testing.T) {
			hook.TriggerWords = []string{"dogs"}
			hook.ChannelId = channel3.Id

			if _, err := Client.UpdateOutgoingWebhook(hook); err != nil {
				t.Fatal("update of hook failed with duplicate trigger word but different channel")
			}
		})
	})

	t.Run("UpdateToNonExistentChannel", func(t *testing.T) {
		hook.ChannelId = "junk"

		if _, err := Client.UpdateOutgoingWebhook(hook); err == nil {
			t.Fatal("should have failed - non existent channel")
		}
	})

	t.Run("UpdateToPrivateChannel", func(t *testing.T) {
		hook.ChannelId = channel2.Id

		if _, err := Client.UpdateOutgoingWebhook(hook); err == nil {
			t.Fatal("should have failed - update to a private channel")
		}
	})

	t.Run("UpdateToBlankTriggerWordAndChannel", func(t *testing.T) {
		hook.ChannelId = ""
		hook.TriggerWords = nil

		if _, err := Client.UpdateOutgoingWebhook(hook); err == nil {
			t.Fatal("should have failed - update to blank trigger words & channel")
		}
	})

	Client.Logout()
	Client.Must(Client.LoginById(user3.Id, user3.Password))
	Client.SetTeamId(team2.Id)
	t.Run("UpdateToADifferentTeam", func(t *testing.T) {
		if _, err := Client.UpdateOutgoingWebhook(hook); err == nil {
			t.Fatal("should have failed - update to a different team is not allowed")
		}
	})
}

func TestDeleteOutgoingHook(t *testing.T) {
	th := Setup().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient
	team := th.SystemAdminTeam
	channel1 := th.CreateChannel(Client, team)
	user2 := th.CreateUser(Client)
	th.LinkUserToTeam(user2, team)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = true })
	th.App.SetDefaultRolesBasedOnConfig()

	hook := &model.OutgoingWebhook{ChannelId: channel1.Id, CallbackURLs: []string{"http://nowhere.com"}}
	hook = Client.Must(Client.CreateOutgoingWebhook(hook)).Data.(*model.OutgoingWebhook)

	if _, err := Client.DeleteOutgoingWebhook("junk"); err == nil {
		t.Fatal("should have failed - bad hook id")
	}

	if _, err := Client.DeleteOutgoingWebhook(""); err == nil {
		t.Fatal("should have failed - empty hook id")
	}

	if _, err := Client.DeleteOutgoingWebhook(hook.Id); err != nil {
		t.Fatal(err)
	}

	hooks := Client.Must(Client.ListOutgoingWebhooks()).Data.([]*model.OutgoingWebhook)
	if len(hooks) != 0 {
		t.Fatal("delete didn't work properly")
	}

	hook = &model.OutgoingWebhook{ChannelId: channel1.Id, CallbackURLs: []string{"http://nowhere.com"}}
	hook = Client.Must(Client.CreateOutgoingWebhook(hook)).Data.(*model.OutgoingWebhook)

	Client.Logout()
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)

	if _, err := Client.DeleteOutgoingWebhook(hook.Id); err == nil {
		t.Fatal("should have failed - not system/team admin")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = false })
	th.App.SetDefaultRolesBasedOnConfig()

	if _, err := Client.DeleteOutgoingWebhook(hook.Id); err == nil {
		t.Fatal("should have failed - not creator or team admin")
	}

	hook = &model.OutgoingWebhook{ChannelId: channel1.Id, CallbackURLs: []string{"http://nowhere.com"}}
	hook = Client.Must(Client.CreateOutgoingWebhook(hook)).Data.(*model.OutgoingWebhook)

	if _, err := Client.DeleteOutgoingWebhook(hook.Id); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = false })

	if _, err := Client.DeleteOutgoingWebhook(hook.Id); err == nil {
		t.Fatal("should have errored - webhooks turned off")
	}
}

func TestRegenOutgoingHookToken(t *testing.T) {
	th := Setup().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient
	team := th.SystemAdminTeam
	team2 := th.CreateTeam(Client)
	channel1 := th.CreateChannel(Client, team)
	user2 := th.CreateUser(Client)
	th.LinkUserToTeam(user2, team)
	user3 := th.CreateUser(Client)
	th.LinkUserToTeam(user3, team2)

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = true })
	th.App.SetDefaultRolesBasedOnConfig()

	hook := &model.OutgoingWebhook{ChannelId: channel1.Id, CallbackURLs: []string{"http://nowhere.com"}}
	hook = Client.Must(Client.CreateOutgoingWebhook(hook)).Data.(*model.OutgoingWebhook)

	if _, err := Client.RegenOutgoingWebhookToken("junk"); err == nil {
		t.Fatal("should have failed - bad id")
	}

	if _, err := Client.RegenOutgoingWebhookToken(""); err == nil {
		t.Fatal("should have failed - empty id")
	}

	if result, err := Client.RegenOutgoingWebhookToken(hook.Id); err != nil {
		t.Fatal(err)
	} else {
		if result.Data.(*model.OutgoingWebhook).Token == hook.Token {
			t.Fatal("regen didn't work properly")
		}
	}

	Client.SetTeamId(model.NewId())
	if _, err := Client.RegenOutgoingWebhookToken(hook.Id); err == nil {
		t.Fatal("should have failed - wrong team id")
	}

	Client.Logout()
	Client.Must(Client.LoginById(user2.Id, user2.Password))
	Client.SetTeamId(team.Id)

	if _, err := Client.RegenOutgoingWebhookToken(hook.Id); err == nil {
		t.Fatal("should have failed - not system/team admin")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOnlyAdminIntegrations = false })
	th.App.SetDefaultRolesBasedOnConfig()

	hook = &model.OutgoingWebhook{ChannelId: channel1.Id, CallbackURLs: []string{"http://nowhere.com"}}
	hook = Client.Must(Client.CreateOutgoingWebhook(hook)).Data.(*model.OutgoingWebhook)

	if _, err := Client.RegenOutgoingWebhookToken(hook.Id); err != nil {
		t.Fatal(err)
	}

	Client.Logout()
	Client.Must(Client.LoginById(user3.Id, user3.Password))
	Client.SetTeamId(team2.Id)

	if _, err := Client.RegenOutgoingWebhookToken(hook.Id); err == nil {
		t.Fatal("should have failed - wrong team")
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableOutgoingWebhooks = false })

	if _, err := Client.RegenOutgoingWebhookToken(hook.Id); err == nil {
		t.Fatal("should have errored - webhooks turned off")
	}
}

func TestIncomingWebhooks(t *testing.T) {
	th := Setup().InitBasic().InitSystemAdmin()
	defer th.TearDown()

	Client := th.SystemAdminClient
	team := th.SystemAdminTeam
	channel1 := th.CreateChannel(Client, team)
	user2 := th.CreateUser(Client)
	th.LinkUserToTeam(user2, team)

	enableIncomingHooks := th.App.Config().ServiceSettings.EnableIncomingWebhooks
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = enableIncomingHooks })
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = true })

	hook := &model.IncomingWebhook{ChannelId: channel1.Id}
	hook = Client.Must(Client.CreateIncomingWebhook(hook)).Data.(*model.IncomingWebhook)

	url := "/hooks/" + hook.Id
	text := `this is a \"test\"
	that contains a newline and a tab`

	if _, err := Client.DoPost(url, "{\"text\":\"this is a test\"}", "application/json"); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DoPost(url, "{\"text\":\""+text+"\"}", "application/json"); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DoPost(url, fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"%s\"}", channel1.Name), "application/json"); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DoPost(url, fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"#%s\"}", channel1.Name), "application/json"); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DoPost(url, fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"@%s\"}", user2.Username), "application/json"); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DoPost(url, "payload={\"text\":\"this is a test\"}", "application/x-www-form-urlencoded"); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DoPost(url, "payload={\"text\":\""+text+"\"}", "application/x-www-form-urlencoded"); err != nil {
		t.Fatal(err)
	}

	if _, err := th.BasicClient.DoPost(url, fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"%s\"}", model.DEFAULT_CHANNEL), "application/json"); err != nil {
		t.Fatal("should not have failed -- ExperimentalTownSquareIsReadOnly is false and it's not a read only channel")
	}

	isLicensed := utils.IsLicensed()
	license := utils.License()
	disableTownSquareReadOnly := th.App.Config().TeamSettings.ExperimentalTownSquareIsReadOnly
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.TeamSettings.ExperimentalTownSquareIsReadOnly = disableTownSquareReadOnly })
		utils.SetIsLicensed(isLicensed)
		utils.SetLicense(license)
		th.App.SetDefaultRolesBasedOnConfig()
	}()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalTownSquareIsReadOnly = true })
	th.App.SetDefaultRolesBasedOnConfig()
	utils.SetIsLicensed(true)
	utils.SetLicense(&model.License{Features: &model.Features{}})
	utils.License().Features.SetDefaults()

	if _, err := th.BasicClient.DoPost(url, fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"%s\"}", model.DEFAULT_CHANNEL), "application/json"); err == nil {
		t.Fatal("should have failed -- ExperimentalTownSquareIsReadOnly is true and it's a read only channel")
	}

	attachmentPayload := `{
	       "text": "this is a test",
	       "attachments": [
	           {
	               "fallback": "Required plain-text summary of the attachment.",

	               "color": "#36a64f",

	               "pretext": "Optional text that appears above the attachment block",

	               "author_name": "Bobby Tables",
	               "author_link": "http://flickr.com/bobby/",
	               "author_icon": "http://flickr.com/icons/bobby.jpg",

	               "title": "Slack API Documentation",
	               "title_link": "https://api.slack.com/",

	               "text": "Optional text that appears within the attachment",

	               "fields": [
	                   {
	                       "title": "Priority",
	                       "value": "High",
	                       "short": false
	                   }
	               ],

	               "image_url": "http://my-website.com/path/to/image.jpg",
	               "thumb_url": "http://example.com/path/to/thumb.png"
	           }
	       ]
	   }`

	if _, err := Client.DoPost(url, attachmentPayload, "application/json"); err != nil {
		t.Fatal(err)
	}

	if _, err := Client.DoPost(url, "{\"text\":\"\"}", "application/json"); err == nil || err.StatusCode != http.StatusBadRequest {
		t.Fatal("should have failed - no text")
	}

	tooLongText := ""
	for i := 0; i < 8200; i++ {
		tooLongText += "a"
	}

	if _, err := Client.DoPost(url, "{\"text\":\""+tooLongText+"\"}", "application/json"); err != nil {
		t.Fatal(err)
	}

	attachmentPayload = `{
	       "text": "this is a test",
	       "attachments": [
	           {
	               "fallback": "Required plain-text summary of the attachment.",

	               "color": "#36a64f",

	               "pretext": "Optional text that appears above the attachment block",

	               "author_name": "Bobby Tables",
	               "author_link": "http://flickr.com/bobby/",
	               "author_icon": "http://flickr.com/icons/bobby.jpg",

	               "title": "Slack API Documentation",
	               "title_link": "https://api.slack.com/",

	               "text": "` + tooLongText + `",

	               "fields": [
	                   {
	                       "title": "Priority",
	                       "value": "High",
	                       "short": false
	                   }
	               ],

	               "image_url": "http://my-website.com/path/to/image.jpg",
	               "thumb_url": "http://example.com/path/to/thumb.png"
	           }
	       ]
	   }`

	if _, err := Client.DoPost(url, attachmentPayload, "application/json"); err != nil {
		t.Fatal(err)
	}

	th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = false })

	if _, err := Client.DoPost(url, "{\"text\":\"this is a test\"}", "application/json"); err == nil {
		t.Fatal("should have failed - webhooks turned off")
	}
}
