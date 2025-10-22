// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateWiki(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreateWikiPrivateChannel.Id, model.ChannelUserRoleId)

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
		privateChannel := th.CreatePrivateChannel()

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
}

func TestGetWiki(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

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
		privateChannel := th.CreatePrivateChannel()
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
	th := Setup(t).InitBasic()
	defer th.TearDown()

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
		appErr := th.App.DeleteWiki(th.Context, wiki1.Id)
		require.Nil(t, appErr)

		wikis, resp, err := th.Client.GetWikisForChannel(context.Background(), th.BasicChannel.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, wikis, 1)
	})

	t.Run("fail without read permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel()

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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreateWikiPrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditWikiPrivateChannel.Id, model.ChannelUserRoleId)

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
		privateChannel := th.CreatePrivateChannel()
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
		anotherChannel := th.CreatePublicChannel()

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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreateWikiPrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionDeleteWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionDeleteWikiPrivateChannel.Id, model.ChannelUserRoleId)

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
		privateChannel := th.CreatePrivateChannel()
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

func TestGetWikiPages(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

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
	page1, appErr = th.App.CreatePost(th.Context, page1, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	appErr = th.App.AddPageToWiki(th.Context, page1.Id, wiki.Id)
	require.Nil(t, appErr)

	page2 := &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "Page 2",
		Type:      model.PostTypePage,
	}
	page2, appErr = th.App.CreatePost(th.Context, page2, th.BasicChannel, model.CreatePostFlags{})
	require.Nil(t, appErr)

	appErr = th.App.AddPageToWiki(th.Context, page2.Id, wiki.Id)
	require.Nil(t, appErr)

	t.Run("get pages successfully", func(t *testing.T) {
		pages, resp, err := th.Client.GetWikiPages(context.Background(), wiki.Id, 0, 100)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, pages, 2)
	})

	t.Run("fail without read permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel()
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

		_, resp, err := client2.GetWikiPages(context.Background(), privateWiki.Id, 0, 100)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestGetWikiPage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreatePagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionReadPagePublicChannel.Id, model.ChannelUserRoleId)
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

	page, appErr := th.App.CreateWikiPage(th.Context, wiki1.Id, "", "Test Page", th.BasicUser.Id)
	require.Nil(t, appErr)

	t.Run("get page from correct wiki successfully", func(t *testing.T) {
		retrievedPage, resp, err := th.Client.GetWikiPage(context.Background(), wiki1.Id, page.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, page.Id, retrievedPage.Id)
	})

	t.Run("fail to get page using wrong wiki id", func(t *testing.T) {
		_, resp, err := th.Client.GetWikiPage(context.Background(), wiki2.Id, page.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("fail to get non-existent page", func(t *testing.T) {
		_, resp, err := th.Client.GetWikiPage(context.Background(), wiki1.Id, model.NewId())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})
}

func TestCrossChannelAccess(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.Context.Session().UserId = th.BasicUser.Id

	channel1 := th.BasicChannel
	channel2 := th.CreatePublicChannel()

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
		pageInChannel1, appErr = th.App.CreatePost(th.Context, pageInChannel1, channel1, model.CreatePostFlags{})
		require.Nil(t, appErr)

		appErr = th.App.AddPageToWiki(th.Context, pageInChannel1.Id, wiki2.Id)
		require.NotNil(t, appErr)
		require.Equal(t, "api.wiki.add.channel_mismatch", appErr.Id)
	})
}

func TestWikiValidation(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	t.Run("create wiki permissions", func(t *testing.T) {
		t.Run("public channel requires PermissionCreateWikiPublicChannel", func(t *testing.T) {
			publicChannel := th.CreatePublicChannel()
			th.AddUserToChannel(th.BasicUser2, publicChannel)

			th.RemovePermissionFromRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)

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

		t.Run("private channel requires PermissionCreateWikiPrivateChannel", func(t *testing.T) {
			privateChannel := th.CreatePrivateChannel()
			th.AddUserToChannel(th.BasicUser2, privateChannel)

			th.RemovePermissionFromRole(model.PermissionCreateWikiPrivateChannel.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(model.PermissionCreateWikiPrivateChannel.Id, model.ChannelUserRoleId)

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
			dmChannel := th.CreateDmChannel(th.BasicUser2)

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
		t.Run("public channel requires PermissionEditWikiPublicChannel", func(t *testing.T) {
			publicChannel := th.CreatePublicChannel()
			th.AddUserToChannel(th.BasicUser2, publicChannel)

			th.Context.Session().UserId = th.BasicUser.Id
			wiki := &model.Wiki{
				ChannelId: publicChannel.Id,
				Title:     "Public Wiki",
			}
			wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
			require.Nil(t, appErr)

			th.RemovePermissionFromRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			wiki.Title = "Updated Title"
			_, resp, err := client2.UpdateWiki(context.Background(), wiki)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("private channel requires PermissionEditWikiPrivateChannel", func(t *testing.T) {
			privateChannel := th.CreatePrivateChannel()
			th.AddUserToChannel(th.BasicUser2, privateChannel)

			th.Context.Session().UserId = th.BasicUser.Id
			wiki := &model.Wiki{
				ChannelId: privateChannel.Id,
				Title:     "Private Wiki",
			}
			wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
			require.Nil(t, appErr)

			th.RemovePermissionFromRole(model.PermissionEditWikiPrivateChannel.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(model.PermissionEditWikiPrivateChannel.Id, model.ChannelUserRoleId)

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
		t.Run("public channel requires PermissionDeleteWikiPublicChannel", func(t *testing.T) {
			publicChannel := th.CreatePublicChannel()
			th.AddUserToChannel(th.BasicUser2, publicChannel)

			th.Context.Session().UserId = th.BasicUser.Id
			wiki := &model.Wiki{
				ChannelId: publicChannel.Id,
				Title:     "Public Wiki",
			}
			wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
			require.Nil(t, appErr)

			th.RemovePermissionFromRole(model.PermissionDeleteWikiPublicChannel.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(model.PermissionDeleteWikiPublicChannel.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			resp, err := client2.DeleteWiki(context.Background(), wiki.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})

		t.Run("private channel requires PermissionDeleteWikiPrivateChannel", func(t *testing.T) {
			privateChannel := th.CreatePrivateChannel()
			th.AddUserToChannel(th.BasicUser2, privateChannel)

			th.Context.Session().UserId = th.BasicUser.Id
			wiki := &model.Wiki{
				ChannelId: privateChannel.Id,
				Title:     "Private Wiki",
			}
			wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
			require.Nil(t, appErr)

			th.RemovePermissionFromRole(model.PermissionDeleteWikiPrivateChannel.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(model.PermissionDeleteWikiPrivateChannel.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			resp, err := client2.DeleteWiki(context.Background(), wiki.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	})

	t.Run("add page permissions use edit wiki permissions", func(t *testing.T) {
		publicChannel := th.CreatePublicChannel()
		th.AddUserToChannel(th.BasicUser2, publicChannel)

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
		page, appErr = th.App.CreatePost(th.Context, page, publicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		th.RemovePermissionFromRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		resp, err := client2.AddPageToWiki(context.Background(), wiki.Id, page.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("remove page permissions use delete wiki permissions", func(t *testing.T) {
		publicChannel := th.CreatePublicChannel()
		th.AddUserToChannel(th.BasicUser2, publicChannel)

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
		page, appErr = th.App.CreatePost(th.Context, page, publicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		appErr = th.App.AddPageToWiki(th.Context, page.Id, wiki.Id)
		require.Nil(t, appErr)

		th.RemovePermissionFromRole(model.PermissionDeleteWikiPublicChannel.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(model.PermissionDeleteWikiPublicChannel.Id, model.ChannelUserRoleId)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		resp, err := client2.RemovePageFromWiki(context.Background(), wiki.Id, page.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("removing page from wiki unlinks it without deleting the page", func(t *testing.T) {
		publicChannel := th.CreatePublicChannel()
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
		page, appErr = th.App.CreatePost(th.Context, page, publicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		appErr = th.App.AddPageToWiki(th.Context, page.Id, wiki.Id)
		require.Nil(t, appErr)

		pages, resp, err := th.Client.GetWikiPages(context.Background(), wiki.Id, 0, 100)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, pages, 1)

		th.AddPermissionToRole(model.PermissionDeleteWikiPublicChannel.Id, model.ChannelUserRoleId)
		th.AddPermissionToRole(model.PermissionReadPagePublicChannel.Id, model.ChannelUserRoleId)
		th.AddPermissionToRole(model.PermissionDeletePagePublicChannel.Id, model.ChannelUserRoleId)
		resp, err = th.Client.RemovePageFromWiki(context.Background(), wiki.Id, page.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		retrievedPage, appErr := th.App.GetSinglePost(th.Context, page.Id, false)
		require.Nil(t, appErr)
		require.Equal(t, page.Id, retrievedPage.Id)
		require.Equal(t, "Test Page Content", retrievedPage.Message)
		require.Equal(t, model.PostTypePage, retrievedPage.Type)

		pages, resp, err = th.Client.GetWikiPages(context.Background(), wiki.Id, 0, 100)
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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreatePagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionReadPagePublicChannel.Id, model.ChannelUserRoleId)
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

		draftId := model.NewId()
		draftMessage := createTipTapContent("This is test content for the page draft")

		savedDraft, appErr := th.App.SavePageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, draftId, draftMessage)
		require.Nil(t, appErr)
		require.Equal(t, draftMessage, savedDraft.Message)
		require.Equal(t, createdWiki.ChannelId, savedDraft.ChannelId)
		require.Equal(t, createdWiki.Id, savedDraft.WikiId)
		require.Equal(t, draftId, savedDraft.RootId)

		retrievedDraft, appErr := th.App.GetPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, draftId)
		require.Nil(t, appErr)
		require.Equal(t, draftMessage, retrievedDraft.Message)

		updatedDraftMessage := createTipTapContent("Updated test content for the page draft")
		updatedDraft, appErr := th.App.SavePageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, draftId, updatedDraftMessage)
		require.Nil(t, appErr)
		require.Equal(t, updatedDraftMessage, updatedDraft.Message)

		pageTitle := "Test Page"
		publishedPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, draftId, "", pageTitle, "")
		require.Nil(t, appErr)
		require.NotEmpty(t, publishedPage.Id)
		require.Equal(t, model.PostTypePage, publishedPage.Type)
		assert.JSONEq(t, updatedDraftMessage, publishedPage.Message)
		require.Equal(t, th.BasicChannel.Id, publishedPage.ChannelId)
		require.Equal(t, pageTitle, publishedPage.Props["title"])
		require.Equal(t, createdWiki.Id, publishedPage.Props["wiki_id"])

		_, appErr = th.App.GetPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, draftId)
		require.NotNil(t, appErr)
		require.Equal(t, "app.draft.get_page.not_found", appErr.Id)

		retrievedPage, resp, err := th.Client.GetWikiPage(context.Background(), createdWiki.Id, publishedPage.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Equal(t, publishedPage.Id, retrievedPage.Id)
		assert.JSONEq(t, updatedDraftMessage, retrievedPage.Message)
		require.Equal(t, model.PostTypePage, retrievedPage.Type)

		pages, resp, err := th.Client.GetWikiPages(context.Background(), createdWiki.Id, 0, 100)
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

	t.Run("cannot publish empty draft", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		draftId := model.NewId()
		_, appErr := th.App.SavePageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, draftId, "")
		require.Nil(t, appErr)

		_, appErr = th.App.PublishPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, draftId, "", "Empty Page", "")
		require.NotNil(t, appErr)
		require.Equal(t, "app.draft.publish_page.empty", appErr.Id)
	})

	t.Run("publish page with parent creates hierarchy", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Hierarchical Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		parentDraftId := model.NewId()
		_, appErr := th.App.SavePageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, parentDraftId, createTipTapContent("Parent page content"))
		require.Nil(t, appErr)

		parentPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, parentDraftId, "", "Parent Page", "")
		require.Nil(t, appErr)

		childDraftId := model.NewId()
		_, appErr = th.App.SavePageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, childDraftId, createTipTapContent("Child page content"))
		require.Nil(t, appErr)

		childPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, childDraftId, parentPage.Id, "Child Page", "")
		require.Nil(t, appErr)
		require.Equal(t, parentPage.Id, childPage.PageParentId)
	})
}

func TestCreatePage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreatePagePublicChannel.Id, model.ChannelUserRoleId)
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
		privateChannel := th.CreatePrivateChannel()
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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionCreatePagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionReadPagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditPagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionDeletePagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreatePagePrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionReadPagePrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditPagePrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionDeletePagePrivateChannel.Id, model.ChannelUserRoleId)

	th.AddPermissionToRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditWikiPrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionDeleteWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionDeleteWikiPrivateChannel.Id, model.ChannelUserRoleId)

	th.AddPermissionToRole(model.PermissionReadPagePublicChannel.Id, model.ChannelGuestRoleId)
	th.AddPermissionToRole(model.PermissionReadPagePrivateChannel.Id, model.ChannelGuestRoleId)

	t.Run("Public Channel - Page Create Permission", func(t *testing.T) {
		publicChannel := th.CreatePublicChannel()
		th.AddUserToChannel(th.BasicUser2, publicChannel)

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
			th.RemovePermissionFromRole(model.PermissionCreatePagePublicChannel.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(model.PermissionCreatePagePublicChannel.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			_, resp, err := client2.CreatePage(context.Background(), wiki.Id, "", "Test Page")
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	})

	t.Run("Private Channel - Page Create Permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel()
		th.AddUserToChannel(th.BasicUser2, privateChannel)

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
			th.RemovePermissionFromRole(model.PermissionCreatePagePrivateChannel.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(model.PermissionCreatePagePrivateChannel.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			_, resp, err := client2.CreatePage(context.Background(), wiki.Id, "", "Private Page")
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	})

	t.Run("Page Read Permission", func(t *testing.T) {
		publicChannel := th.CreatePublicChannel()
		th.AddUserToChannel(th.BasicUser2, publicChannel)

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

			_, resp, err := client2.GetWikiPage(context.Background(), wiki.Id, page.Id)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
		})

		t.Run("user without read permission cannot view page", func(t *testing.T) {
			th.RemovePermissionFromRole(model.PermissionReadPagePublicChannel.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(model.PermissionReadPagePublicChannel.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			_, resp, err := client2.GetWikiPage(context.Background(), wiki.Id, page.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	})

	t.Run("Page Delete Permission - Ownership", func(t *testing.T) {
		publicChannel := th.CreatePublicChannel()
		th.AddUserToChannel(th.BasicUser2, publicChannel)

		wiki := &model.Wiki{ChannelId: publicChannel.Id, Title: "Delete Test Wiki"}
		wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		t.Run("author can delete their own page", func(t *testing.T) {
			page, resp, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Deletable Page")
			require.NoError(t, err)
			CheckCreatedStatus(t, resp)

			resp, err = th.Client.RemovePageFromWiki(context.Background(), wiki.Id, page.Id)
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

			resp, err = client2.RemovePageFromWiki(context.Background(), wiki.Id, page.Id)
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

			resp, err = client2.RemovePageFromWiki(context.Background(), wiki.Id, page.Id)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
		})
	})

	t.Run("Additive Permission Model - Wiki and Page", func(t *testing.T) {
		publicChannel := th.CreatePublicChannel()
		th.AddUserToChannel(th.BasicUser2, publicChannel)

		wiki := &model.Wiki{ChannelId: publicChannel.Id, Title: "Additive Test Wiki"}
		wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		t.Run("requires both wiki edit and page create permissions", func(t *testing.T) {
			th.RemovePermissionFromRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)

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

			th.RemovePermissionFromRole(model.PermissionDeleteWikiPublicChannel.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(model.PermissionDeleteWikiPublicChannel.Id, model.ChannelUserRoleId)

			resp, err = th.Client.RemovePageFromWiki(context.Background(), wiki.Id, page.Id)
			require.Error(t, err)
			CheckForbiddenStatus(t, resp)
		})
	})
}

func TestPageGuestPermissions(t *testing.T) {
	t.Skip("Guest login fails in test environment - CreateGuestAndClient has infrastructure issues")

	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionReadPagePublicChannel.Id, model.ChannelGuestRoleId)

	publicChannel := th.CreatePublicChannel()
	guest, guestClient := th.CreateGuestAndClient(t)
	th.LinkUserToTeam(guest, th.BasicTeam)
	th.AddUserToChannel(guest, publicChannel)

	wiki := &model.Wiki{ChannelId: publicChannel.Id, Title: "Guest Test Wiki"}
	wiki, appErr := th.App.CreateWiki(th.Context, wiki, th.BasicUser.Id)
	require.Nil(t, appErr)

	page, resp, err := th.Client.CreatePage(context.Background(), wiki.Id, "", "Guest Readable Page")
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)

	t.Run("guest can read page", func(t *testing.T) {
		_, resp, err := guestClient.GetWikiPage(context.Background(), wiki.Id, page.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
	})

	t.Run("guest cannot create page", func(t *testing.T) {
		_, resp, err := guestClient.CreatePage(context.Background(), wiki.Id, "", "Guest Page")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("guest cannot delete page", func(t *testing.T) {
		resp, err := guestClient.RemovePageFromWiki(context.Background(), wiki.Id, page.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}
