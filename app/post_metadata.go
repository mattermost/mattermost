// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"strings"

	"github.com/dyatlov/go-opengraph/opengraph"
	"github.com/mattermost/mattermost-server/model"
)

func (a *App) PreparePostListForClient(originalList *model.PostList) (*model.PostList, *model.AppError) {
	list := &model.PostList{
		Posts: make(map[string]*model.Post),
		Order: originalList.Order,
	}

	for id, originalPost := range originalList.Posts {
		post, err := a.PreparePostForClient(originalPost)
		if err != nil {
			return originalList, err
		}

		list.Posts[id] = post
	}

	return list, nil
}

func (a *App) PreparePostForClient(originalPost *model.Post) (*model.Post, *model.AppError) {
	post := originalPost.Clone()

	var err *model.AppError

	needReactionCounts := post.ReactionCounts == nil
	needEmojis := post.Emojis == nil
	needImageDimensions := post.ImageDimensions == nil
	needOpenGraphData := post.OpenGraphData == nil

	var reactions []*model.Reaction
	if needReactionCounts || needEmojis {
		reactions, err = a.GetReactionsForPost(post.Id)
		if err != nil {
			return post, err
		}
	}

	if needReactionCounts {
		post.ReactionCounts = model.CountReactions(reactions)
	}

	if post.FileInfos == nil {
		fileInfos, err := a.GetFileInfosForPost(post.Id, false)
		if err != nil {
			return post, err
		}

		post.FileInfos = fileInfos
	}

	if needEmojis {
		emojis, err := a.getCustomEmojisForPost(post.Message, reactions)
		if err != nil {
			return post, err
		}

		post.Emojis = emojis
	}

	post = a.PostWithProxyAddedToImageURLs(post)

	if needImageDimensions || needOpenGraphData {
		if needImageDimensions {
			post.ImageDimensions = []*model.PostImageDimensions{}
		}

		if needOpenGraphData {
			post.OpenGraphData = []*opengraph.OpenGraph{}
		}

		// TODO
	}

	return post, nil
}

func (a *App) getCustomEmojisForPost(message string, reactions []*model.Reaction) ([]*model.Emoji, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableCustomEmoji {
		// Only custom emoji are returned
		return []*model.Emoji{}, nil
	}

	names := model.EMOJI_PATTERN.FindAllString(message, -1)

	for _, reaction := range reactions {
		names = append(names, reaction.EmojiName)
	}

	if len(names) == 0 {
		return []*model.Emoji{}, nil
	}

	names = model.RemoveDuplicateStrings(names)

	for i, name := range names {
		names[i] = strings.Trim(name, ":")
	}

	return a.GetMultipleEmojiByName(names)
}
