// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/http"
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

func TestGetPages(t *testing.T) {
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
		pages, resp, err := th.Client.GetPages(context.Background(), wiki.Id, 0, 100)
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

		_, resp, err := client2.GetPages(context.Background(), privateWiki.Id, 0, 100)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestGetPage(t *testing.T) {
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

	page, appErr := th.App.CreateWikiPage(th.Context, wiki1.Id, "", "Test Page", "", th.BasicUser.Id, "")
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

		resp, err := client2.DeletePage(context.Background(), wiki.Id, page.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("removing page from wiki deletes the page", func(t *testing.T) {
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

		pages, resp, err := th.Client.GetPages(context.Background(), wiki.Id, 0, 100)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, pages, 1)

		th.AddPermissionToRole(model.PermissionDeleteWikiPublicChannel.Id, model.ChannelUserRoleId)
		th.AddPermissionToRole(model.PermissionReadPagePublicChannel.Id, model.ChannelUserRoleId)
		th.AddPermissionToRole(model.PermissionDeletePagePublicChannel.Id, model.ChannelUserRoleId)
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
		publishedPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, draftId, "", pageTitle, "", "")
		require.Nil(t, appErr)
		require.NotEmpty(t, publishedPage.Id)
		require.Equal(t, model.PostTypePage, publishedPage.Type)
		assert.JSONEq(t, updatedDraftMessage, publishedPage.Message)
		require.Equal(t, th.BasicChannel.Id, publishedPage.ChannelId)
		require.Equal(t, pageTitle, publishedPage.Props["title"])

		_, appErr = th.App.GetPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, draftId)
		require.NotNil(t, appErr)
		require.Equal(t, "app.draft.get_page.not_found", appErr.Id)

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

		_, appErr = th.App.PublishPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, draftId, "", "Empty Page", "", "")
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

		parentPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, parentDraftId, "", "Parent Page", "", "")
		require.Nil(t, appErr)

		childDraftId := model.NewId()
		_, appErr = th.App.SavePageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, childDraftId, createTipTapContent("Child page content"))
		require.Nil(t, appErr)

		childPage, appErr := th.App.PublishPageDraft(th.Context, th.BasicUser.Id, createdWiki.Id, childDraftId, parentPage.Id, "Child Page", "", "")
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

			_, resp, err := client2.GetPage(context.Background(), wiki.Id, page.Id)
			require.NoError(t, err)
			CheckOKStatus(t, resp)
		})

		t.Run("user without read permission cannot view page", func(t *testing.T) {
			th.RemovePermissionFromRole(model.PermissionReadPagePublicChannel.Id, model.ChannelUserRoleId)
			defer th.AddPermissionToRole(model.PermissionReadPagePublicChannel.Id, model.ChannelUserRoleId)

			client2 := th.CreateClient()
			_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
			require.NoError(t, lErr)

			_, resp, err := client2.GetPage(context.Background(), wiki.Id, page.Id)
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

			resp, err = th.Client.DeletePage(context.Background(), wiki.Id, page.Id)
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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionDeleteWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreatePagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionReadPagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionDeletePagePublicChannel.Id, model.ChannelUserRoleId)
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
		require.Equal(t, page.Id, comment.Props["page_id"], "Comment props should contain page_id")
		_, hasParentCommentId := comment.Props["parent_comment_id"]
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
		require.Equal(t, page.Id, reply.Props["page_id"], "Reply props should contain page_id")
		require.Equal(t, topLevelComment.Id, reply.Props["parent_comment_id"], "Reply props should contain parent_comment_id")
	})

	t.Run("page comments do NOT appear in channel feed (GetPostsForChannel)", func(t *testing.T) {
		regularPost, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "Regular channel post",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		_, resp, err := th.Client.CreatePageComment(context.Background(), createdWiki.Id, page.Id, "Page comment should not appear in feed")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		_, resp, err = th.Client.CreatePageComment(context.Background(), createdWiki.Id, page.Id, "Another page comment")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		channelPosts, resp, err := th.Client.GetPostsForChannel(context.Background(), th.BasicChannel.Id, 0, 100, "", false, false)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		foundRegularPost := false
		foundPageComments := 0

		for _, post := range channelPosts.Posts {
			if post.Id == regularPost.Id {
				foundRegularPost = true
			}
			if post.Type == model.PostTypePageComment {
				foundPageComments++
			}
		}

		require.True(t, foundRegularPost, "Regular post should appear in channel feed")
		require.Equal(t, 0, foundPageComments, "Page comments should NOT appear in channel feed")
	})

	t.Run("pages do NOT appear in channel feed (consistent with Slack Canvas UX)", func(t *testing.T) {
		regularPost, appErr := th.App.CreatePost(th.Context, &model.Post{
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

	t.Run("page comments do NOT appear in channel search", func(t *testing.T) {
		_, resp, err := th.Client.CreatePageComment(context.Background(), createdWiki.Id, page.Id, "Unique search term: xyzabc123")
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		regularPost, appErr := th.App.CreatePost(th.Context, &model.Post{
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
		require.False(t, foundPageComment, "Page comments should NOT appear in channel search results")

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

		th.AddUserToChannel(th.BasicUser2, th.BasicChannel)

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

		commentsForPage, appErr := th.App.Srv().Store().Post().GetCommentsForPage(testPage2.Id, false)
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

func TestMovePageToWiki(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreatePagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditPagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionReadPagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreateWikiPrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditWikiPrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreatePagePrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditPagePrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionReadPagePrivateChannel.Id, model.ChannelUserRoleId)
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

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page to Move", "", th.BasicUser.Id, "")
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

		parentPage, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Parent Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		childPage1, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, parentPage.Id, "Child Page 1", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		childPage2, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, parentPage.Id, "Child Page 2", "", th.BasicUser.Id, "")
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

	t.Run("fail when user lacks edit permission on source wiki", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel()
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

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Private Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		resp, moveErr := client2.MovePageToWiki(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id)
		require.Error(t, moveErr)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail when user lacks create permission on target wiki", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel()
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

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page to Move", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		th.RemovePermissionFromRole(model.PermissionCreatePagePrivateChannel.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(model.PermissionCreatePagePrivateChannel.Id, model.ChannelUserRoleId)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		resp, moveErr := client2.MovePageToWiki(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id)
		require.Error(t, moveErr)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("system admin can move pages", func(t *testing.T) {
		th.LinkUserToTeam(th.SystemAdminUser, th.BasicTeam)
		th.AddUserToChannel(th.SystemAdminUser, th.BasicChannel)
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

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Admin Page", "", th.BasicUser.Id, "")
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

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page", "", th.BasicUser.Id, "")
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

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page", "", th.BasicUser.Id, "")
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

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page", "", th.BasicUser.Id, "")
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

		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki2.Id, "", "Page in Wiki 2", "", th.BasicUser.Id, "")
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

		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		resp, err = th.Client.MovePageToWiki(context.Background(), createdWiki.Id, page.Id, createdWiki.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		pageWikiId, appErr := th.App.GetWikiIdForPage(th.Context, page.Id)
		require.Nil(t, appErr)
		require.Equal(t, createdWiki.Id, pageWikiId)
	})

	t.Run("fail when moving between different channels", func(t *testing.T) {
		channel2 := th.CreatePublicChannel()

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

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		resp, err = th.Client.MovePageToWiki(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestDuplicatePage(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreatePagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditPagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionReadPagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreateWikiPrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditWikiPrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreatePagePrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditPagePrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionReadPagePrivateChannel.Id, model.ChannelUserRoleId)
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

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Original Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		duplicatedPage, resp, err := th.Client.DuplicatePage(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id, nil, nil)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, duplicatedPage)
		require.NotEqual(t, page.Id, duplicatedPage.Id)
		require.Equal(t, "Duplicate of Original Page", duplicatedPage.Props["title"])

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

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Original Page", "", th.BasicUser.Id, "")
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

		parentPage, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Parent Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		originalPage, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Original Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		duplicatedPage, resp, err := th.Client.DuplicatePage(context.Background(), createdWiki.Id, originalPage.Id, createdWiki.Id, &parentPage.Id, nil)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		require.NotNil(t, duplicatedPage)
		require.Equal(t, parentPage.Id, duplicatedPage.PageParentId)
	})

	t.Run("fail when user lacks read permission on source page", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel()
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

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Private Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		_, resp, err := client2.DuplicatePage(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id, nil, nil)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail when user lacks create permission on target wiki", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel()
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

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page to Duplicate", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		th.RemovePermissionFromRole(model.PermissionCreatePagePrivateChannel.Id, model.ChannelUserRoleId)
		defer th.AddPermissionToRole(model.PermissionCreatePagePrivateChannel.Id, model.ChannelUserRoleId)

		client2 := th.CreateClient()
		_, _, lErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, lErr)

		_, resp, err := client2.DuplicatePage(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id, nil, nil)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("fail when title conflict exists", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page1, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Existing Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		page2, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Original Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		conflictingTitle := page1.Props["title"].(string)
		_, resp, err = th.Client.DuplicatePage(context.Background(), createdWiki.Id, page2.Id, createdWiki.Id, nil, &conflictingTitle)
		require.Error(t, err)
		CheckErrorID(t, err, "app.page.duplicate.title_conflict")
		require.Equal(t, http.StatusConflict, resp.StatusCode)
	})

	t.Run("fail when duplicating across channels", func(t *testing.T) {
		channel1 := th.BasicChannel
		channel2 := th.CreatePublicChannel()

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

		page, appErr := th.App.CreateWikiPage(th.Context, createdSourceWiki.Id, "", "Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		_, resp, err = th.Client.DuplicatePage(context.Background(), createdSourceWiki.Id, page.Id, createdTargetWiki.Id, nil, nil)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestGetPageBreadcrumb(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreateWikiPrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreatePagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreatePagePrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionReadPagePublicChannel.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	t.Run("get breadcrumb for root page", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		rootPage, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Root Page", "", th.BasicUser.Id, "")
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

		level1, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Level 1", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		level2, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, level1.Id, "Level 2", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		level3, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, level2.Id, "Level 3", "", th.BasicUser.Id, "")
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

		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Test Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		breadcrumb, resp, err := th.Client.GetPageBreadcrumb(context.Background(), createdWiki.Id, page.Id)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotNil(t, breadcrumb)
		require.Contains(t, breadcrumb.Items[0].Path, th.BasicTeam.Name)
		require.Contains(t, breadcrumb.Items[0].Path, th.BasicChannel.Id)
		require.Contains(t, breadcrumb.Items[0].Path, "wikiId="+createdWiki.Id)
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

		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Test Page", "", th.BasicUser.Id, "")
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

		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki1.Id, "", "Test Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		_, resp, err = th.Client.GetPageBreadcrumb(context.Background(), createdWiki2.Id, page.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("fail without read permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel()

		th.Context.Session().UserId = th.BasicUser.Id
		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		createdPrivateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		page, appErr := th.App.CreateWikiPage(th.Context, createdPrivateWiki.Id, "", "Private Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, loginErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, loginErr)

		_, resp, err := client2.GetPageBreadcrumb(context.Background(), createdPrivateWiki.Id, page.Id)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestUpdatePageParent(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.AddPermissionToRole(model.PermissionCreateWikiPublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreateWikiPrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreatePagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionCreatePagePrivateChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionEditPagePublicChannel.Id, model.ChannelUserRoleId)
	th.AddPermissionToRole(model.PermissionReadPagePublicChannel.Id, model.ChannelUserRoleId)
	th.Context.Session().UserId = th.BasicUser.Id

	t.Run("successfully change page parent", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		parent1, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Parent 1", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		parent2, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Parent 2", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		child, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, parent1.Id, "Child", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		resp, err = th.Client.UpdatePageParent(context.Background(), createdWiki.Id, child.Id, parent2.Id)
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

		parent, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Parent", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		child, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, parent.Id, "Child", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		resp, err = th.Client.UpdatePageParent(context.Background(), createdWiki.Id, child.Id, "")
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

		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Test Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		resp, err = th.Client.UpdatePageParent(context.Background(), createdWiki.Id, page.Id, "invalid-id")
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

		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Test Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		resp, err = th.Client.UpdatePageParent(context.Background(), createdWiki.Id, page.Id, model.NewId())
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("fail when parent is not a page", func(t *testing.T) {
		wiki := &model.Wiki{
			ChannelId: th.BasicChannel.Id,
			Title:     "Test Wiki",
		}
		createdWiki, resp, err := th.Client.CreateWiki(context.Background(), wiki)
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		page, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Test Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		regularPost, postErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "Regular post",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, postErr)

		resp, err = th.Client.UpdatePageParent(context.Background(), createdWiki.Id, page.Id, regularPost.Id)
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

		page1, appErr := th.App.CreateWikiPage(th.Context, createdWiki1.Id, "", "Page 1", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		page2, appErr := th.App.CreateWikiPage(th.Context, createdWiki2.Id, "", "Page 2", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		resp, err = th.Client.UpdatePageParent(context.Background(), createdWiki1.Id, page1.Id, page2.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("fail without edit permission", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel()

		th.Context.Session().UserId = th.BasicUser.Id
		privateWiki := &model.Wiki{
			ChannelId: privateChannel.Id,
			Title:     "Private Wiki",
		}
		createdPrivateWiki, appErr := th.App.CreateWiki(th.Context, privateWiki, th.BasicUser.Id)
		require.Nil(t, appErr)

		page, appErr := th.App.CreateWikiPage(th.Context, createdPrivateWiki.Id, "", "Private Page", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		parent, appErr := th.App.CreateWikiPage(th.Context, createdPrivateWiki.Id, "", "Private Parent", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		client2 := th.CreateClient()
		_, _, loginErr := client2.Login(context.Background(), th.BasicUser2.Username, "Pa$$word11")
		require.NoError(t, loginErr)

		resp, err := client2.UpdatePageParent(context.Background(), createdPrivateWiki.Id, page.Id, parent.Id)
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

		parent, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, "", "Parent", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		child, appErr := th.App.CreateWikiPage(th.Context, createdWiki.Id, parent.Id, "Child", "", th.BasicUser.Id, "")
		require.Nil(t, appErr)

		resp, err = th.Client.UpdatePageParent(context.Background(), createdWiki.Id, parent.Id, child.Id)
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}
