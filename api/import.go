// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	goi18n "github.com/nicksnyder/go-i18n/i18n"
)

//
// Import functions are sutible for entering posts and users into the database without
// some of the usual checks. (IsValid is still run)
//

func ImportPost(T goi18n.TranslateFunc, post *model.Post) {
	post.Hashtags, _ = model.ParseHashtags(post.Message)

	if result := <-Srv.Store.Post().Save(T, post); result.Err != nil {
		l4g.Debug("Error saving post. user=" + post.UserId + ", message=" + post.Message)
	}
}

func ImportUser(T goi18n.TranslateFunc, user *model.User) *model.User {
	user.MakeNonNil()

	if result := <-Srv.Store.User().Save(T, user); result.Err != nil {
		l4g.Error("Error saving user. err=%v", result.Err)
		return nil
	} else {
		ruser := result.Data.(*model.User)

		if err := JoinDefaultChannels(T, ruser, ""); err != nil {
			l4g.Error("Encountered an issue joining default channels user_id=%s, team_id=%s, err=%v", ruser.Id, ruser.TeamId, err)
		}

		if cresult := <-Srv.Store.User().VerifyEmail(T, ruser.Id); cresult.Err != nil {
			l4g.Error("Failed to set email verified err=%v", cresult.Err)
		}

		return ruser
	}
}

func ImportChannel(T goi18n.TranslateFunc, channel *model.Channel) *model.Channel {
	if result := <-Srv.Store.Channel().Save(T, channel); result.Err != nil {
		return nil
	} else {
		sc := result.Data.(*model.Channel)

		return sc
	}
}
