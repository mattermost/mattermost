// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

var (
	permaLinkRegex       = regexp.MustCompile(`https?://.*/pl/([a-zA-Z0-9]+)`)
	permaLinkSharedRegex = regexp.MustCompile(`https?://.*/plshared/([a-zA-Z0-9]+)`)
)

const (
	permalinkMarker = "plshared"
)

// processPermalinkToRemote processes all permalinks going towards a remote site.
func (scs *Service) processPermalinkToRemote(p *model.Post) string {
	return permaLinkRegex.ReplaceAllStringFunc(p.Message, func(msg string) string {
		// Extract the postID (This is simple enough not to warrant full-blown URL parsing.)
		lastSlash := strings.LastIndexByte(msg, '/')
		postID := msg[lastSlash+1:]
		postList, err := scs.server.GetStore().Post().Get(postID, true)
		if err != nil {
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceWarn, "Unable to get post during replacing permalinks", mlog.Err(err))
			return msg
		}
		if len(postList.Order) == 0 {
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceWarn, "No post found for permalink", mlog.String("postID", postID))
			return msg
		}

		// If postID is for a different channel
		if postList.Posts[postList.Order[0]].ChannelId != p.ChannelId {
			// Send ephemeral message to OP.
			// Note: Does this need to be translated?
			scs.sendEphemeralPost(p.ChannelId, p.UserId, "This post contains permalinks to other channels which may not be visible to users in other sites.")
			// But don't modify msg
			return msg
		}

		// Otherwise, modify pl to plshared as a marker to be replaced by remote sites
		return strings.Replace(msg, "/pl/", "/"+permalinkMarker+"/", 1)
	})
}

// processPermalinkFromRemote processes all permalinks coming from a remote site.
func (scs *Service) processPermalinkFromRemote(msg string) string {
	return permaLinkSharedRegex.ReplaceAllStringFunc(msg, func(remoteLink string) string {
		// Extract host name
		parsed, err := url.Parse(remoteLink)
		if err != nil {
			scs.server.GetLogger().Log(mlog.LvlSharedChannelServiceWarn, "Unable to parse the remote link during replacing permalinks", mlog.Err(err))
			return remoteLink
		}
		// Replace with local SiteURL
		parsed.Scheme = scs.siteURL.Scheme
		parsed.Host = scs.siteURL.Host

		// Replace plshared with pl
		return strings.Replace(parsed.String(), "/"+permalinkMarker+"/", "/pl/", 1)
	})
}
