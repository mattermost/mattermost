// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "code.google.com/p/log4go"
	"github.com/mattermost/platform/model"
)

//
// Import functions are sutible for entering posts and users into the database without
// some of the usual checks. (IsValid is still run)
//

func ImportPost(post *model.Post) {
	post.Hashtags, _ = model.ParseHashtags(post.Message)

	if result := <-Srv.Store.Post().Save(post); result.Err != nil {
		l4g.Debug("Error saving post. user=" + post.UserId + ", message=" + post.Message)
	}
}

func ImportUser(user *model.User) *model.User {
	user.MakeNonNil()

	if result := <-Srv.Store.User().Save(user); result.Err != nil {
		l4g.Error("Error saving user. err=%v", result.Err)
		return nil
	} else {
		ruser := result.Data.(*model.User)

		if err := JoinDefaultChannels(ruser, ""); err != nil {
			l4g.Error("Encountered an issue joining default channels user_id=%s, team_id=%s, err=%v", ruser.Id, ruser.TeamId, err)
		}

		if cresult := <-Srv.Store.User().VerifyEmail(ruser.Id); cresult.Err != nil {
			l4g.Error("Failed to set email verified err=%v", cresult.Err)
		}

		return ruser
	}
}

func ImportChannel(channel *model.Channel) *model.Channel {
	if result := <-Srv.Store.Channel().Save(channel); result.Err != nil {
		return nil
	} else {
		sc := result.Data.(*model.Channel)

		return sc
	}
}
