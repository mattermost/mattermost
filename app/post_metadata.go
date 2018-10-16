// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"image"
	"io"
	"net/http"
	"strings"

	"github.com/dyatlov/go-opengraph/opengraph"
	"github.com/mattermost/mattermost-server/mlog"
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

	// Proxy image links before constructing metadata so that requests go through the proxy
	post = a.PostWithProxyAddedToImageURLs(post)

	if post.Metadata == nil {
		post.Metadata = &model.PostMetadata{}

		// Emojis and reaction counts
		if emojis, reactionCounts, err := a.getEmojisAndReactionCountsForPost(post); err != nil {
			mlog.Warn("Failed to get emojis and reactions for a post", mlog.String("post_id", post.Id), mlog.Any("err", err))
		} else {
			post.Metadata.Emojis = emojis
			post.Metadata.ReactionCounts = reactionCounts
		}

		// Files
		if fileInfos, err := a.GetFileInfosForPost(post.Id, false); err != nil {
			mlog.Warn("Failed to get files for a post", mlog.String("post_id", post.Id), mlog.Any("err", err))
		} else {
			post.Metadata.FileInfos = fileInfos
		}

		// Embeds and image dimensions
		firstLink, images := getFirstLinkAndImages(post.Message)

		if embed, err := a.getEmbedForPost(post, firstLink); err != nil {
			mlog.Warn("Failed to get embedded content for a post", mlog.String("post_id", post.Id), mlog.Any("err", err))
		} else if embed == nil {
			post.Metadata.Embeds = []*model.PostEmbed{}
		} else {
			post.Metadata.Embeds = []*model.PostEmbed{embed}
		}

		post.Metadata.ImageDimensions = a.getImageDimensionsForPost(post, images)
	}

	return post, nil
}

func (a *App) getEmojisAndReactionCountsForPost(post *model.Post) ([]*model.Emoji, model.ReactionCounts, *model.AppError) {
	reactions, err := a.GetReactionsForPost(post.Id)
	if err != nil {
		return nil, nil, err
	}

	emojis, err := a.getCustomEmojisForPost(post.Message, reactions)
	if err != nil {
		return nil, nil, err
	}

	return emojis, model.CountReactions(reactions), nil
}

func (a *App) getEmbedForPost(post *model.Post, firstLink string) (*model.PostEmbed, error) {
	if _, ok := post.Props["attachments"]; ok {
		return &model.PostEmbed{
			Type: model.POST_EMBED_MESSAGE_ATTACHMENT,
		}, nil
	}

	if firstLink != "" {
		og, dimensions, err := a.getLinkMetadata(firstLink, true)
		if err != nil {
			return nil, err
		}

		if og != nil {
			return &model.PostEmbed{
				Type: model.POST_EMBED_OPENGRAPH,
				URL:  firstLink,
				Data: og,
			}, nil
		}

		if dimensions != nil {
			// Note that we're not passing the dimensions here since they'll be part of the PostMetadata.ImageDimensions field
			return &model.PostEmbed{
				Type: model.POST_EMBED_IMAGE,
				URL:  firstLink,
			}, nil
		}
	}

	return nil, nil
}

func (a *App) getImageDimensionsForPost(post *model.Post, images []string) map[string]*model.PostImageDimensions {
	allDimensions := map[string]*model.PostImageDimensions{}

	for _, embed := range post.Metadata.Embeds {
		switch embed.Type {
		case model.POST_EMBED_IMAGE:
			// These dimensions will generally be cached by a previous call to getEmbedForPost
			images = append(images, embed.URL)

		case model.POST_EMBED_MESSAGE_ATTACHMENT:
			images = append(images, getImagesInPostAttachments(post)...)

		case model.POST_EMBED_OPENGRAPH:
			for _, image := range embed.Data.(*opengraph.OpenGraph).Images {
				if image.Width != 0 || image.Height != 0 {
					// The site has already told us the image dimensions
					allDimensions[image.URL] = &model.PostImageDimensions{
						Width:  int(image.Width),
						Height: int(image.Height),
					}
				} else {
					// The site did not specify its image dimensions
					images = append(images, image.URL)
				}
			}
		}
	}

	for _, imageURL := range images {
		if _, dimensions, err := a.getLinkMetadata(imageURL, true); err != nil {
			mlog.Warn("Failed to get dimensions of an image in a post",
				mlog.String("post_id", post.Id), mlog.String("image_url", imageURL), mlog.Any("err", err))
		} else {
			allDimensions[imageURL] = dimensions
		}
	}

	return allDimensions
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

func getImagesInPostAttachments(post *model.Post) []string {
	var images []string

	for _, attachment := range post.Attachments() {
		_, imagesInText := getFirstLinkAndImages(attachment.Text)
		images = append(images, imagesInText...)

		_, imagesInPretext := getFirstLinkAndImages(attachment.Pretext)
		images = append(images, imagesInPretext...)

		for _, field := range attachment.Fields {
			if value, ok := field.Value.(string); ok {
				_, imagesInFieldValue := getFirstLinkAndImages(value)
				images = append(images, imagesInFieldValue...)
			}
		}
	}

	return images
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

	res, err := a.HTTPService.MakeClient(false).Do(request)
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
		dimensions, err := parseImageDimensions(body)
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

func parseImageDimensions(body io.Reader) (*model.PostImageDimensions, error) {
	config, _, err := image.DecodeConfig(body)
	if err != nil {
		return nil, err
	}

	dimensions := &model.PostImageDimensions{
		Width:  config.Width,
		Height: config.Height,
	}

	return dimensions, nil
}
