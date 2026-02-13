// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateWiki(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)

	t.Run("create wiki in public channel successfully", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId:   th.BasicChannel.Id,
			Title:       "Test Wiki",
			Description: "Test description",
		}

		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotEmpty(t, createdWiki.Id)
		require.Equal(t, wiki.ChannelId, createdWiki.ChannelId)
		require.Equal(t, wiki.Title, createdWiki.Title)
	})

	t.Run("fail without create post permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)

		wiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		_, resp, err := client2.CreateWiki(context.Background(), wiki)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail with invalid wiki data", func(t *testing.T) {
		wiki := &model.Wiki{
			Title: "No Channel",
		}

		_, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("fail without create page permission", func(t *testing.T) {
		// Create a new channel for this test
		channel := th.CreatePublicChannel(t)

		// Add BasicUser2 to the channel as a regular member (not admin)
		th.AddUserToChannel(t, th.BasicUser2, channel)

		// Remove CreatePage permission from channel user role
		th.RemovePermissionFromRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)

		// Login as BasicUser2 (who is a regular member, not channel admin)
		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		wiki := &model.Wiki{
			ChannelId: channel.Id,
			Title:     "Wiki Without CreatePage Permission",
		}

		// BasicUser2 should fail because they don't have CreatePage permission
		_, resp, err := client2.CreateWiki(context.Background(), wiki)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("succeed with both manage channel and create page permissions", func(t *testing.T) {
		// Create a new channel for this test
		channel := th.CreatePublicChannel(t)

		// Ensure both permissions are present (they should be by default, but be explicit)
		th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
		th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)

		wiki := &model.Wiki{
			ChannelId: channel.Id,
			Title:     "Wiki With Both Permissions",
		}

		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotEmpty(t, createdWiki.Id)
		require.Equal(t, wiki.Title, createdWiki.Title)
	})
}

func TestGetWiki(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("get wiki successfully", func(t *testing.T) {
		retrievedWiki, resp, err := th.Client.GetWiki(context.Background(), wiki.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, wiki.Id, retrievedWiki.Id)
		require.Equal(t, wiki.Title, retrievedWiki.Title)
	})

	t.Run("fail without read permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.Context.Session().UserId = th.BasicUser.Id

		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		privateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		_, resp, err := client2.GetWiki(context.Background(), privateWiki.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail for non-existent wiki", func(t *testing.T) {
		_, resp, err := th.Client.GetWiki(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestListChannelWikis(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Context.Session().UserId = th.BasicUser.Id

	wiki1 := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Wiki 1",
	}
	wiki1, appErr := th.App.CreateWiki(th.Context, wiki1, th.BasicUser.Id)
	require.Nil(t, appErr)

	wiki2 := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Wiki 2",
	}
	_, appErr = th.App.CreateWiki(th.Context, wiki2, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("list wikis successfully", func(t *testing.T) {
		wikis, resp, err := th.Client.GetWikisForChannel(context.Background(), th.BasicChannel.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, wikis, 2)
	})

	t.Run("list excludes deleted wikis by default", func(t *testing.T) {
		appErr := th.App.DeleteWiki(th.Context, wiki1.Id, th.BasicUser.Id, nil)
		require.Nil(t, appErr)

		wikis, resp, err := th.Client.GetWikisForChannel(context.Background(), th.BasicChannel.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, wikis, 1)
	})

	t.Run("fail without read permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		_, resp, err := client2.GetWikisForChannel(context.Background(), privateChannel.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestUpdateWiki(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)

	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Original Title",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("update wiki successfully", func(t *testing.T) {
		wiki.Title = "Updated Title"
		wiki.Description = "Updated description"

		updatedWiki, resp, err := th.Client.UpdateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, "Updated Title", updatedWiki.Title)
		require.Equal(t, "Updated description", updatedWiki.Description)
	})

	t.Run("fail without edit permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.Context.Session().UserId = th.BasicUser.Id

		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		privateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		privateWiki.Title = "Should not update"
		_, resp, err := client2.UpdateWiki(context.Background(), privateWiki)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("prevent channel ID tampering", func(t *testing.T) {
		anotherChannel := th.CreatePublicChannel(t)

		currentWiki, resp, err := th.Client.GetWiki(context.Background(), wiki.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		originalChannelId := currentWiki.ChannelId
		currentWiki.ChannelId = anotherChannel.Id
		currentWiki.Title = "Trying to move wiki"

		updatedWiki, resp, err := th.Client.UpdateWiki(context.Background(), currentWiki)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, originalChannelId, updatedWiki.ChannelId, "ChannelId should not change")
		require.NotEqual(t, anotherChannel.Id, updatedWiki.ChannelId, "ChannelId should not be tampered")
	})

	t.Run("fail for non-existent wiki", func(t *testing.T) {
		nonExistent := &model.Wiki{
			Id:        model.NewId(),
			ChannelId: th.BasicChannel.Id,
			Title:     "Non-existent",
		}

		_, resp, err := th.Client.UpdateWiki(context.Background(), nonExistent)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestDeleteWiki(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)

	th.Context.Session().UserId = th.BasicUser.Id

	t.Run("delete wiki successfully", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "To be deleted",
		}
		wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		resp, err := th.Client.DeleteWiki(context.Background(), wiki.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		_, resp, err = th.Client.GetWiki(context.Background(), wiki.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("fail without delete permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.Context.Session().UserId = th.BasicUser.Id

		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		privateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		resp, err := client2.DeleteWiki(context.Background(), privateWiki.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail for non-existent wiki", func(t *testing.T) {
		resp, err := th.Client.DeleteWiki(context.Background(), model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestGetPages(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	page1 := &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "Page 1",
		Type:      model.PostTypePage,
	}
	page1, _, appErr = th.App.CreatePost(th.Context, page1, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	appErr = th.App.AddPageToWiki(th.Context, page1.Id, wiki.Id, nil)
	require.Nil(t, appErr)

	page2 := &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "Page 2",
		Type:      model.PostTypePage,
	}
	page2, _, appErr = th.App.CreatePost(th.Context, page2, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	appErr = th.App.AddPageToWiki(th.Context, page2.Id, wiki.Id, nil)
	require.Nil(t, appErr)

	t.Run("get pages successfully", func(t *testing.T) {
		pages, resp, err := th.Client.GetPages(context.Background(), wiki.Id, 0, 100)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, pages, 2)
	})

	t.Run("fail without read permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.Context.Session().UserId = th.BasicUser.Id

		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		privateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		_, resp, err := client2.GetPages(context.Background(), privateWiki.Id, 0, 100)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestGetPage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	wiki1 := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Wiki 1",
	}
	wiki1, appErr := th.App.CreateWiki(th.Context, wiki1, th.BasicUser.Id)
	require.Nil(t, appErr)

	wiki2 := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Wiki 2",
	}
	wiki2, appErr = th.App.CreateWiki(th.Context, wiki2, th.BasicUser.Id)
	require.Nil(t, appErr)

	page, appErr := th.App.CreateWikiPage(th.Context, wiki1.Id, "", "Test Page", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	t.Run("get page from correct wiki successfully", func(t *testing.T) {
		retrievedPage, resp, err := th.Client.GetPage(context.Background(), wiki1.Id, page.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, page.Id, retrievedPage.Id)
	})

	t.Run("fail to get page using wrong wiki id", func(t *testing.T) {
		_, resp, err := th.Client.GetPage(context.Background(), wiki2.Id, page.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("fail to get non-existent page", func(t *testing.T) {
		_, resp, err := th.Client.GetPage(context.Background(), wiki1.Id, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestCrossChannelAccess(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Context.Session().UserId = th.BasicUser.Id

	channel1 := th.BasicChannel
	channel2 := th.CreatePublicChannel(t)

	wiki1 := &model.Wiki{
		ChannelId: channel1.Id,
		Title:     "Channel 1 Wiki",
	}
	wiki1, appErr := th.App.CreateWiki(th.Context, wiki1, th.BasicUser.Id)
	require.Nil(t, appErr)

	wiki2 := &model.Wiki{
		ChannelId: channel2.Id,
		Title:     "Channel 2 Wiki",
	}
	wiki2, appErr = th.App.CreateWiki(th.Context, wiki2, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("wikis are properly scoped to channels", func(t *testing.T) {
		wikis, resp, err := th.Client.GetWikisForChannel(context.Background(), channel1.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, wikis, 1)
		require.Equal(t, wiki1.Id, wikis[0].Id)

		wikis, resp, err = th.Client.GetWikisForChannel(context.Background(), channel2.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, wikis, 1)
		require.Equal(t, wiki2.Id, wikis[0].Id)
	})

	t.Run("cannot attach page from different channel to wiki", func(t *testing.T) {
		pageInChannel1 := &model.Post{
			ChannelId: channel1.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Page in channel 1",
			Type:      model.PostTypePage,
		}
		pageInChannel1, _, appErr = th.App.CreatePost(th.Context, pageInChannel1, channel1, model.CreatePostFlags{})
		require.Nil(t, appErr)

		appErr = th.App.AddPageToWiki(th.Context, pageInChannel1.Id, wiki2.Id, nil)
		require.NotNil(t, appErr)
		require.Equal(t, "app.wiki.add.channel_mismatch", appErr.Id)
	})
}

func TestWikiValidation(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("cannot create wiki with empty title", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "",
		}

		_, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("cannot create wiki with title exceeding max length", func(t *testing.T) {
		longTitle := string(make([]byte, 129))
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     longTitle,
		}

		_, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("cannot create wiki without channel", func(t *testing.T) {
		wiki := &model.Wiki{
			Title: "No Channel Wiki",
		}

		_, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestWikiPermissions(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("create wiki permissions", func(t *testing.T) {
		t.Run("public channel requires PermissionManagePublicChannelProperties", func(t *testing.T) {
			publicChannel := th.CreatePublicChannel(t)
			th.AddUserToChannel(t, th.BasicUser2, publicChannel)

			th.RemovePermissionFromRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			wiki := &model.Wiki{
				ChannelId: publicChannel.Id,
				Title:     "Public Channel Wiki",
			}

			_, resp, err := client2.CreateWiki(context.Background(), wiki)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("private channel requires PermissionManagePrivateChannelProperties", func(t *testing.T) {
			privateChannel := th.CreatePrivateChannel(t)
			th.AddUserToChannel(t, th.BasicUser2, privateChannel)

			th.RemovePermissionFromRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			wiki := &model.Wiki{
				ChannelId: privateChannel.Id,
				Title:     "Private Channel Wiki",
			}

			_, resp, err := client2.CreateWiki(context.Background(), wiki)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("direct message channel allows member to create wiki", func(t *testing.T) {
			dmChannel := th.CreateDmChannel(t, th.BasicUser2)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			wiki := &model.Wiki{
				ChannelId: dmChannel.Id,
				Title:     "DM Channel Wiki",
			}

			createdWiki, resp, err := client2.CreateWiki(context.Background(), wiki)
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)
			require.NotEmpty(t, createdWiki.Id)
		})
	})

	t.Run("edit wiki permissions", func(t *testing.T) {
		t.Run("public channel requires PermissionManagePublicChannelProperties", func(t *testing.T) {
			publicChannel := th.CreatePublicChannel(t)
			th.AddUserToChannel(t, th.BasicUser2, publicChannel)

			th.Context.Session().UserId = th.BasicUser.Id
			wiki := &model.Wiki{
				ChannelId: publicChannel.Id,
				Title:     "Public Wiki",
			}
			wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
			require.Nil(t, appErr)

			th.RemovePermissionFromRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			wiki.Title = "Updated Title"
			_, resp, err := client2.UpdateWiki(context.Background(), wiki)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("private channel requires PermissionManagePrivateChannelProperties", func(t *testing.T) {
			privateChannel := th.CreatePrivateChannel(t)
			th.AddUserToChannel(t, th.BasicUser2, privateChannel)

			th.Context.Session().UserId = th.BasicUser.Id
			wiki := &model.Wiki{
				ChannelId: privateChannel.Id,
				Title:     "Private Wiki",
			}
			wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
			require.Nil(t, appErr)

			th.RemovePermissionFromRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			wiki.Title = "Updated Title"
			_, resp, err := client2.UpdateWiki(context.Background(), wiki)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	})

	t.Run("delete wiki permissions", func(t *testing.T) {
		t.Run("public channel requires PermissionManagePublicChannelProperties", func(t *testing.T) {
			publicChannel := th.CreatePublicChannel(t)
			th.AddUserToChannel(t, th.BasicUser2, publicChannel)

			th.Context.Session().UserId = th.BasicUser.Id
			wiki := &model.Wiki{
				ChannelId: publicChannel.Id,
				Title:     "Public Wiki",
			}
			wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
			require.Nil(t, appErr)

			th.RemovePermissionFromRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			resp, err := client2.DeleteWiki(context.Background(), wiki.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("private channel requires PermissionManagePrivateChannelProperties", func(t *testing.T) {
			privateChannel := th.CreatePrivateChannel(t)
			th.AddUserToChannel(t, th.BasicUser2, privateChannel)

			th.Context.Session().UserId = th.BasicUser.Id
			wiki := &model.Wiki{
				ChannelId: privateChannel.Id,
				Title:     "Private Wiki",
			}
			wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
			require.Nil(t, appErr)

			th.RemovePermissionFromRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			resp, err := client2.DeleteWiki(context.Background(), wiki.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	})

	t.Run("remove page permissions use delete wiki permissions", func(t *testing.T) {
		publicChannel := th.CreatePublicChannel(t)
		th.AddUserToChannel(t, th.BasicUser2, publicChannel)

		th.Context.Session().UserId = th.BasicUser.Id
		wiki := &model.Wiki{
			ChannelId: publicChannel.Id,
			Title:     "Public Wiki",
		}
		wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		page := &model.Post{
			ChannelId: publicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Test Page",
			Type:      model.PostTypePage,
		}
		page, _, appErr = th.App.CreatePost(th.Context, page, publicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		appErr = th.App.AddPageToWiki(th.Context, page.Id, wiki.Id, nil)
		require.Nil(t, appErr)

		th.RemovePermissionFromRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		resp, err := client2.DeletePage(context.Background(), wiki.Id, page.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("removing page from wiki deletes the page", func(t *testing.T) {
		publicChannel := th.CreatePublicChannel(t)
		th.Context.Session().UserId = th.BasicUser.Id

		wiki := &model.Wiki{
			ChannelId: publicChannel.Id,
			Title:     "Test Wiki",
		}
		wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		page := &model.Post{
			ChannelId: publicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Test Page Content",
			Type:      model.PostTypePage,
		}
		page, _, appErr = th.App.CreatePost(th.Context, page, publicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		appErr = th.App.AddPageToWiki(th.Context, page.Id, wiki.Id, nil)
		require.Nil(t, appErr)

		pages, resp, err := th.Client.GetPages(context.Background(), wiki.Id, 0, 100)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, pages, 1)

		th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
		th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
		th.AddPermissionToRole(t, model.PermissionDeletePage.Id, model.ChannelUserRoleId)
		resp, err = th.Client.DeletePage(context.Background(), wiki.Id, page.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		_, appErr = th.App.GetSinglePost(th.Context, page.Id, false)
		require.NotNil(t, appErr, "Page should be deleted when removed from wiki")
		require.Equal(t, http.StatusNotFound, appErr.StatusCode)

		pages, resp, err = th.Client.GetPages(context.Background(), wiki.Id, 0, 100)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, pages, 0)
	})
}

func createTipTapContent(text string) string {
	return `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"` + text + `"}]}]}`
}

func TestPageDraftToPublishE2E(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	t.Run("complete E2E flow: create wiki, save draft, publish page, access via URL", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId:   th.BasicChannel.Id,
			Title:       "Test Wiki for E2E",
			Description: "E2E test wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotEmpty(t, createdWiki.Id)
		require.Equal(t, wiki.ChannelId, createdWiki.ChannelId)

		pageId := model.NewId()
		draftMessage := createTipTapContent("This is test content for the page draft")
		draftTitle := "Test Page Draft"

		savedDraft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, pageId, draftMessage, draftTitle, 0, nil)
		require.Nil(t, appErr)
		savedContent, _ := savedDraft.GetDocumentJSON()
		assert.JSONEq(t, draftMessage, savedContent)
		require.Equal(t, createdWiki.Id, savedDraft.WikiId)
		require.Equal(t, pageId, savedDraft.PageId)
		require.Equal(t, draftTitle, savedDraft.Title)

		retrievedDraft, appErr := th.App.GetPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, pageId, false)
		require.Nil(t, appErr)
		retrievedContent, _ := retrievedDraft.GetDocumentJSON()
		assert.JSONEq(t, draftMessage, retrievedContent)

		updatedDraftMessage := createTipTapContent("Updated test content for the page draft")
		updatedTitle := "Updated Test Page Draft"
		updatedDraft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, pageId, updatedDraftMessage, updatedTitle, savedDraft.UpdateAt, nil)
		require.Nil(t, appErr)
		updatedContent, _ := updatedDraft.GetDocumentJSON()
		assert.JSONEq(t, updatedDraftMessage, updatedContent)

		pageTitle := "Test Page"
		publishedPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
			WikiId: createdWiki.Id,
			PageId: pageId,
			Title:  pageTitle,
		})
		require.Nil(t, appErr)
		require.NotEmpty(t, publishedPage.Id)
		require.Equal(t, model.PostTypePage, publishedPage.Type)
		assert.JSONEq(t, updatedDraftMessage, publishedPage.Message)
		require.Equal(t, th.BasicChannel.Id, publishedPage.ChannelId)
		require.Equal(t, pageTitle, publishedPage.Props["title"])

		_, appErr = th.App.GetPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, pageId, false)
		require.NotNil(t, appErr)
		require.Equal(t, "app.draft.get_page_draft.not_found", appErr.Id)

		retrievedPage, resp, err := th.Client.GetPage(context.Background(), createdWiki.Id, publishedPage.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, publishedPage.Id, retrievedPage.Id)
		assert.JSONEq(t, updatedDraftMessage, retrievedPage.Message)
		require.Equal(t, model.PostTypePage, retrievedPage.Type)

		pages, resp, err := th.Client.GetPages(context.Background(), createdWiki.Id, 0, 100)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, pages, 1)

		var foundPublishedPage bool
		for _, page := range pages {
			if page.Id == publishedPage.Id {
				foundPublishedPage = true
				break
			}
		}
		require.True(t, foundPublishedPage, "Published page should be found in wiki pages list")
	})

	t.Run("publish page with parent creates hierarchy", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Hierarchical Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		parentPageId := model.NewId()
		_, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, parentPageId, createTipTapContent("Parent page content"), "Parent Page", 0, nil)
		require.Nil(t, appErr)

		parentPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
			WikiId: createdWiki.Id,
			PageId: parentPageId,
			Title:  "Parent Page",
		})
		require.Nil(t, appErr)

		childPageId := model.NewId()
		_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, childPageId, createTipTapContent("Child page content"), "Child Page", 0, nil)
		require.Nil(t, appErr)

		childPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, model.PublishPageDraftOptions{
			WikiId:   createdWiki.Id,
			PageId:   childPageId,
			ParentId: parentPage.Id,
			Title:    "Child Page",
		})
		require.Nil(t, appErr)
		require.Equal(t, parentPage.Id, childPage.PageParentId)
	})
}

func TestCreatePageViaWikiApi(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("create page successfully in public channel", func(t *testing.T) {
		page, resp, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Test Page")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotEmpty(t, page.Id)
		require.Equal(t, model.PostTypePage, page.Type)
		require.Equal(t, th.BasicChannel.Id, page.ChannelId)
	})

	t.Run("fail without edit wiki permission in private channel", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.Context.Session().UserId = th.BasicUser.Id

		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		privateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		_, resp, err := client2.CreatePage(context.Background(), privateWiki.Id, "", "Unauthorized Page")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail for non-existent wiki", func(t *testing.T) {
		_, resp, err := th.Client.CreatePage(context.Background(), model.NewId(), "", "Page for non-existent wiki")
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestPagePermissionMatrix(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionDeleteOwnPage.Id, model.ChannelUserRoleId)

	th.AddPermissionToRole(t, model.PermissionDeletePage.Id, model.ChannelAdminRoleId)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)

	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelGuestRoleId)

	t.Run("Public Channel - Page Create Permission", func(t *testing.T) {
		publicChannel := th.CreatePublicChannel(t)
		th.AddUserToChannel(t, th.BasicUser2, publicChannel)

		wiki := &model.Wiki{ChannelId: publicChannel.Id, Title: "Test Wiki"}
		wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		t.Run("user with permission can create page", func(t *testing.T) {
			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			_, resp, err := client2.CreatePage(context.Background(), wiki.Id, "", "Test Page")
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)
		})

		t.Run("user without permission cannot create page", func(t *testing.T) {
			th.RemovePermissionFromRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			_, resp, err := client2.CreatePage(context.Background(), wiki.Id, "", "Test Page")
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	})

	t.Run("Private Channel - Page Create Permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.AddUserToChannel(t, th.BasicUser2, privateChannel)

		wiki := &model.Wiki{ChannelId: privateChannel.Id, Title: "Private Wiki"}
		wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		t.Run("user with permission can create page", func(t *testing.T) {
			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			_, resp, err := client2.CreatePage(context.Background(), wiki.Id, "", "Private Page")
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)
		})

		t.Run("user without permission cannot create page", func(t *testing.T) {
			th.RemovePermissionFromRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			_, resp, err := client2.CreatePage(context.Background(), wiki.Id, "", "Private Page")
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	})

	t.Run("Page Read Permission", func(t *testing.T) {
		publicChannel := th.CreatePublicChannel(t)
		th.AddUserToChannel(t, th.BasicUser2, publicChannel)

		wiki := &model.Wiki{ChannelId: publicChannel.Id, Title: "Read Test Wiki"}
		wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		page, resp, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Readable Page")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		t.Run("user with read permission can view page", func(t *testing.T) {
			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			_, resp, err := client2.GetPage(context.Background(), wiki.Id, page.Id)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
		})

		t.Run("user without read permission cannot view page", func(t *testing.T) {
			th.RemovePermissionFromRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			_, resp, err := client2.GetPage(context.Background(), wiki.Id, page.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	})

	t.Run("Page Delete Permission - Ownership", func(t *testing.T) {
		publicChannel := th.CreatePublicChannel(t)
		th.AddUserToChannel(t, th.BasicUser2, publicChannel)

		wiki := &model.Wiki{ChannelId: publicChannel.Id, Title: "Delete Test Wiki"}
		wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		t.Run("author can delete their own page", func(t *testing.T) {
			page, resp, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Deletable Page")
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)

			resp, err = th.Client.DeletePage(context.Background(), wiki.Id, page.Id)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
		})

		t.Run("non-author channel user cannot delete others page", func(t *testing.T) {
			page, resp, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Deletable Page 2")
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			resp, err = client2.DeletePage(context.Background(), wiki.Id, page.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("channel admin can delete any page", func(t *testing.T) {
			page, resp, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Deletable Page 3")
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			_, appErr := th.App.UpdateChannelMemberRoles(th.Context, publicChannel.Id, th.BasicUser2.Id, "channel_user channel_admin")
			require.Nil(t, appErr)

			resp, err = client2.DeletePage(context.Background(), wiki.Id, page.Id)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
		})
	})

	t.Run("Additive Permission Model - Wiki and Page", func(t *testing.T) {
		publicChannel := th.CreatePublicChannel(t)
		th.AddUserToChannel(t, th.BasicUser2, publicChannel)

		wiki := &model.Wiki{ChannelId: publicChannel.Id, Title: "Additive Test Wiki"}
		wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		t.Run("requires both wiki edit and page create permissions", func(t *testing.T) {
			th.RemovePermissionFromRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			_, resp, err := client2.CreatePage(context.Background(), wiki.Id, "", "Additive Test Page")
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("requires both wiki delete and page read permissions", func(t *testing.T) {
			page, resp, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Additive Delete Test")
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)

			th.RemovePermissionFromRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			resp, err = client2.DeletePage(context.Background(), wiki.Id, page.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	})
}

func TestPageGuestPermissions(t *testing.T) {
	t.Skip("Guest login fails in test environment - CreateGuestAndClient has infrastructure issues")

	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelGuestRoleId)

	publicChannel := th.CreatePublicChannel(t)
	guest, guestClient := th.CreateGuestAndClient(t)
	th.LinkUserToTeam(t, guest, th.BasicTeam)
	th.AddUserToChannel(t, guest, publicChannel)

	wiki := &model.Wiki{ChannelId: publicChannel.Id, Title: "Guest Test Wiki"}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	page, resp, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Guest Readable Page")
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	t.Run("guest can read page", func(t *testing.T) {
		_, resp, err := guestClient.GetPage(context.Background(), wiki.Id, page.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})

	t.Run("guest cannot create page", func(t *testing.T) {
		_, resp, err := guestClient.CreatePage(context.Background(), wiki.Id, "", "Guest Page")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("guest cannot delete page", func(t *testing.T) {
		resp, err := guestClient.DeletePage(context.Background(), wiki.Id, page.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestPageCommentsE2E(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionDeletePage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki for Comments",
	}
	createdWiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	page, resp, err := th.Client.CreatePage(context.Background(), createdWiki.Id, "", "Test Page for Comments")
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	t.Run("create page comment and verify type field is set correctly", func(t *testing.T) {
		comment, resp, err := th.Client.CreatePageComment(context.Background(), createdWiki.Id, page.Id, "This is a top-level comment")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotEmpty(t, comment.Id)
		require.Equal(t, model.PostTypePageComment, comment.Type, "Comment should have Type='page_comment'")
		require.Equal(t, th.BasicChannel.Id, comment.ChannelId)
		require.Equal(t, page.Id, comment.RootId, "Comment RootId should point to page (flat model)")
		require.Equal(t, th.BasicUser.Id, comment.UserId)
		require.Equal(t, "This is a top-level comment", comment.Message)

		require.NotNil(t, comment.Props)
		require.Equal(t, page.Id, comment.Props[model.PagePropsPageID], "Comment props should contain page_id")
		_, hasParentCommentId := comment.Props[model.PagePropsParentCommentID]
		require.False(t, hasParentCommentId, "Top-level comment should not have parent_comment_id")
	})

	t.Run("create reply to comment and verify flat model (RootId = pageId)", func(t *testing.T) {
		topLevelComment, resp, err := th.Client.CreatePageComment(context.Background(), createdWiki.Id, page.Id, "Comment to reply to")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		reply, resp, err := th.Client.CreatePageCommentReply(context.Background(), createdWiki.Id, page.Id, topLevelComment.Id, "This is a reply")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotEmpty(t, reply.Id)
		require.Equal(t, model.PostTypePageComment, reply.Type, "Reply should also have Type='page_comment'")
		require.Equal(t, th.BasicChannel.Id, reply.ChannelId)
		require.Equal(t, page.Id, reply.RootId, "Reply RootId should point to page, NOT to parent comment (flat model)")
		require.Equal(t, th.BasicUser.Id, reply.UserId)

		require.NotNil(t, reply.Props)
		require.Equal(t, page.Id, reply.Props[model.PagePropsPageID], "Reply props should contain page_id")
		require.Equal(t, topLevelComment.Id, reply.Props[model.PagePropsParentCommentID], "Reply props should contain parent_comment_id")
	})

	t.Run("inline comments appear in channel feed (GetPostsForChannel)", func(t *testing.T) {
		regularPost, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Regular channel post",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		// Create inline comments directly via app layer (client doesn't support inline_anchor parameter)
		inlineAnchor := map[string]any{
			"text":      "test anchor text",
			"anchor_id": model.NewId(),
		}
		inlineComment1, appErr := th.App.CreatePageComment(th.Context, page.Id, "Inline comment should appear in feed", inlineAnchor, "", nil, nil)
		require.Nil(t, appErr)

		inlineComment2, appErr := th.App.CreatePageComment(th.Context, page.Id, "Another inline comment", inlineAnchor, "", nil, nil)
		require.Nil(t, appErr)

		channelPosts, resp, err := th.Client.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 0, 100, "", false, false)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		foundRegularPost := false
		foundInlineComment1 := false
		foundInlineComment2 := false

		for _, post := range channelPosts.Posts {
			if post.Id == regularPost.Id {
				foundRegularPost = true
			}
			if post.Id == inlineComment1.Id {
				foundInlineComment1 = true
			}
			if post.Id == inlineComment2.Id {
				foundInlineComment2 = true
			}
		}

		require.True(t, foundRegularPost, "Regular post should appear in channel feed")
		require.True(t, foundInlineComment1, "First inline comment should appear in channel feed")
		require.True(t, foundInlineComment2, "Second inline comment should appear in channel feed")
	})

	t.Run("pages do NOT appear in channel feed (consistent with Slack Canvas UX)", func(t *testing.T) {
		regularPost, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Regular channel post should appear",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		newPage, resp, err := th.Client.CreatePage(context.Background(), createdWiki.Id, "", "Another Test Page")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Equal(t, model.PostTypePage, newPage.Type)

		channelPosts, resp, err := th.Client.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 0, 100, "", false, false)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		foundRegularPost := false
		foundPages := 0

		for _, post := range channelPosts.Posts {
			if post.Id == regularPost.Id {
				foundRegularPost = true
			}
			if post.Type == model.PostTypePage {
				foundPages++
			}
		}

		require.True(t, foundRegularPost, "Regular post should appear in channel feed")
		require.Equal(t, 0, foundPages, "Pages should NOT appear in channel feed (consistent with Slack Canvas UX)")
	})

	t.Run("inline comments do NOT appear in channel search", func(t *testing.T) {
		// Create inline comment directly via app layer
		inlineAnchor := map[string]any{
			"text":      "search test anchor text",
			"anchor_id": model.NewId(),
		}
		_, appErr := th.App.CreatePageComment(th.Context, page.Id, "Unique search term: xyzabc123", inlineAnchor, "", nil, nil)
		require.Nil(t, appErr)

		regularPost, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Regular post with unique term: qwerty456",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		term1 := "xyzabc123"
		isOr1 := false
		searchResults, resp, err := th.Client.SearchPostsWithParams(context.Background(), th.BasicTeam.Id, &model.SearchParameter{
			Terms:      &term1,
			IsOrSearch: &isOr1,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		foundPageComment := false
		for _, post := range searchResults.Posts {
			if post.Type == model.PostTypePageComment {
				foundPageComment = true
			}
		}
		require.False(t, foundPageComment, "Inline comments should NOT appear in channel search results")

		term2 := "qwerty456"
		isOr2 := false
		searchResults2, resp, err := th.Client.SearchPostsWithParams(context.Background(), th.BasicTeam.Id, &model.SearchParameter{
			Terms:      &term2,
			IsOrSearch: &isOr2,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		foundRegularPost := false
		for _, post := range searchResults2.Posts {
			if post.Id == regularPost.Id {
				foundRegularPost = true
			}
		}
		require.True(t, foundRegularPost, "Regular posts should appear in search results")
	})

	t.Run("deleting page deletes all its comments (cascade delete)", func(t *testing.T) {
		testPage, resp, err := th.Client.CreatePage(context.Background(), createdWiki.Id, "", "Page to delete with comments")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		comment1, resp, err := th.Client.CreatePageComment(context.Background(), createdWiki.Id, testPage.Id, "Comment 1")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		comment2, resp, err := th.Client.CreatePageComment(context.Background(), createdWiki.Id, testPage.Id, "Comment 2")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		reply, resp, err := th.Client.CreatePageCommentReply(context.Background(), createdWiki.Id, testPage.Id, comment1.Id, "Reply to comment 1")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		retrievedComment1, appErr := th.App.GetSinglePost(th.Context, comment1.Id, false)
		require.Nil(t, appErr)
		require.Equal(t, comment1.Id, retrievedComment1.Id)

		resp, err = th.Client.DeletePage(context.Background(), createdWiki.Id, testPage.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		_, appErr = th.App.GetSinglePost(th.Context, testPage.Id, false)
		require.NotNil(t, appErr, "Deleted page should not be retrievable")

		_, appErr = th.App.GetSinglePost(th.Context, comment1.Id, false)
		require.NotNil(t, appErr, "Comment 1 should be deleted when page is deleted")

		_, appErr = th.App.GetSinglePost(th.Context, comment2.Id, false)
		require.NotNil(t, appErr, "Comment 2 should be deleted when page is deleted")

		_, appErr = th.App.GetSinglePost(th.Context, reply.Id, false)
		require.NotNil(t, appErr, "Reply should be deleted when page is deleted")
	})

	t.Run("cannot reply to a reply (one-level nesting enforced)", func(t *testing.T) {
		topLevelComment, resp, err := th.Client.CreatePageComment(context.Background(), createdWiki.Id, page.Id, "Top-level for nesting test")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		reply1, resp, err := th.Client.CreatePageCommentReply(context.Background(), createdWiki.Id, page.Id, topLevelComment.Id, "First reply")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		_, resp, err = th.Client.CreatePageCommentReply(context.Background(), createdWiki.Id, page.Id, reply1.Id, "Reply to reply (should fail)")
		require.Error(t, err, "Should not be able to reply to a reply")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("multiple users can comment on same page", func(t *testing.T) {
		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)

		comment1, resp, err := th.Client.CreatePageComment(context.Background(), createdWiki.Id, page.Id, "Comment by BasicUser")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Equal(t, th.BasicUser.Id, comment1.UserId)

		comment2, resp, err := client2.CreatePageComment(context.Background(), createdWiki.Id, page.Id, "Comment by BasicUser2")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.Equal(t, th.BasicUser2.Id, comment2.UserId)

		require.NotEqual(t, comment1.Id, comment2.Id, "Comments should have different IDs")
		require.Equal(t, page.Id, comment1.RootId, "Both comments should reference the same page")
		require.Equal(t, page.Id, comment2.RootId, "Both comments should reference the same page")
	})

	t.Run("verify GetCommentsForPage returns page + all comments/replies", func(t *testing.T) {
		testPage2, resp, err := th.Client.CreatePage(context.Background(), createdWiki.Id, "", "Page for GetCommentsForPage test")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		comment1, resp, err := th.Client.CreatePageComment(context.Background(), createdWiki.Id, testPage2.Id, "Comment 1 on testPage2")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		comment2, resp, err := th.Client.CreatePageComment(context.Background(), createdWiki.Id, testPage2.Id, "Comment 2 on testPage2")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		reply, resp, err := th.Client.CreatePageCommentReply(context.Background(), createdWiki.Id, testPage2.Id, comment1.Id, "Reply to comment 1")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		commentsForPage, appErr := th.App.Srv().Store().Page().GetCommentsForPage(testPage2.Id, false, 0, 100)
		require.NoError(t, appErr)
		require.NotNil(t, commentsForPage)

		require.Len(t, commentsForPage.Posts, 4, "Should return page + 2 comments + 1 reply = 4 posts")

		require.Contains(t, commentsForPage.Posts, testPage2.Id, "Should include the page itself")
		require.Contains(t, commentsForPage.Posts, comment1.Id, "Should include comment1")
		require.Contains(t, commentsForPage.Posts, comment2.Id, "Should include comment2")
		require.Contains(t, commentsForPage.Posts, reply.Id, "Should include reply")

		require.Equal(t, model.PostTypePage, commentsForPage.Posts[testPage2.Id].Type)
		require.Equal(t, model.PostTypePageComment, commentsForPage.Posts[comment1.Id].Type)
		require.Equal(t, model.PostTypePageComment, commentsForPage.Posts[comment2.Id].Type)
		require.Equal(t, model.PostTypePageComment, commentsForPage.Posts[reply.Id].Type)
	})
}

func TestSearchPages(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Search Test Wiki",
	}
	createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	t.Run("pages appear in search results by title", func(t *testing.T) {
		// Create page with title - the title is included in SearchText via CreateWikiPage
		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "UniquePageTitleForSearchTest", "", th.BasicUser.Id, "UniquePageTitleForSearchTest", "")
		require.Nil(t, appErr)

		term := "UniquePageTitleForSearchTest"
		isOr := false
		searchResults, resp, err := th.Client.SearchPostsWithParams(context.Background(), th.BasicTeam.Id, &model.SearchParameter{
			Terms:      &term,
			IsOrSearch: &isOr,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		foundPage := false
		for _, post := range searchResults.Posts {
			if post.Id == page.Id {
				foundPage = true
				require.Equal(t, model.PostTypePage, post.Type, "Search result should be a page")
			}
		}
		require.True(t, foundPage, "Page should appear in search results by title")
	})

	t.Run("pages appear in search results by content", func(t *testing.T) {
		// Create page with searchable content directly
		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page for content search", "", th.BasicUser.Id, "UniqueContentKeywordXYZ123 for search testing", "")
		require.Nil(t, appErr)

		term := "UniqueContentKeywordXYZ123"
		isOr := false
		searchResults, resp, err := th.Client.SearchPostsWithParams(context.Background(), th.BasicTeam.Id, &model.SearchParameter{
			Terms:      &term,
			IsOrSearch: &isOr,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		foundPage := false
		for _, post := range searchResults.Posts {
			if post.Id == page.Id {
				foundPage = true
				require.Equal(t, model.PostTypePage, post.Type, "Search result should be a page")
			}
		}
		require.True(t, foundPage, "Page should appear in search results by content")
	})

	t.Run("pages in private channels not visible to non-members", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)

		th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)

		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		createdPrivateWiki, resp, err := th.Client.CreateWiki(context.Background(), privateWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		privatePage, resp, err := th.Client.CreatePage(context.Background(), createdPrivateWiki.Id, "", "PrivateChannelPageUniqueTitle")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		term := "PrivateChannelPageUniqueTitle"
		isOr := false
		searchResults, resp, err := client2.SearchPostsWithParams(context.Background(), th.BasicTeam.Id, &model.SearchParameter{
			Terms:      &term,
			IsOrSearch: &isOr,
		})
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		foundPrivatePage := false
		for _, post := range searchResults.Posts {
			if post.Id == privatePage.Id {
				foundPrivatePage = true
			}
		}
		require.False(t, foundPrivatePage, "Pages in private channels should NOT be visible to non-members via search")
	})

	t.Run("search with special characters does not cause errors", func(t *testing.T) {
		specialTerms := []string{
			"test%percent",
			"test_underscore",
			"test'quote",
			"test\"doublequote",
		}

		for _, term := range specialTerms {
			isOr := false
			_, resp, err := th.Client.SearchPostsWithParams(context.Background(), th.BasicTeam.Id, &model.SearchParameter{
				Terms:      &term,
				IsOrSearch: &isOr,
			})
			require.NoError(t, err, "Search with special character should not cause error: %s", term)
			CheckOKStatus(t, resp)
		}
	})
}

func TestMovePageToWiki(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionDeleteOwnPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionDeleteOwnPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	t.Run("successfully move page to target wiki in same channel", func(t *testing.T) {
		sourceWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Source Wiki",
		}
		createdSourceWiki, resp, err := th.Client.CreateWiki(context.Background(), sourceWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		targetWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Target Wiki",
		}
		createdTargetWiki, resp, err := th.Client.CreateWiki(context.Background(), targetWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page to Move", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		resp, err = th.Client.MovePageToWiki(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		movedPageWikiId, appErr := th.App.GetWikiIdForPage(th.Context, page.Id)
		require.Nil(t, appErr)
		require.Equal(t, createdTargetWiki.Id, movedPageWikiId)
	})

	t.Run("successfully move page with children (subtree)", func(t *testing.T) {
		sourceWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Source Wiki with Hierarchy",
		}
		createdSourceWiki, resp, err := th.Client.CreateWiki(context.Background(), sourceWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		targetWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Target Wiki for Subtree",
		}
		createdTargetWiki, resp, err := th.Client.CreateWiki(context.Background(), targetWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		parentPage, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Parent Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		childPage1, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, parentPage.Id, "Child Page 1", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		childPage2, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, parentPage.Id, "Child Page 2", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		resp, err = th.Client.MovePageToWiki(context.Background(), createdSourceWiki.Id, parentPage.Id, createdTargetWiki.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		parentWikiId, appErr := th.App.GetWikiIdForPage(th.Context, parentPage.Id)
		require.Nil(t, appErr)
		require.Equal(t, createdTargetWiki.Id, parentWikiId)

		child1WikiId, appErr := th.App.GetWikiIdForPage(th.Context, childPage1.Id)
		require.Nil(t, appErr)
		require.Equal(t, createdTargetWiki.Id, child1WikiId)

		child2WikiId, appErr := th.App.GetWikiIdForPage(th.Context, childPage2.Id)
		require.Nil(t, appErr)
		require.Equal(t, createdTargetWiki.Id, child2WikiId)
	})

	t.Run("fail when user lacks delete permission on source wiki", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		_, err := th.App.AddUserToChannel(th.Context, th.BasicUser, privateChannel, false)
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser.Id
		sourceWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Source Wiki",
		}
		createdSourceWiki, appErr := th.App.CreateWiki(th.Context, sourceWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		targetWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Target Wiki",
		}
		createdTargetWiki, appErr := th.App.CreateWiki(th.Context, targetWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Private Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		resp, moveErr := client2.MovePageToWiki(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id)
		require.Error(t, moveErr)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail when user cannot delete another user's page", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		_, err := th.App.AddUserToChannel(th.Context, th.BasicUser, privateChannel, false)
		require.Nil(t, err)
		_, err = th.App.AddUserToChannel(th.Context, th.BasicUser2, privateChannel, false)
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser.Id
		sourceWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Source Wiki Delete Test",
		}
		createdSourceWiki, appErr := th.App.CreateWiki(th.Context, sourceWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		targetWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Target Wiki Delete Test",
		}
		createdTargetWiki, appErr := th.App.CreateWiki(th.Context, targetWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page Owned By User1", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		resp, moveErr := client2.MovePageToWiki(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id)
		require.Error(t, moveErr)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail when user lacks create permission on target wiki", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		_, err := th.App.AddUserToChannel(th.Context, th.BasicUser, privateChannel, false)
		require.Nil(t, err)
		_, err = th.App.AddUserToChannel(th.Context, th.BasicUser2, privateChannel, false)
		require.Nil(t, err)

		th.Context.Session().UserId = th.BasicUser.Id
		sourceWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Source Wiki",
		}
		createdSourceWiki, appErr := th.App.CreateWiki(th.Context, sourceWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		targetWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Restricted Target Wiki",
		}
		createdTargetWiki, appErr := th.App.CreateWiki(th.Context, targetWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page to Move", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		th.RemovePermissionFromRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		resp, moveErr := client2.MovePageToWiki(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id)
		require.Error(t, moveErr)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("system admin can move pages", func(t *testing.T) {
		th.LinkUserToTeam(t, th.SystemAdminUser, th.BasicTeam)
		th.AddUserToChannel(t, th.SystemAdminUser, th.BasicChannel)
		_, appErr := th.App.UpdateChannelMemberRoles(th.Context, th.BasicChannel.Id, th.SystemAdminUser.Id, "channel_user channel_admin")
		require.Nil(t, appErr)

		sourceWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Admin Source Wiki",
		}
		createdSourceWiki, resp, err := th.Client.CreateWiki(context.Background(), sourceWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		targetWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Admin Target Wiki",
		}
		createdTargetWiki, resp, err := th.Client.CreateWiki(context.Background(), targetWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Admin Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		resp, err = th.SystemAdminClient.MovePageToWiki(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		movedPageWikiId, appErr := th.App.GetWikiIdForPage(th.Context, page.Id)
		require.Nil(t, appErr)
		require.Equal(t, createdTargetWiki.Id, movedPageWikiId)
	})

	t.Run("fail with invalid page ID", func(t *testing.T) {
		sourceWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Source Wiki",
		}
		createdSourceWiki, resp, err := th.Client.CreateWiki(context.Background(), sourceWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		targetWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Target Wiki",
		}
		createdTargetWiki, resp, err := th.Client.CreateWiki(context.Background(), targetWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		resp, err = th.Client.MovePageToWiki(context.Background(), createdSourceWiki.Id, "invalid", createdTargetWiki.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("fail with non-existent page", func(t *testing.T) {
		sourceWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Source Wiki",
		}
		createdSourceWiki, resp, err := th.Client.CreateWiki(context.Background(), sourceWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		targetWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Target Wiki",
		}
		createdTargetWiki, resp, err := th.Client.CreateWiki(context.Background(), targetWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		nonExistentPageId := model.NewId()

		resp, err = th.Client.MovePageToWiki(context.Background(), createdSourceWiki.Id, nonExistentPageId, createdTargetWiki.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("fail with invalid wiki ID", func(t *testing.T) {
		sourceWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Source Wiki",
		}
		createdSourceWiki, resp, err := th.Client.CreateWiki(context.Background(), sourceWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		resp, err = th.Client.MovePageToWiki(context.Background(), "invalid", page.Id, createdSourceWiki.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("fail with invalid target wiki ID", func(t *testing.T) {
		sourceWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Source Wiki",
		}
		createdSourceWiki, resp, err := th.Client.CreateWiki(context.Background(), sourceWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		resp, err = th.Client.MovePageToWiki(context.Background(), createdSourceWiki.Id, page.Id, "invalid")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("fail with non-existent target wiki", func(t *testing.T) {
		sourceWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Source Wiki",
		}
		createdSourceWiki, resp, err := th.Client.CreateWiki(context.Background(), sourceWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		nonExistentWikiId := model.NewId()

		resp, err = th.Client.MovePageToWiki(context.Background(), createdSourceWiki.Id, page.Id, nonExistentWikiId)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("fail when page is not in source wiki", func(t *testing.T) {
		wiki1 := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Wiki 1",
		}
		createdWiki1, resp, err := th.Client.CreateWiki(context.Background(), wiki1)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		wiki2 := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Wiki 2",
		}
		createdWiki2, resp, err := th.Client.CreateWiki(context.Background(), wiki2)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		wiki3 := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Wiki 3",
		}
		createdWiki3, resp, err := th.Client.CreateWiki(context.Background(), wiki3)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki2.Id, "", "Page in Wiki 2", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		resp, err = th.Client.MovePageToWiki(context.Background(), createdWiki1.Id, page.Id, createdWiki3.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("idempotent when source and target wiki are the same", func(t *testing.T) {
		sourceWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Same Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), sourceWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		resp, err = th.Client.MovePageToWiki(context.Background(), createdWiki.Id, page.Id, createdWiki.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		pageWikiId, appErr := th.App.GetWikiIdForPage(th.Context, page.Id)
		require.Nil(t, appErr)
		require.Equal(t, createdWiki.Id, pageWikiId)
	})

	t.Run("fail when moving between different channels", func(t *testing.T) {
		channel2 := th.CreatePublicChannel(t)

		sourceWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Channel 1 Wiki",
		}
		createdSourceWiki, resp, err := th.Client.CreateWiki(context.Background(), sourceWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		targetWiki := &model.Wiki{
			ChannelId: channel2.Id,
			Title:     "Channel 2 Wiki",
		}
		createdTargetWiki, resp, err := th.Client.CreateWiki(context.Background(), targetWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		resp, err = th.Client.MovePageToWiki(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestDuplicatePage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	t.Run("successfully duplicate page to target wiki in same channel", func(t *testing.T) {
		sourceWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Source Wiki",
		}
		createdSourceWiki, resp, err := th.Client.CreateWiki(context.Background(), sourceWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		targetWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Target Wiki",
		}
		createdTargetWiki, resp, err := th.Client.CreateWiki(context.Background(), targetWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Original Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		duplicatedPage, resp, err := th.Client.DuplicatePage(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id, nil, nil)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, duplicatedPage)
		require.NotEqual(t, page.Id, duplicatedPage.Id)
		require.Equal(t, "Copy of Original Page", duplicatedPage.Props["title"])

		duplicatedPageWikiId, appErr := th.App.GetWikiIdForPage(th.Context, duplicatedPage.Id)
		require.Nil(t, appErr)
		require.Equal(t, createdTargetWiki.Id, duplicatedPageWikiId)
	})

	t.Run("successfully duplicate page with custom title", func(t *testing.T) {
		sourceWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Source Wiki",
		}
		createdSourceWiki, resp, err := th.Client.CreateWiki(context.Background(), sourceWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		targetWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Target Wiki",
		}
		createdTargetWiki, resp, err := th.Client.CreateWiki(context.Background(), targetWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Original Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		customTitle := "My Custom Title"
		duplicatedPage, resp, err := th.Client.DuplicatePage(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id, nil, &customTitle)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, duplicatedPage)
		require.Equal(t, customTitle, duplicatedPage.Props["title"])
	})

	t.Run("successfully duplicate page with parent", func(t *testing.T) {
		targetWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Target Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), targetWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		parentPage, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Parent Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		originalPage, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Original Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		duplicatedPage, resp, err := th.Client.DuplicatePage(context.Background(), createdWiki.Id, originalPage.Id, createdWiki.Id, &parentPage.Id, nil)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, duplicatedPage)
		require.Equal(t, parentPage.Id, duplicatedPage.PageParentId)
	})

	t.Run("fail when user lacks read permission on source page", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		_, addErr := th.App.AddUserToChannel(th.Context, th.BasicUser, privateChannel, false)
		require.Nil(t, addErr)

		th.Context.Session().UserId = th.BasicUser.Id
		sourceWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Source Wiki",
		}
		createdSourceWiki, appErr := th.App.CreateWiki(th.Context, sourceWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		targetWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Target Wiki",
		}
		createdTargetWiki, appErr := th.App.CreateWiki(th.Context, targetWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Private Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		_, resp, err := client2.DuplicatePage(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id, nil, nil)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail when user lacks create permission on target wiki", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		_, addErr := th.App.AddUserToChannel(th.Context, th.BasicUser, privateChannel, false)
		require.Nil(t, addErr)
		_, addErr = th.App.AddUserToChannel(th.Context, th.BasicUser2, privateChannel, false)
		require.Nil(t, addErr)

		th.Context.Session().UserId = th.BasicUser.Id
		sourceWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Source Wiki",
		}
		createdSourceWiki, appErr := th.App.CreateWiki(th.Context, sourceWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		targetWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Restricted Target Wiki",
		}
		createdTargetWiki, appErr := th.App.CreateWiki(th.Context, targetWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page to Duplicate", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		th.RemovePermissionFromRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		_, resp, err := client2.DuplicatePage(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id, nil, nil)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail when duplicating across channels", func(t *testing.T) {
		channel1 := th.BasicChannel
		channel2 := th.CreatePublicChannel(t)

		sourceWiki := &model.Wiki{
			ChannelId: channel1.Id,
			Title:     "Source Wiki",
		}
		createdSourceWiki, resp, err := th.Client.CreateWiki(context.Background(), sourceWiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		targetWiki := &model.Wiki{
			ChannelId: channel2.Id,
			Title:     "Target Wiki",
		}
		th.Context.Session().UserId = th.BasicUser.Id
		createdTargetWiki, appErr := th.App.CreateWiki(th.Context, targetWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		_, resp, err = th.Client.DuplicatePage(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id, nil, nil)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestGetPageBreadcrumb(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	t.Run("get breadcrumb for root page", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		rootPage, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Root Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		breadcrumb, resp, err := th.Client.GetPageBreadcrumb(context.Background(), createdWiki.Id, rootPage.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, breadcrumb)
		require.Len(t, breadcrumb.Items, 1)
		require.Equal(t, "Test Wiki", breadcrumb.Items[0].Title)
		require.Equal(t, "wiki", breadcrumb.Items[0].Type)
		require.Equal(t, rootPage.Id, breadcrumb.CurrentPage.Id)
		require.Equal(t, "Root Page", breadcrumb.CurrentPage.Title)
	})

	t.Run("get breadcrumb for 3-level hierarchy", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Hierarchical Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		level1, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Level 1", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		level2, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, level1.Id, "Level 2", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		level3, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, level2.Id, "Level 3", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		breadcrumb, resp, err := th.Client.GetPageBreadcrumb(context.Background(), createdWiki.Id, level3.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, breadcrumb)
		require.Len(t, breadcrumb.Items, 3)
		require.Equal(t, "Hierarchical Wiki", breadcrumb.Items[0].Title)
		require.Equal(t, "Level 1", breadcrumb.Items[1].Title)
		require.Equal(t, "Level 2", breadcrumb.Items[2].Title)
		require.Equal(t, "Level 3", breadcrumb.CurrentPage.Title)
	})

	t.Run("get breadcrumb with URL construction", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "URL Test Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Test Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		breadcrumb, resp, err := th.Client.GetPageBreadcrumb(context.Background(), createdWiki.Id, page.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, breadcrumb)
		require.Contains(t, breadcrumb.Items[0].Path, th.BasicTeam.Name)
		require.Contains(t, breadcrumb.Items[0].Path, "/wiki/")
		require.Contains(t, breadcrumb.Items[0].Path, th.BasicChannel.Id)
		require.Contains(t, breadcrumb.Items[0].Path, createdWiki.Id)
		require.Contains(t, breadcrumb.CurrentPage.Path, page.Id)
	})

	t.Run("fail when page not found", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		_, resp, err = th.Client.GetPageBreadcrumb(context.Background(), createdWiki.Id, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("fail when wiki not found", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Test Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		_, resp, err = th.Client.GetPageBreadcrumb(context.Background(), model.NewId(), page.Id)
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("fail when page belongs to different wiki", func(t *testing.T) {
		wiki1 := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Wiki 1",
		}
		createdWiki1, resp, err := th.Client.CreateWiki(context.Background(), wiki1)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		wiki2 := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Wiki 2",
		}
		createdWiki2, resp, err := th.Client.CreateWiki(context.Background(), wiki2)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki1.Id, "", "Test Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		_, resp, err = th.Client.GetPageBreadcrumb(context.Background(), createdWiki2.Id, page.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("fail without read permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)

		th.Context.Session().UserId = th.BasicUser.Id
		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		createdPrivateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		page, appErr := th.App.CreateWikiPage(th.Context, createdPrivateWiki.Id, "", "Private Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, loginErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, loginErr)

		_, resp, err := client2.GetPageBreadcrumb(context.Background(), createdPrivateWiki.Id, page.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestMovePage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	t.Run("successfully change page parent", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		parent1, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Parent 1", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		parent2, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Parent 2", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		child, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, parent1.Id, "Child", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		resp, err = th.Client.MovePageParent(context.Background(), createdWiki.Id, child.Id, parent2.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		updatedChild, appErr := th.App.GetSinglePost(th.Context, child.Id, false)
		require.Nil(t, appErr)
		require.Equal(t, parent2.Id, updatedChild.PageParentId)
	})

	t.Run("successfully set page to root (empty parent)", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		parent, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Parent", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		child, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, parent.Id, "Child", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		resp, err = th.Client.MovePageParent(context.Background(), createdWiki.Id, child.Id, "")
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		updatedChild, appErr := th.App.GetSinglePost(th.Context, child.Id, false)
		require.Nil(t, appErr)
		require.Equal(t, "", updatedChild.PageParentId)
	})

	t.Run("fail with invalid parent ID format", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Test Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		resp, err = th.Client.MovePageParent(context.Background(), createdWiki.Id, page.Id, "invalid-id")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("fail when parent not found", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Test Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		resp, err = th.Client.MovePageParent(context.Background(), createdWiki.Id, page.Id, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("fail when parent is not a page", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Test Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		regularPost, _, postErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Regular post",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, postErr)

		resp, err = th.Client.MovePageParent(context.Background(), createdWiki.Id, page.Id, regularPost.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("fail when page belongs to different wiki", func(t *testing.T) {
		wiki1 := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Wiki 1",
		}
		createdWiki1, resp, err := th.Client.CreateWiki(context.Background(), wiki1)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		wiki2 := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Wiki 2",
		}
		createdWiki2, resp, err := th.Client.CreateWiki(context.Background(), wiki2)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page1, appErr := th.App.CreateWikiPage(th.Context, createdWiki1.Id, "", "Page 1", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		page2, appErr := th.App.CreateWikiPage(th.Context, createdWiki2.Id, "", "Page 2", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		resp, err = th.Client.MovePageParent(context.Background(), createdWiki1.Id, page1.Id, page2.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("fail without edit permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)

		th.Context.Session().UserId = th.BasicUser.Id
		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		createdPrivateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		page, appErr := th.App.CreateWikiPage(th.Context, createdPrivateWiki.Id, "", "Private Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		parent, appErr := th.App.CreateWikiPage(th.Context, createdPrivateWiki.Id, "", "Private Parent", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, loginErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, loginErr)

		resp, err := client2.MovePageParent(context.Background(), createdPrivateWiki.Id, page.Id, parent.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("prevent circular reference", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		parent, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Parent", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		child, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, parent.Id, "Child", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		resp, err = th.Client.MovePageParent(context.Background(), createdWiki.Id, parent.Id, child.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestMovePageWithReorder(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	t.Run("successfully reorder page among siblings", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Reorder Test Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		// Create 3 root-level pages
		page1, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page 1", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		page2, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page 2", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		page3, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page 3", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		// Move page1 to index 2 (end)
		newIndex := int64(2)
		emptyParent := ""
		siblings, resp, err := th.Client.MovePage(context.Background(), createdWiki.Id, page1.Id, &emptyParent, &newIndex)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, siblings)
		require.Len(t, siblings.Posts, 3)

		// Verify order: page2, page3, page1 (by sort order)
		var sortedPosts []*model.Post
		for _, p := range siblings.Posts {
			sortedPosts = append(sortedPosts, p)
		}
		// Sort by page_sort_order
		for i := 0; i < len(sortedPosts)-1; i++ {
			for j := i + 1; j < len(sortedPosts); j++ {
				if sortedPosts[i].GetPageSortOrder() > sortedPosts[j].GetPageSortOrder() {
					sortedPosts[i], sortedPosts[j] = sortedPosts[j], sortedPosts[i]
				}
			}
		}

		require.Equal(t, "Page 2", sortedPosts[0].Props["title"])
		require.Equal(t, "Page 3", sortedPosts[1].Props["title"])
		require.Equal(t, "Page 1", sortedPosts[2].Props["title"])

		_ = page2
		_ = page3
	})

	t.Run("successfully move and reorder page to new parent", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Move and Reorder Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		// Create parent with children
		parent, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Parent", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		child1, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, parent.Id, "Child 1", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		child2, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, parent.Id, "Child 2", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		// Create orphan to move
		orphan, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Orphan", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		// Move orphan under parent at index 1 (middle)
		newIndex := int64(1)
		parentId := parent.Id
		siblings, resp, err := th.Client.MovePage(context.Background(), createdWiki.Id, orphan.Id, &parentId, &newIndex)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, siblings)
		require.Len(t, siblings.Posts, 3)

		// Verify orphan is now under parent
		updatedOrphan, appErr := th.App.GetSinglePost(th.Context, orphan.Id, false)
		require.Nil(t, appErr)
		require.Equal(t, parent.Id, updatedOrphan.PageParentId)

		_ = child1
		_ = child2
	})

	t.Run("returns nil siblings when no newIndex provided", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "No Index Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		parent, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Parent", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		child, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Child", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		// Move without reorder
		parentId := parent.Id
		siblings, resp, err := th.Client.MovePage(context.Background(), createdWiki.Id, child.Id, &parentId, nil)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Nil(t, siblings, "siblings should be nil when no index provided")

		// Verify parent changed
		updatedChild, appErr := th.App.GetSinglePost(th.Context, child.Id, false)
		require.Nil(t, appErr)
		require.Equal(t, parent.Id, updatedChild.PageParentId)
	})

	t.Run("fail with negative index", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Negative Index Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Test Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		// Try negative index
		negativeIndex := int64(-1)
		emptyParent := ""
		_, resp, err = th.Client.MovePage(context.Background(), createdWiki.Id, page.Id, &emptyParent, &negativeIndex)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("clamps large index to bounds", func(t *testing.T) {
		// Use a fresh channel to avoid interference from other tests
		channel, appErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Type:        model.ChannelTypeOpen,
			DisplayName: "Large Index Test Channel",
			Name:        "large-index-test-" + model.NewId(),
		}, false)
		require.Nil(t, appErr)

		_, appErr = th.App.AddUserToChannel(th.Context, th.BasicUser, channel, false)
		require.Nil(t, appErr)

		wiki := &model.Wiki{
			ChannelId: channel.Id,
			Title:     "Large Index Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		pageA, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page A", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		_, appErr = th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page B", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		// Move pageA to index 1000 (should be clamped to 1)
		largeIndex := int64(1000)
		emptyParent := ""
		siblings, resp, err := th.Client.MovePage(context.Background(), createdWiki.Id, pageA.Id, &emptyParent, &largeIndex)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, siblings)
		require.Len(t, siblings.Posts, 2)

		// Verify pageA is at the end (after pageB)
		var sortedPosts []*model.Post
		for _, p := range siblings.Posts {
			sortedPosts = append(sortedPosts, p)
		}
		for i := 0; i < len(sortedPosts)-1; i++ {
			for j := i + 1; j < len(sortedPosts); j++ {
				if sortedPosts[i].GetPageSortOrder() > sortedPosts[j].GetPageSortOrder() {
					sortedPosts[i], sortedPosts[j] = sortedPosts[j], sortedPosts[i]
				}
			}
		}
		require.Equal(t, "Page B", sortedPosts[0].Props["title"])
		require.Equal(t, "Page A", sortedPosts[1].Props["title"])
	})
}

func TestUpdatePageStatus(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionEditPage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Test Page", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	t.Run("successfully update page status", func(t *testing.T) {
		httpResp, err := th.Client.DoAPIPut(context.Background(), "/posts/"+page.Id+"/status", `{"status":"`+model.PageStatusDone+`"}`)
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		pageObj, appErr := th.App.GetPage(th.Context, page.Id)
		require.Nil(t, appErr)
		status, appErr := th.App.GetPageStatus(th.Context, pageObj)
		require.Nil(t, appErr)
		require.Equal(t, model.PageStatusDone, status)
	})

	t.Run("fail with invalid status value", func(t *testing.T) {
		httpResp, err := th.Client.DoAPIPut(context.Background(), "/posts/"+page.Id+"/status", `{"status":"invalid-status"}`)
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("fail with empty status", func(t *testing.T) {
		httpResp, err := th.Client.DoAPIPut(context.Background(), "/posts/"+page.Id+"/status", `{"status":""}`)
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("fail with missing status field", func(t *testing.T) {
		httpResp, err := th.Client.DoAPIPut(context.Background(), "/posts/"+page.Id+"/status", `{}`)
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("fail with non-existent page", func(t *testing.T) {
		httpResp, err := th.Client.DoAPIPut(context.Background(), "/posts/"+model.NewId()+"/status", `{"status":"`+model.PageStatusDone+`"}`)
		require.Error(t, err)
		CheckNotFoundStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("fail for non-page post", func(t *testing.T) {
		regularPost, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Regular post",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		httpResp, err := th.Client.DoAPIPut(context.Background(), "/posts/"+regularPost.Id+"/status", `{"status":"`+model.PageStatusDone+`"}`)
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(httpResp))
	})
}

func TestGetPageStatus(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionReadPage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Test Page", "", th.BasicUser.Id, "", "")
	require.Nil(t, appErr)

	t.Run("successfully get default status", func(t *testing.T) {
		httpResp, err := th.Client.DoAPIGet(context.Background(), "/posts/"+page.Id+"/status", "")
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		var result map[string]string
		err = json.NewDecoder(httpResp.Body).Decode(&result)
		require.NoError(t, err)
		require.Equal(t, model.PageStatusInProgress, result["status"])
	})

	t.Run("successfully get updated status", func(t *testing.T) {
		pageObj, appErr := th.App.GetPage(th.Context, page.Id)
		require.Nil(t, appErr)
		appErr = th.App.SetPageStatus(th.Context, pageObj, model.PageStatusDone)
		require.Nil(t, appErr)

		httpResp, err := th.Client.DoAPIGet(context.Background(), "/posts/"+page.Id+"/status", "")
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		var result map[string]string
		err = json.NewDecoder(httpResp.Body).Decode(&result)
		require.NoError(t, err)
		require.Equal(t, model.PageStatusDone, result["status"])
	})

	t.Run("fail with non-existent page", func(t *testing.T) {
		httpResp, err := th.Client.DoAPIGet(context.Background(), "/posts/"+model.NewId()+"/status", "")
		require.Error(t, err)
		CheckNotFoundStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("fail for non-page post", func(t *testing.T) {
		regularPost, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Regular post",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		httpResp, err := th.Client.DoAPIGet(context.Background(), "/posts/"+regularPost.Id+"/status", "")
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(httpResp))
	})
}

func TestGetPageStatusField(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("successfully get status field definition", func(t *testing.T) {
		httpResp, err := th.Client.DoAPIGet(context.Background(), "/posts/status/field", "")
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		var field model.PropertyField
		err = json.NewDecoder(httpResp.Body).Decode(&field)
		require.NoError(t, err)
		require.Equal(t, "status", field.Name)
		require.Equal(t, model.PropertyFieldTypeSelect, field.Type)
		require.NotEmpty(t, field.Attrs)

		options, ok := field.Attrs["options"]
		require.True(t, ok, "Should have options")
		require.NotEmpty(t, options, "Options should not be empty")
	})
}

func TestResolvePageComment(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	page, resp, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Test Page")
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	comment := &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "Test Comment",
		RootId:    page.Id,
		Type:      model.PostTypePageComment,
		Props: model.StringInterface{
			model.PagePropsWikiID:      wiki.Id,
			model.PagePropsPageID:      page.Id,
			model.PostPropsCommentType: model.PageCommentTypeInline,
			model.PagePropsInlineAnchor: map[string]any{
				"text": "highlighted text",
			},
		},
	}
	comment, _, appErr = th.App.CreatePost(th.Context, comment, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	t.Run("comment author can resolve their own comment", func(t *testing.T) {
		url := "/wikis/" + wiki.Id + "/pages/" + page.Id + "/comments/" + comment.Id + "/resolve"
		httpResp, err := th.Client.DoAPIPost(context.Background(), url, "")
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		var resolvedComment model.Post
		err = json.NewDecoder(httpResp.Body).Decode(&resolvedComment)
		require.NoError(t, err)
		require.Equal(t, comment.Id, resolvedComment.Id)
		require.True(t, resolvedComment.Props[model.PagePropsCommentResolved].(bool))
		require.NotEmpty(t, resolvedComment.Props[model.PagePropsResolvedAt])
		require.Equal(t, th.BasicUser.Id, resolvedComment.Props[model.PagePropsResolvedBy])
		require.Equal(t, "manual", resolvedComment.Props["resolution_reason"])
	})

	t.Run("can unresolve a resolved comment", func(t *testing.T) {
		url := "/wikis/" + wiki.Id + "/pages/" + page.Id + "/comments/" + comment.Id + "/unresolve"
		httpResp, err := th.Client.DoAPIPost(context.Background(), url, "")
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		var unresolvedComment model.Post
		err = json.NewDecoder(httpResp.Body).Decode(&unresolvedComment)
		require.NoError(t, err)
		require.Equal(t, comment.Id, unresolvedComment.Id)
		require.Nil(t, unresolvedComment.Props[model.PagePropsCommentResolved])
		require.Nil(t, unresolvedComment.Props[model.PagePropsResolvedAt])
		require.Nil(t, unresolvedComment.Props[model.PagePropsResolvedBy])
	})

	t.Run("page author can resolve comments on their page", func(t *testing.T) {
		comment2 := &model.Post{
			ChannelId: th.BasicChannel.Id,
			Message:   "Comment by User2",
			RootId:    page.Id,
			Type:      model.PostTypePageComment,
			UserId:    th.BasicUser2.Id,
			Props: model.StringInterface{
				model.PagePropsWikiID:      wiki.Id,
				model.PagePropsPageID:      page.Id,
				model.PostPropsCommentType: model.PageCommentTypeInline,
				model.PagePropsInlineAnchor: map[string]any{
					"text": "another highlight",
				},
			},
		}
		th.Context.Session().UserId = th.BasicUser2.Id
		comment2, _, appErr = th.App.CreatePost(th.Context, comment2, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		th.Context.Session().UserId = th.BasicUser.Id
		url := "/wikis/" + wiki.Id + "/pages/" + page.Id + "/comments/" + comment2.Id + "/resolve"
		httpResp, err := th.Client.DoAPIPost(context.Background(), url, "")
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		var resolvedComment model.Post
		err = json.NewDecoder(httpResp.Body).Decode(&resolvedComment)
		require.NoError(t, err)
		require.True(t, resolvedComment.Props[model.PagePropsCommentResolved].(bool))
	})

	t.Run("fail with invalid comment ID", func(t *testing.T) {
		url := "/wikis/" + wiki.Id + "/pages/" + page.Id + "/comments/invalidid123/resolve"
		_, err := th.Client.DoAPIPost(context.Background(), url, "")
		require.Error(t, err)
	})

	t.Run("fail with deleted comment", func(t *testing.T) {
		deletedComment := &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "To be deleted",
			RootId:    page.Id,
			Type:      model.PostTypePageComment,
			Props: model.StringInterface{
				model.PagePropsWikiID: wiki.Id,
				model.PagePropsPageID: page.Id,
			},
		}
		deletedComment, _, appErr = th.App.CreatePost(th.Context, deletedComment, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		_, appErr = th.App.DeletePost(th.Context, deletedComment.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		url := "/wikis/" + wiki.Id + "/pages/" + page.Id + "/comments/" + deletedComment.Id + "/resolve"
		httpResp, err := th.Client.DoAPIPost(context.Background(), url, "")
		require.Error(t, err)
		CheckNotFoundStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("fail when resolving non-page-comment post", func(t *testing.T) {
		regularPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Regular post",
		}
		regularPost, _, appErr = th.App.CreatePost(th.Context, regularPost, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		url := "/wikis/" + wiki.Id + "/pages/" + page.Id + "/comments/" + regularPost.Id + "/resolve"
		httpResp, err := th.Client.DoAPIPost(context.Background(), url, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(httpResp))
	})
}

func TestGetPageActiveEditors(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.Context.Session().UserId = th.BasicUser.Id

	wiki := &model.Wiki{
		ChannelId: th.BasicChannel.Id,
		Title:     "Test Wiki",
	}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	page := &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "Page content",
		Type:      model.PostTypePage,
		Props: model.StringInterface{
			model.PagePropsWikiID: wiki.Id,
		},
	}
	page, _, appErr = th.App.CreatePost(th.Context, page, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	t.Run("get active editors successfully with no editors", func(t *testing.T) {
		url := "/wikis/" + wiki.Id + "/pages/" + page.Id + "/active_editors"
		httpResp, err := th.Client.DoAPIGet(context.Background(), url, "")
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		var response map[string]any
		err = json.NewDecoder(httpResp.Body).Decode(&response)
		require.NoError(t, err)

		userIds, ok := response["user_ids"].([]any)
		require.True(t, ok)
		assert.Empty(t, userIds)
	})

	t.Run("get active editors with one editor", func(t *testing.T) {
		draftContent := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`
		savedDraft, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, wiki.Id, page.Id, draftContent, "Draft title", 0, nil)
		require.Nil(t, appErr)
		require.NotNil(t, savedDraft)

		url := "/wikis/" + wiki.Id + "/pages/" + page.Id + "/active_editors"
		httpResp, err := th.Client.DoAPIGet(context.Background(), url, "")
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		var response map[string]any
		err = json.NewDecoder(httpResp.Body).Decode(&response)
		require.NoError(t, err)

		userIds, ok := response["user_ids"].([]any)
		require.True(t, ok)
		require.Len(t, userIds, 1)
		assert.Equal(t, th.BasicUser.Id, userIds[0])

		lastActivities, ok := response["last_activities"].(map[string]any)
		require.True(t, ok)
		assert.Contains(t, lastActivities, th.BasicUser.Id)
	})

	t.Run("get active editors with multiple editors", func(t *testing.T) {
		draftContent2 := `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content 2"}]}]}`
		savedDraft2, appErr := th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser2.Id, wiki.Id, page.Id, draftContent2, "Draft title 2", 0, nil)
		require.Nil(t, appErr)
		require.NotNil(t, savedDraft2)

		th.Context.Session().UserId = th.BasicUser.Id

		url := "/wikis/" + wiki.Id + "/pages/" + page.Id + "/active_editors"
		httpResp, err := th.Client.DoAPIGet(context.Background(), url, "")
		require.NoError(t, err)
		CheckOKStatus(t, model.BuildResponse(httpResp))

		var response map[string]any
		err = json.NewDecoder(httpResp.Body).Decode(&response)
		require.NoError(t, err)

		userIds, ok := response["user_ids"].([]any)
		require.True(t, ok)
		assert.Len(t, userIds, 2)
	})

	t.Run("fail without read permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		th.Context.Session().UserId = th.BasicUser.Id

		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		privateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		privatePage := &model.Post{
			ChannelId: privateChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Private page content",
			Type:      model.PostTypePage,
			Props: model.StringInterface{
				model.PagePropsWikiID: privateWiki.Id,
			},
		}
		privatePage, _, appErr = th.App.CreatePost(th.Context, privatePage, privateChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		url := "/wikis/" + privateWiki.Id + "/pages/" + privatePage.Id + "/active_editors"
		httpResp, err := client2.DoAPIGet(context.Background(), url, "")
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("fail with invalid page id", func(t *testing.T) {
		url := "/wikis/" + wiki.Id + "/pages/invalid123/active_editors"
		httpResp, err := th.Client.DoAPIGet(context.Background(), url, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("fail when page is not actually a page", func(t *testing.T) {
		regularPost := &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Regular post",
		}
		regularPost, _, appErr := th.App.CreatePost(th.Context, regularPost, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		url := "/wikis/" + wiki.Id + "/pages/" + regularPost.Id + "/active_editors"
		httpResp, err := th.Client.DoAPIGet(context.Background(), url, "")
		require.Error(t, err)
		CheckBadRequestStatus(t, model.BuildResponse(httpResp))
	})
}

// TestPageDraftPermissionViolations tests that page draft API operations correctly fail when users lack required permissions.
// These tests verify that the API layer properly enforces permission checks for draft operations.
func TestPageDraftPermissionViolations(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("SavePageDraft fails without manage_public_channel_properties permission", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
		th.Context.Session().UserId = th.BasicUser.Id

		// Create wiki with permissions
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		// Remove the permission
		th.RemovePermissionFromRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

		// Try to save draft - use PUT method with draft_id in URL
		draftId := model.NewId()
		url := "/wikis/" + createdWiki.Id + "/drafts/" + draftId
		payload := map[string]string{
			"content": `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`,
			"title":   "Test Draft",
		}
		payloadBytes, _ := json.Marshal(payload)
		httpResp, err := th.Client.DoAPIPut(context.Background(), url, string(payloadBytes))
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("SavePageDraft fails for user not in channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)
		th.Context.Session().UserId = th.BasicUser.Id

		// Create a private channel and wiki
		privateChannel := th.CreatePrivateChannel(t)
		wiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		createdWiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		// Login as user2 who is not in the private channel
		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		// Try to save draft - use PUT method with draft_id in URL
		draftId := model.NewId()
		url := "/wikis/" + createdWiki.Id + "/drafts/" + draftId
		payload := map[string]string{
			"content": `{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`,
			"title":   "Test Draft",
		}
		payloadBytes, _ := json.Marshal(payload)
		httpResp, err := client2.DoAPIPut(context.Background(), url, string(payloadBytes))
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("DeletePageDraft fails for user not in channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
		th.Context.Session().UserId = th.BasicUser.Id

		// Create a private channel and wiki
		privateChannel := th.CreatePrivateChannel(t)
		wiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		createdWiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		// Save a draft
		draftId := model.NewId()
		_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, draftId,
			`{"type":"doc","content":[]}`, "Test Draft", 0, nil)
		require.Nil(t, appErr)

		// Login as user2 who is not in the private channel
		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		// Try to delete draft
		url := "/wikis/" + createdWiki.Id + "/drafts/" + draftId
		httpResp, err := client2.DoAPIDelete(context.Background(), url)
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("PublishPageDraft fails without create_page permission", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
		th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
		th.Context.Session().UserId = th.BasicUser.Id

		// Create wiki
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		// Save a draft
		draftId := model.NewId()
		_, appErr = th.App.SavePageDraftWithMetadata(th.Context, th.BasicUser.Id, createdWiki.Id, draftId,
			`{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Draft content"}]}]}`, "Test Draft", 0, nil)
		require.Nil(t, appErr)

		// Remove create_page permission
		th.RemovePermissionFromRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionCreatePage.Id, model.ChannelUserRoleId)

		// Try to publish draft
		url := "/wikis/" + createdWiki.Id + "/drafts/" + draftId + "/publish"
		payload := map[string]string{
			"title": "Published Page",
		}
		payloadBytes, _ := json.Marshal(payload)
		httpResp, err := th.Client.DoAPIPost(context.Background(), url, string(payloadBytes))
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(httpResp))
	})

	t.Run("Guest user cannot save draft in DM/Group channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

		// Enable guest accounts (requires license and config)
		th.App.Srv().SetLicense(model.NewTestLicense("guest_accounts"))
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.AllowEmailAccounts = true })

		// Create guest user and client
		guest, guestClient := th.CreateGuestAndClient(t)
		th.LinkUserToTeam(t, guest, th.BasicTeam)

		// Create a group channel with guest (requires at least 3 users)
		groupChannel, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.BasicUser2.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		// Create wiki as regular user (who has permission)
		th.Context.Session().UserId = th.BasicUser.Id
		wiki := &model.Wiki{
			ChannelId: groupChannel.Id,
			Title:     "Group Wiki",
		}
		createdWiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		// Try to save draft as guest - use PUT method with draft_id in URL
		draftId := model.NewId()
		url := "/wikis/" + createdWiki.Id + "/drafts/" + draftId
		payload := map[string]string{
			"content": `{"type":"doc","content":[]}`,
			"title":   "Guest Draft",
		}
		payloadBytes, _ := json.Marshal(payload)
		httpResp, err := guestClient.DoAPIPut(context.Background(), url, string(payloadBytes))
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(httpResp))
	})
}

// TestWikiPermissionViolations tests that wiki API operations correctly fail when users lack required permissions.
// These tests verify that the API layer properly enforces permission checks before allowing wiki operations.
func TestWikiPermissionViolations(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("CreateWiki fails without manage_public_channel_properties permission", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Remove the permission that allows creating wikis in public channels
		th.RemovePermissionFromRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}

		_, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("CreateWiki fails without manage_private_channel_properties permission", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Create a private channel
		privateChannel := th.CreatePrivateChannel(t)

		// Remove the permission that allows creating wikis in private channels
		th.RemovePermissionFromRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionManagePrivateChannelProperties.Id, model.ChannelUserRoleId)

		wiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}

		_, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("CreateWiki fails for user not in channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Create a private channel that user2 is not a member of
		privateChannel := th.CreatePrivateChannel(t)

		// Login as user2 who is not in the private channel
		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		wiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Test Wiki",
		}

		_, resp, err := client2.CreateWiki(context.Background(), wiki)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("GetWiki fails for user not in channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Create a private channel and wiki
		privateChannel := th.CreatePrivateChannel(t)
		th.Context.Session().UserId = th.BasicUser.Id

		wiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		createdWiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		// Login as user2 who is not in the private channel
		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		_, resp, err := client2.GetWiki(context.Background(), createdWiki.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("GetWikisForChannel fails for user not in channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Create a private channel
		privateChannel := th.CreatePrivateChannel(t)

		// Login as user2 who is not in the private channel
		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		_, resp, err := client2.GetWikisForChannel(context.Background(), privateChannel.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("UpdateWiki fails without manage_public_channel_properties permission", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Create wiki first with permissions
		th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
		th.Context.Session().UserId = th.BasicUser.Id

		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		// Remove the permission
		th.RemovePermissionFromRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

		// Try to update the wiki
		createdWiki.Title = "Updated Title"
		_, resp, err := th.Client.UpdateWiki(context.Background(), createdWiki)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("DeleteWiki fails without manage_public_channel_properties permission", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Create wiki first with permissions
		th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
		th.Context.Session().UserId = th.BasicUser.Id

		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		// Remove the permission
		th.RemovePermissionFromRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

		// Try to delete the wiki
		resp, err := th.Client.DeleteWiki(context.Background(), createdWiki.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("CreateWiki fails in archived channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)

		// Create and archive a channel
		channel, chanErr := th.App.CreateChannel(th.Context, &model.Channel{
			TeamId:      th.BasicTeam.Id,
			Name:        "archived-wiki-channel-api",
			DisplayName: "Archived Wiki Channel API",
			Type:        model.ChannelTypeOpen,
		}, false)
		require.Nil(t, chanErr)

		_, addErr := th.App.AddUserToChannel(th.Context, th.BasicUser, channel, false)
		require.Nil(t, addErr)

		// Archive the channel
		err := th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id)
		require.Nil(t, err)

		wiki := &model.Wiki{
			ChannelId: channel.Id,
			Title:     "Test Wiki",
		}

		_, resp, createErr := th.Client.CreateWiki(context.Background(), wiki)
		require.Error(t, createErr)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("Guest user cannot create wiki in DM/Group channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Enable guest accounts (requires license and config)
		th.App.Srv().SetLicense(model.NewTestLicense("guest_accounts"))
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.Enable = true })
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.GuestAccountsSettings.AllowEmailAccounts = true })

		// Create guest user and client
		guest, guestClient := th.CreateGuestAndClient(t)
		th.LinkUserToTeam(t, guest, th.BasicTeam)

		// Create a group channel with guest (requires at least 3 users)
		groupChannel, appErr := th.App.CreateGroupChannel(th.Context, []string{th.BasicUser.Id, th.BasicUser2.Id, guest.Id}, th.BasicUser.Id)
		require.Nil(t, appErr)

		wiki := &model.Wiki{
			ChannelId: groupChannel.Id,
			Title:     "Guest Wiki",
		}

		_, resp, err := guestClient.CreateWiki(context.Background(), wiki)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("MoveWikiToChannel fails for user not in target channel", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.AddPermissionToRole(t, model.PermissionManagePublicChannelProperties.Id, model.ChannelUserRoleId)
		th.Context.Session().UserId = th.BasicUser.Id

		// Create source wiki
		sourceWiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Source Wiki",
		}
		createdWiki, appErr := th.App.CreateWiki(th.Context, sourceWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		// Create target channel that user2 is not a member of
		targetChannel := th.CreatePrivateChannel(t)

		// Login as user2 (who is in BasicChannel but not targetChannel)
		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		// Try to move wiki to target channel
		url := "/wikis/" + createdWiki.Id + "/move"
		payload := map[string]string{"target_channel_id": targetChannel.Id}
		httpResp, err := client2.DoAPIPatchJSON(context.Background(), url, payload)
		require.Error(t, err)
		CheckForbiddenStatus(t, model.BuildResponse(httpResp))
	})
}
