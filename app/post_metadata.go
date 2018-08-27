// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"image"
	"io"
	"net/http"
	"strings"

	"github.com/dyatlov/go-opengraph/opengraph"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/mattermost/mattermost-server/utils/markdown"
)

const LINK_CACHE_SIZE = 10000
const LINK_CACHE_DURATION = 3600

var linkCache = utils.NewLru(LINK_CACHE_SIZE)

func (a *App) InitPostMetadata() {
	// Dump any cached links if the proxy settings have changed so image URLs can be updated
	a.AddConfigListener(func(before, after *model.Config) {
		if (before.ServiceSettings.ImageProxyType != after.ServiceSettings.ImageProxyType) ||
			(before.ServiceSettings.ImageProxyURL != after.ServiceSettings.ImageProxyType) {
			linkCache.Purge()
		}
	})
}

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

	needReactionCounts := post.ReactionCounts == nil
	needEmojis := post.Emojis == nil
	needOpenGraphData := post.OpenGraphData == nil
	needImageDimensions := post.ImageDimensions == nil

	// Get reactions to post
	var reactions []*model.Reaction
	if needReactionCounts || needEmojis {
		var err *model.AppError
		reactions, err = a.GetReactionsForPost(post.Id)
		if err != nil {
			return post, err
		}
	}

	if needReactionCounts {
		post.ReactionCounts = model.CountReactions(reactions)
	}

	// Get emojis for post
	if needEmojis {
		emojis, err := a.getCustomEmojisForPost(post.Message, reactions)
		if err != nil {
			return post, err
		}

		post.Emojis = emojis
	}

	// Get files for post
	if post.FileInfos == nil {
		fileInfos, err := a.GetFileInfosForPost(post.Id, false)
		if err != nil {
			return post, err
		}

		post.FileInfos = fileInfos
	}

	// Proxy image links in post
	post = a.PostWithProxyAddedToImageURLs(post)

	// Get OpenGraph and image metadata
	if needOpenGraphData || needImageDimensions {
		err := a.preparePostWithOpenGraphAndImageMetadata(post, needOpenGraphData, needImageDimensions)
		if err != nil {
			return post, err
		}
	}

	return post, nil
}

func (a *App) preparePostWithOpenGraphAndImageMetadata(post *model.Post, needOpenGraphData, needImageDimensions bool) *model.AppError {
	var appError *model.AppError

	if needOpenGraphData {
		post.OpenGraphData = []*opengraph.OpenGraph{}
	}

	if needImageDimensions {
		post.ImageDimensions = []*model.PostImageDimensions{}
	}

	firstLink, images := getFirstLinkAndImages(post.Message)

	// Look at the first link to see if it's a web page or an image
	if firstLink != "" {
		og, dimensions, err := a.getLinkMetadata(firstLink, true)
		if err != nil {
			// Keep going so that one bad link doesn't prevent other image dimensions from being sent to the client
			appError = model.NewAppError("PreparePostForClient", "app.post.metadata.link.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		if needOpenGraphData {
			post.OpenGraphData = append(post.OpenGraphData, og)
		}

		if needImageDimensions {
			post.ImageDimensions = append(post.ImageDimensions, dimensions)
		}
	}

	if needImageDimensions {
		// And dimensions for other images
		for _, image := range images {
			_, dimensions, err := a.getLinkMetadata(image, true)
			if err != nil {
				// Keep going so that one bad link doesn't prevent other image dimensions from being sent to the client
				appError = model.NewAppError("PreparePostForClient", "app.post.metadata.link.app_error", nil, err.Error(), http.StatusInternalServerError)
				continue
			}

			if dimensions != nil {
				post.ImageDimensions = append(post.ImageDimensions, dimensions)
			}
		}
	}

	return appError
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

// Given a string, returns the first autolinked URL in the string as well as an array of all Markdown
// images of the form ![alt text](image url). Note that this does not return Markdown links of the
// form [text](url).
func getFirstLinkAndImages(str string) (string, []string) {
	firstLink := ""
	images := []string{}

	markdown.Inspect(str, func(blockOrInline interface{}) bool {
		switch v := blockOrInline.(type) {
		case *markdown.Autolink:
			if firstLink == "" {
				firstLink = v.Destination()
			}
		case *markdown.InlineImage:
			images = append(images, v.Destination())
		case *markdown.ReferenceImage:
			images = append(images, v.ReferenceDefinition.Destination())
		}

		return true
	})

	if len(images) > 1 {
		images = model.RemoveDuplicateStrings(images)
	}

	return firstLink, images
}

func (a *App) getLinkMetadata(requestURL string, useCache bool) (*opengraph.OpenGraph, *model.PostImageDimensions, error) {
	// Check cache
	if useCache {
		og, dimensions, ok := getLinkMetadataFromCache(requestURL)

		if ok {
			return og, dimensions, nil
		}
	}

	// Make request for a web page or an image
	request, err := http.NewRequest("GET", requestURL, nil)
	if err != nil {
		return nil, nil, err
	}

	request.Header.Add("Accept", "text/html, image/*")

	res, err := a.HTTPClient(false).Do(request) // TODO figure out a way to mock out the client for testing
	if err != nil {
		return nil, nil, err
	}
	defer consumeAndClose(res)

	// Parse the data
	og, dimensions, err := a.parseLinkMetadata(requestURL, res.Body, res.Header.Get("Content-Type"))

	// Write back to cache
	if useCache {
		cacheLinkMetadata(requestURL, og, dimensions)
	}

	return og, dimensions, err
}

func getLinkMetadataFromCache(requestURL string) (*opengraph.OpenGraph, *model.PostImageDimensions, bool) {
	cached, ok := linkCache.Get(requestURL)
	if !ok {
		return nil, nil, false
	}

	switch v := cached.(type) {
	case *opengraph.OpenGraph:
		return v, nil, true
	case *model.PostImageDimensions:
		return nil, v, true
	default:
		return nil, nil, true
	}
}

func cacheLinkMetadata(requestURL string, og *opengraph.OpenGraph, dimensions *model.PostImageDimensions) {
	var val interface{}
	if og != nil {
		val = og
	} else if dimensions != nil {
		val = dimensions
	}

	linkCache.AddWithExpiresInSecs(requestURL, val, LINK_CACHE_DURATION)
}

func (a *App) parseLinkMetadata(requestURL string, body io.Reader, contentType string) (*opengraph.OpenGraph, *model.PostImageDimensions, error) {
	if strings.HasPrefix(contentType, "image") {
		dimensions, err := parseImageDimensions(requestURL, body)
		return nil, dimensions, err
	} else if strings.HasPrefix(contentType, "text/html") {
		og := a.ParseOpenGraphMetadata(requestURL, body, contentType)

		// The OpenGraph library and Go HTML library don't error for malformed input, so check that at least
		// one of these required fields exists before returning the OpenGraph data
		if og.Title != "" || og.Type != "" || og.URL != "" {
			return og, nil, nil
		} else {
			return nil, nil, nil
		}
	} else {
		// Not an image or web page with OpenGraph information
		return nil, nil, nil
	}
}

func parseImageDimensions(requestURL string, body io.Reader) (*model.PostImageDimensions, error) {
	config, _, err := image.DecodeConfig(body)
	if err != nil {
		return nil, err
	}

	dimensions := &model.PostImageDimensions{
		URL:    requestURL,
		Width:  config.Width,
		Height: config.Height,
	}

	return dimensions, nil
}
