// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) LinkWikiToChannel(rctx request.CTX, wikiId, channelId, userId string) (*model.ChannelMemberLink, *model.AppError) {
	wiki, err := a.GetWiki(rctx, wikiId)
	if err != nil {
		return nil, err
	}

	return a.LinkWikiToChannelWithWiki(rctx, wiki, channelId, userId)
}

// LinkWikiToChannelWithWiki links a wiki to a channel using a pre-fetched wiki object,
// avoiding a redundant store lookup when the caller already has the wiki.
func (a *App) LinkWikiToChannelWithWiki(rctx request.CTX, wiki *model.Wiki, channelId, userId string) (*model.ChannelMemberLink, *model.AppError) {
	if wiki == nil || !model.IsValidId(wiki.Id) {
		return nil, model.NewAppError("LinkWikiToChannelWithWiki", "app.wiki_link.invalid_wiki_id", nil, "", http.StatusBadRequest)
	}
	if !model.IsValidId(channelId) {
		return nil, model.NewAppError("LinkWikiToChannelWithWiki", "app.wiki_link.invalid_channel_id", nil, "", http.StatusBadRequest)
	}
	if userId != "" && !model.IsValidId(userId) {
		return nil, model.NewAppError("LinkWikiToChannelWithWiki", "app.wiki_link.invalid_user_id", nil, "", http.StatusBadRequest)
	}

	channel, err := a.GetChannel(rctx, channelId)
	if err != nil {
		if err.StatusCode == http.StatusNotFound {
			// GetChannel excludes ChannelTypeWiki; a 404 may mean it's a wiki backing channel.
			if _, wikiErr := a.GetWikiBackingChannel(rctx, channelId); wikiErr == nil {
				return nil, model.NewAppError("LinkWikiToChannelWithWiki", "app.wiki_link.invalid_source_channel_type", nil, "", http.StatusBadRequest)
			}
		}
		return nil, err
	}

	if !isValidChannelMemberLinkSourceChannel(channel) {
		return nil, model.NewAppError("LinkWikiToChannelWithWiki", "app.wiki_link.invalid_source_channel_type", nil, "", http.StatusBadRequest)
	}

	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("LinkWikiToChannelWithWiki", "app.wiki_link.archived_channel", nil, "", http.StatusBadRequest)
	}

	if wiki.TeamId != channel.TeamId {
		return nil, model.NewAppError("LinkWikiToChannelWithWiki", "app.wiki_link.cross_team_not_allowed", nil, "", http.StatusBadRequest)
	}

	link := &model.ChannelMemberLink{
		SourceId:      channelId,
		DestinationId: wiki.ChannelId,
		WikiId:        wiki.Id,
		CreatorId:     userId,
	}
	savedLink, nErr := a.Srv().Store().ChannelMemberLink().SaveAndPropagateMembers(rctx, link, channelId, false)
	if nErr != nil {
		var errConflict *store.ErrConflict
		if errors.As(nErr, &errConflict) {
			return nil, model.NewAppError("LinkWikiToChannelWithWiki", "app.wiki_link.already_linked", nil, "", http.StatusConflict).Wrap(nErr)
		}
		var errInvalid *store.ErrInvalidInput
		if errors.As(nErr, &errInvalid) {
			if errInvalid.Field == "source_link_count" {
				return nil, model.NewAppError("LinkWikiToChannelWithWiki", "app.wiki_link.max_links_reached", nil, "", http.StatusBadRequest).Wrap(nErr)
			}
			if errInvalid.Field == "dest_link_count" {
				return nil, model.NewAppError("LinkWikiToChannelWithWiki", "app.wiki_link.max_sources_reached", nil, "", http.StatusBadRequest).Wrap(nErr)
			}
			return nil, model.NewAppError("LinkWikiToChannelWithWiki", "app.wiki_link.invalid_link", nil, "", http.StatusBadRequest).Wrap(nErr)
		}
		return nil, model.NewAppError("LinkWikiToChannelWithWiki", "app.wiki_link.save_failed", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	a.invalidateCachesForLinkChange(rctx, channelId, wiki.ChannelId)

	a.broadcastChannelMemberLinkEvent(model.WebsocketEventChannelMemberLinked, wiki.Id, channelId, savedLink.CreateAt)

	if userId != "" {
		a.sendWikiNotification(rctx, wikiNotificationParams{
			postType:    model.PostTypeWikiAdded,
			wiki:        wiki,
			channel:     channel,
			userId:      userId,
			userPropKey: "added_user_id",
		})
	}

	return savedLink, nil
}

func (a *App) UnlinkWikiFromChannel(rctx request.CTX, sourceId, destinationId string) *model.AppError {
	if !model.IsValidId(sourceId) {
		return model.NewAppError("UnlinkWikiFromChannel", "app.wiki_link.invalid_source_id", nil, "", http.StatusBadRequest)
	}
	if !model.IsValidId(destinationId) {
		return model.NewAppError("UnlinkWikiFromChannel", "app.wiki_link.invalid_destination_id", nil, "", http.StatusBadRequest)
	}

	sourceChannel, err := a.GetChannel(rctx, sourceId)
	if err != nil {
		return err
	}

	if !isValidChannelMemberLinkSourceChannel(sourceChannel) {
		return model.NewAppError("UnlinkWikiFromChannel", "app.wiki_link.invalid_source_channel_type", nil, "", http.StatusBadRequest)
	}

	wiki, wikiErr := a.GetWikiByChannelId(rctx, destinationId)
	if wikiErr != nil {
		return wikiErr
	}

	if wiki.TeamId != sourceChannel.TeamId {
		return model.NewAppError("UnlinkWikiFromChannel", "app.wiki_link.cross_team_not_allowed", nil, "", http.StatusNotFound)
	}

	if err := a.Srv().Store().ChannelMemberLink().DeleteAndCleanupMembers(rctx, sourceId, destinationId); err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return model.NewAppError("UnlinkWikiFromChannel", "app.wiki_link.not_found", nil, "", http.StatusNotFound).Wrap(err)
		}
		var conflictErr *store.ErrConflict
		if errors.As(err, &conflictErr) {
			return model.NewAppError("UnlinkWikiFromChannel", "app.wiki_link.lock_contention", nil, "", http.StatusConflict).Wrap(err)
		}
		return model.NewAppError("UnlinkWikiFromChannel", "app.wiki_link.delete_failed", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	a.invalidateCachesForLinkChange(rctx, sourceId, destinationId)

	a.broadcastChannelMemberLinkEvent(model.WebsocketEventChannelMemberUnlinked, wiki.Id, sourceId, model.GetMillis())

	return nil
}

func (a *App) GetChannelMemberLinksForChannel(rctx request.CTX, channelId string) ([]*model.ChannelMemberLink, *model.AppError) {
	if !model.IsValidId(channelId) {
		return nil, model.NewAppError("GetChannelMemberLinksForChannel", "app.wiki_link.invalid_channel_id", nil, "", http.StatusBadRequest)
	}
	links, err := a.Srv().Store().ChannelMemberLink().GetBySource(channelId)
	if err != nil {
		return nil, wrapChannelMemberLinkReadError("GetChannelMemberLinksForChannel", "get_links", err)
	}

	wikis, wikisErr := a.Srv().Store().Wiki().GetLinkedToChannel(channelId)
	if wikisErr != nil {
		return nil, wrapChannelMemberLinkReadError("GetChannelMemberLinksForChannel", "get_linked", wikisErr)
	}
	wikiIdByDest := make(map[string]string, len(wikis))
	for _, wiki := range wikis {
		wikiIdByDest[wiki.ChannelId] = wiki.Id
	}
	for _, link := range links {
		link.WikiId = wikiIdByDest[link.DestinationId]
	}

	return links, nil
}

func (a *App) GetChannelMemberLinksByDestination(rctx request.CTX, destinationId string) ([]*model.ChannelMemberLink, *model.AppError) {
	if !model.IsValidId(destinationId) {
		return nil, model.NewAppError("GetChannelMemberLinksByDestination", "app.wiki_link.invalid_destination_id", nil, "", http.StatusBadRequest)
	}
	links, err := a.Srv().Store().ChannelMemberLink().GetByDestination(destinationId)
	if err != nil {
		return nil, wrapChannelMemberLinkReadError("GetChannelMemberLinksByDestination", "get_by_destination", err)
	}
	return links, nil
}

func (a *App) GetWikisLinkedToChannel(rctx request.CTX, channelId string) ([]*model.Wiki, *model.AppError) {
	if !model.IsValidId(channelId) {
		return nil, model.NewAppError("GetWikisLinkedToChannel", "app.wiki_link.invalid_channel_id", nil, "", http.StatusBadRequest)
	}
	wikis, err := a.Srv().Store().Wiki().GetLinkedToChannel(channelId)
	if err != nil {
		return nil, wrapChannelMemberLinkReadError("GetWikisLinkedToChannel", "get_linked", err)
	}
	return wikis, nil
}

// wrapChannelMemberLinkReadError maps store errors from wiki-link read methods to AppErrors.
// keyPrefix is the i18n key segment under "app.wiki_link.<prefix>.{invalid_input,app_error}".
func wrapChannelMemberLinkReadError(caller, keyPrefix string, err error) *model.AppError {
	var errInvalid *store.ErrInvalidInput
	if errors.As(err, &errInvalid) {
		return model.NewAppError(caller, "app.wiki_link."+keyPrefix+".invalid_input", nil, "", http.StatusBadRequest).Wrap(err)
	}
	return model.NewAppError(caller, "app.wiki_link."+keyPrefix+".app_error", nil, "", http.StatusInternalServerError).Wrap(err)
}

// isValidChannelMemberLinkSourceChannel rejects DM/GM and wiki-backing channels as link sources.
func isValidChannelMemberLinkSourceChannel(ch *model.Channel) bool {
	return !ch.IsGroupOrDirect() && !ch.IsWikiBacking()
}

func (a *App) broadcastChannelMemberLinkEvent(event model.WebsocketEventType, wikiId, sourceChannelId string, createAt int64) {
	// Audience for wiki link changes is the source channel's members; the backing
	// channel is excluded from GetAllChannelMembersForUser and is an internal
	// storage detail per the project rule "never broadcast WS events to wiki
	// backing channel; only to linked source channels".
	m := model.NewWebSocketEvent(event, "", "", "", nil, "")
	m.Add("wiki_id", wikiId)
	m.Add("source_channel_id", sourceChannelId)
	m.Add("create_at", createAt)
	m = m.SetBroadcast(&model.WebsocketBroadcast{
		ChannelId:           sourceChannelId,
		ReliableClusterSend: true,
	})
	a.Publish(m)
}

func (a *App) invalidateCachesForLinkChange(rctx request.CTX, sourceChannelId, destinationChannelId string) {
	a.invalidateCacheForChannelMembers(sourceChannelId)
	a.invalidateCacheForChannelMembers(destinationChannelId)
	a.invalidateCacheForChannelPosts(destinationChannelId)
	a.Srv().Go(func() {
		if err := a.forEachChannelMember(rctx, sourceChannelId, func(m model.ChannelMember) error {
			a.Srv().Platform().InvalidateChannelCacheForUser(m.UserId)
			return nil
		}); err != nil {
			rctx.Logger().Warn("Failed to get source channel members for cache invalidation",
				mlog.String("source_channel_id", sourceChannelId), mlog.Err(err))
		}
	})
}
