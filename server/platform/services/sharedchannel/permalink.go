// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

var (
	// Team name regex taken from model.IsValidTeamName
	permaLinkRegex       = regexp.MustCompile(`https?://[0-9.\-A-Za-z]+/[a-z0-9]+([a-z\-0-9]+|(__)?)[a-z0-9]+/pl/([a-zA-Z0-9]+)`)
	permaLinkSharedRegex = regexp.MustCompile(`https?://[0-9.\-A-Za-z]+/[a-z0-9]+([a-z\-0-9]+|(__)?)[a-z0-9]+/plshared/([a-zA-Z0-9]+)`)
)

const (
	permalinkMarker = "plshared"
)

// processPermalinkToRemote processes all permalinks going towards a remote site.
func (scs *Service) processPermalinkToRemote(p *model.Post) string {
	// request.CTX is not widely used in the shared channels code.
	// Just create a new request.CTX for now.
	rctx := request.EmptyContext(scs.server.Log())

	var sent bool
	return permaLinkRegex.ReplaceAllStringFunc(p.Message, func(msg string) string {
		// Extract the postID (This is simple enough not to warrant full-blown URL parsing.)
		lastSlash := strings.LastIndexByte(msg, '/')
		postID := msg[lastSlash+1:]
		opts := model.GetPostsOptions{
			SkipFetchThreads: true,
		}
		postList, err := scs.server.GetStore().Post().Get(rctx, postID, opts, "", map[string]bool{})
		if err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceWarn, "Unable to get post during replacing permalinks", mlog.Err(err))
			return msg
		}
		if len(postList.Order) == 0 {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceWarn, "No post found for permalink", mlog.String("postID", postID))
			return msg
		}

		// If postID is for a different channel
		if postList.Posts[postList.Order[0]].ChannelId != p.ChannelId {
			// Send ephemeral message to OP (only once per message).
			if !sent {
				scs.sendEphemeralPost(p.ChannelId, p.UserId, i18n.T("sharedchannel.permalink.not_found"))
				sent = true
			}
			// But don't modify msg
			return msg
		}

		// Otherwise, modify pl to plshared as a marker to be replaced by remote sites
		return strings.Replace(msg, "/pl/", "/"+permalinkMarker+"/", 1)
	})
}

// processPermalinkFromRemote processes all permalinks coming from a remote site.
func (scs *Service) processPermalinkFromRemote(p *model.Post, team *model.Team) string {
	return permaLinkSharedRegex.ReplaceAllStringFunc(p.Message, func(remoteLink string) string {
		// Extract host name
		parsed, err := url.Parse(remoteLink)
		if err != nil {
			scs.server.Log().Log(mlog.LvlSharedChannelServiceWarn, "Unable to parse the remote link during replacing permalinks", mlog.Err(err))
			return remoteLink
		}

		// Replace with local SiteURL
		parsed.Scheme = scs.siteURL.Scheme
		parsed.Host = scs.siteURL.Host

		// Replace team name with local team
		teamEnd := strings.Index(parsed.Path, "/"+permalinkMarker)
		parsed.Path = "/" + team.Name + parsed.Path[teamEnd:]

		// Replace plshared with pl
		return strings.Replace(parsed.String(), "/"+permalinkMarker+"/", "/pl/", 1)
	})
}
