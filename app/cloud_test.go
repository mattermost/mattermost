package app

import (
	"context"
	"testing"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/require"
)

func Test_SendNotifyAdminPosts(t *testing.T) {
	t.Run("successfully send an upgrade notification to admin", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		ctx := request.NewContext(context.Background(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.NewId(), model.Session{}, nil)
		err := th.App.SendNotifyAdminPosts(ctx, false)
		require.NoError(t, err)
	})
}
