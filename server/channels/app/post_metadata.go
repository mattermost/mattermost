// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bufio"
	"bytes"
	"fmt"
	"image"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/dyatlov/go-opengraph/opengraph"
	"github.com/pkg/errors"
	"golang.org/x/net/idna"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/markdown"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/imaging"
	"github.com/mattermost/mattermost/server/v8/channels/app/oembed"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/channels/utils/imgutils"
)

type linkMetadataCache struct {
	OpenGraph *opengraph.OpenGraph
	PostImage *model.PostImage
	Permalink *model.Permalink
}

const MaxMetadataImageSize = MaxOpenGraphResponseSize

const UnsafeLinksPostProp = "unsafe_links"

func (s *Server) initPostMetadata() {
	// Dump any cached links if the proxy settings have changed so image URLs can be updated
	s.platform.AddConfigListener(func(before, after *model.Config) {
		if (before.ImageProxySettings.Enable != after.ImageProxySettings.Enable) ||
			(before.ImageProxySettings.ImageProxyType != after.ImageProxySettings.ImageProxyType) ||
			(before.ImageProxySettings.RemoteImageProxyURL != after.ImageProxySettings.RemoteImageProxyURL) ||
			(before.ImageProxySettings.RemoteImageProxyOptions != after.ImageProxySettings.RemoteImageProxyOptions) {
			if err := platform.PurgeLinkCache(); err != nil {
				mlog.Warn("Failed to remove cached links when the proxy settings changed", mlog.Err(err))
			}
		}
	})
}

func (a *App) PreparePostListForClient(c request.CTX, originalList *model.PostList) *model.PostList {
	list := &model.PostList{
		Posts:                     make(map[string]*model.Post, len(originalList.Posts)),
		Order:                     originalList.Order,
		NextPostId:                originalList.NextPostId,
		PrevPostId:                originalList.PrevPostId,
		HasNext:                   originalList.HasNext,
		FirstInaccessiblePostTime: originalList.FirstInaccessiblePostTime,
	}

	for id, originalPost := range originalList.Posts {
		post := a.PreparePostForClientWithEmbedsAndImages(c, originalPost, false, false, false)

		list.Posts[id] = post
	}

	if a.IsPostPriorityEnabled() {
		priority, _ := a.GetPriorityForPostList(list)
		acknowledgements, _ := a.GetAcknowledgementsForPostList(list)

		for _, id := range list.Order {
			if _, ok := priority[id]; ok {
				list.Posts[id].Metadata.Priority = priority[id]
			}
			if _, ok := acknowledgements[id]; ok {
				list.Posts[id].Metadata.Acknowledgements = acknowledgements[id]
			}
		}
	}

	return list
}

// OverrideIconURLIfEmoji changes the post icon override URL prop, if it has an emoji icon,
// so that it points to the URL (relative) of the emoji - static if emoji is default, /api if custom.
func (a *App) OverrideIconURLIfEmoji(c request.CTX, post *model.Post) {
	prop, ok := post.GetProps()[model.PostPropsOverrideIconEmoji]
	if !ok || prop == nil {
		return
	}

	emojiName, ok := prop.(string)
	if !ok {
		return
	}

	if !*a.Config().ServiceSettings.EnablePostIconOverride || emojiName == "" {
		return
	}

	emojiName = strings.ReplaceAll(emojiName, ":", "")

	if emojiURL, err := a.GetEmojiStaticURL(c, emojiName); err == nil {
		post.AddProp(model.PostPropsOverrideIconURL, emojiURL)
	} else {
		c.Logger().Warn("Failed to retrieve URL for overridden profile icon (emoji)", mlog.String("emojiName", emojiName), mlog.Err(err))
	}
}

func (a *App) PreparePostForClient(c request.CTX, originalPost *model.Post, isNewPost, isEditPost, includePriority bool) *model.Post {
	post := originalPost.Clone()

	// Proxy image links before constructing metadata so that requests go through the proxy
	post = a.PostWithProxyAddedToImageURLs(post)

	a.OverrideIconURLIfEmoji(c, post)
	if post.Metadata == nil {
		post.Metadata = &model.PostMetadata{}
	}

	if post.DeleteAt > 0 {
		// For deleted posts we don't fill out metadata nor do we return the post content
		post.Message = ""
		post.Metadata = &model.PostMetadata{}
		return post
	}

	// Emojis and reaction counts
	if emojis, reactions, err := a.getEmojisAndReactionsForPost(c, post); err != nil {
		c.Logger().Warn("Failed to get emojis and reactions for a post", mlog.String("post_id", post.Id), mlog.Err(err))
	} else {
		post.Metadata.Emojis = emojis
		post.Metadata.Reactions = reactions
	}

	// Files
	if fileInfos, _, err := a.getFileMetadataForPost(c, post, isNewPost || isEditPost); err != nil {
		c.Logger().Warn("Failed to get files for a post", mlog.String("post_id", post.Id), mlog.Err(err))
	} else {
		post.Metadata.Files = fileInfos
	}

	if includePriority && a.IsPostPriorityEnabled() && post.RootId == "" {
		// Post's Priority if any
		if priority, err := a.GetPriorityForPost(post.Id); err != nil {
			c.Logger().Warn("Failed to get post priority for a post", mlog.String("post_id", post.Id), mlog.Err(err))
		} else {
			post.Metadata.Priority = priority
		}

		// Post's acknowledgements if any
		if acknowledgements, err := a.GetAcknowledgementsForPost(post.Id); err != nil {
			c.Logger().Warn("Failed to get post acknowledgements for a post", mlog.String("post_id", post.Id), mlog.Err(err))
		} else {
			post.Metadata.Acknowledgements = acknowledgements
		}
	}

	return post
}

func (a *App) PreparePostForClientWithEmbedsAndImages(c request.CTX, originalPost *model.Post, isNewPost, isEditPost, includePriority bool) *model.Post {
	post := a.PreparePostForClient(c, originalPost, isNewPost, isEditPost, includePriority)
	post = a.getEmbedsAndImages(c, post, isNewPost)
	return post
}

func (a *App) getEmbedsAndImages(c request.CTX, post *model.Post, isNewPost bool) *model.Post {
	if post.Metadata == nil {
		post.Metadata = &model.PostMetadata{}
	}

	if post.Metadata.Embeds == nil {
		post.Metadata.Embeds = []*model.PostEmbed{}
	}

	// Embeds and image dimensions
	firstLink, images := a.getFirstLinkAndImages(c, post.Message)

	if unsafeLinksProp := post.GetProp(UnsafeLinksPostProp); unsafeLinksProp != nil {
		if prop, ok := unsafeLinksProp.(string); ok && prop == "true" {
			images = []string{}
			if !looksLikeAPermalink(firstLink, *a.Config().ServiceSettings.SiteURL) {
				return post
			}
		}
	}

	if embed, err := a.getEmbedForPost(c, post, firstLink, isNewPost); err != nil {
		appErr, ok := err.(*model.AppError)
		isNotFound := ok && appErr.StatusCode == http.StatusNotFound
		// Ignore NotFound errors.
		if !isNotFound {
			c.Logger().Debug("Failed to get embedded content for a post", mlog.String("post_id", post.Id), mlog.Err(err))
		}
	} else if embed != nil {
		post.Metadata.Embeds = append(post.Metadata.Embeds, embed)
	}
	post.Metadata.Images = a.getImagesForPost(c, post, images, isNewPost)
	return post
}

func removePermalinkMetadataFromPost(post *model.Post) {
	removeEmbeddedPostsFromMetadata(post)
	post.DelProp(model.PostPropsPreviewedPost)
}

func removeEmbeddedPostsFromMetadata(post *model.Post) {
	if post.Metadata == nil || len(post.Metadata.Embeds) == 0 {
		return
	}

	// Remove all permalink embeds and only keep non-permalink embeds.
	// We always have only one permalink embed even if the post
	// contains multiple permalinks.
	var newEmbeds []*model.PostEmbed
	for _, embed := range post.Metadata.Embeds {
		if embed.Type != model.PostEmbedPermalink {
			newEmbeds = append(newEmbeds, embed)
		}
	}

	post.Metadata.Embeds = newEmbeds
}

func (a *App) sanitizePostMetadataForUserAndChannel(c request.CTX, post *model.Post, previewedPost *model.PreviewPost, previewedChannel *model.Channel, userID string) *model.Post {
	if post.Metadata == nil || len(post.Metadata.Embeds) == 0 || previewedPost == nil {
		return post
	}

	if previewedChannel != nil && !a.HasPermissionToReadChannel(c, userID, previewedChannel) {
		removePermalinkMetadataFromPost(post)
	}

	return post
}

func (a *App) SanitizePostMetadataForUser(c request.CTX, post *model.Post, userID string) (*model.Post, *model.AppError) {
	if post.Metadata == nil || len(post.Metadata.Embeds) == 0 {
		return post, nil
	}

	previewPost := post.GetPreviewPost()
	if previewPost == nil {
		return post, nil
	}

	previewedChannel, err := a.GetChannel(c, previewPost.Post.ChannelId)
	if err != nil {
		return nil, err
	}

	if previewedChannel != nil && !a.HasPermissionToReadChannel(c, userID, previewedChannel) {
		removePermalinkMetadataFromPost(post)
	}

	return post, nil
}

func (a *App) SanitizePostListMetadataForUser(c request.CTX, postList *model.PostList, userID string) (*model.PostList, *model.AppError) {
	clonedPostList := postList.Clone()
	for postID, post := range clonedPostList.Posts {
		sanitizedPost, err := a.SanitizePostMetadataForUser(c, post, userID)
		if err != nil {
			return nil, err
		}
		clonedPostList.Posts[postID] = sanitizedPost
	}
	return clonedPostList, nil
}

func (a *App) getFileMetadataForPost(rctx request.CTX, post *model.Post, fromMaster bool) ([]*model.FileInfo, int64, *model.AppError) {
	if len(post.FileIds) == 0 {
		return nil, 0, nil
	}

	return a.GetFileInfosForPost(rctx, post.Id, fromMaster, false)
}

func (a *App) getEmojisAndReactionsForPost(c request.CTX, post *model.Post) ([]*model.Emoji, []*model.Reaction, *model.AppError) {
	var reactions []*model.Reaction
	if post.HasReactions {
		var err *model.AppError
		reactions, err = a.GetReactionsForPost(post.Id)
		if err != nil {
			return nil, nil, err
		}
	}

	emojis, err := a.getCustomEmojisForPost(c, post, reactions)
	if err != nil {
		return nil, nil, err
	}

	return emojis, reactions, nil
}

func (a *App) getEmbedForPost(c request.CTX, post *model.Post, firstLink string, isNewPost bool) (*model.PostEmbed, error) {
	if _, ok := post.GetProps()["attachments"]; ok {
		return &model.PostEmbed{
			Type: model.PostEmbedMessageAttachment,
		}, nil
	}

	if _, ok := post.GetProps()["boards"]; ok {
		return &model.PostEmbed{
			Type: model.PostEmbedBoards,
			Data: post.GetProps()["boards"],
		}, nil
	}

	if firstLink == "" {
		return nil, nil
	}

	// Permalink previews are not toggled via the ServiceSettings.EnableLinkPreviews config setting.
	if !*a.Config().ServiceSettings.EnableLinkPreviews && !looksLikeAPermalink(firstLink, *a.Config().ServiceSettings.SiteURL) {
		return nil, nil
	}

	og, image, permalink, err := a.getLinkMetadata(c, firstLink, post.CreateAt, isNewPost, post.GetPreviewedPostProp())
	if err != nil {
		return nil, err
	}

	if !*a.Config().ServiceSettings.EnablePermalinkPreviews {
		permalink = nil
	}

	if og != nil {
		return &model.PostEmbed{
			Type: model.PostEmbedOpengraph,
			URL:  firstLink,
			Data: og,
		}, nil
	}

	if image != nil {
		// Note that we're not passing the image info here since it'll be part of the PostMetadata.Images field
		return &model.PostEmbed{
			Type: model.PostEmbedImage,
			URL:  firstLink,
		}, nil
	}

	if permalink != nil {
		return &model.PostEmbed{Type: model.PostEmbedPermalink, Data: permalink.PreviewPost}, nil
	}

	return &model.PostEmbed{
		Type: model.PostEmbedLink,
		URL:  firstLink,
	}, nil
}

func (a *App) getImagesForPost(c request.CTX, post *model.Post, imageURLs []string, isNewPost bool) map[string]*model.PostImage {
	images := map[string]*model.PostImage{}

	for _, embed := range post.Metadata.Embeds {
		switch embed.Type {
		case model.PostEmbedImage:
			// These dimensions will generally be cached by a previous call to getEmbedForPost
			imageURLs = append(imageURLs, embed.URL)

		case model.PostEmbedMessageAttachment:
			imageURLs = append(imageURLs, a.getImagesInMessageAttachments(c, post)...)

		case model.PostEmbedOpengraph:
			openGraph, ok := embed.Data.(*opengraph.OpenGraph)
			if !ok {
				c.Logger().Warn("Could not read the image data: the data could not be casted to OpenGraph",
					mlog.String("post_id", post.Id),
					mlog.String("data type", fmt.Sprintf("%t", embed.Data)),
				)
				continue
			}
			for _, image := range openGraph.Images {
				var imageURL string
				if image.SecureURL != "" {
					imageURL = image.SecureURL
				} else if image.URL != "" {
					imageURL = image.URL
				}

				if imageURL == "" {
					continue
				}

				imageURLs = append(imageURLs, imageURL)
			}
		}
	}

	// Removing duplicates isn't strictly since images is a map, but it feels safer to do it beforehand
	if len(imageURLs) > 1 {
		imageURLs = model.RemoveDuplicateStrings(imageURLs)
	}

	for _, imageURL := range imageURLs {
		// prevent infinite loop if a OG image URL is the same post's permalink
		resolvedURL := resolveMetadataURL(imageURL, a.GetSiteURL())
		if looksLikeAPermalink(resolvedURL, a.GetSiteURL()) {
			continue
		}

		if _, image, _, err := a.getLinkMetadata(c, imageURL, post.CreateAt, isNewPost, post.GetPreviewedPostProp()); err != nil {
			appErr, ok := err.(*model.AppError)
			isNotFound := ok && appErr.StatusCode == http.StatusNotFound
			// Ignore NotFound errors.
			if !isNotFound {
				c.Logger().Debug("Failed to get dimensions of an image in a post",
					mlog.String("post_id", post.Id),
					mlog.String("image_url", imageURL),
					mlog.Err(err),
				)
			}
		} else if image != nil {
			images[imageURL] = image
		}
	}

	return images
}

func getEmojiNamesForString(s string) []string {
	names := model.EmojiPattern.FindAllString(s, -1)

	for i, name := range names {
		names[i] = strings.Trim(name, ":")
	}

	return names
}

func getEmojiNamesForPost(post *model.Post, reactions []*model.Reaction) []string {
	// Post message
	names := getEmojiNamesForString(post.Message)

	// Reactions
	for _, reaction := range reactions {
		names = append(names, reaction.EmojiName)
	}

	// Post attachments
	for _, attachment := range post.Attachments() {
		if attachment.Title != "" {
			names = append(names, getEmojiNamesForString(attachment.Title)...)
		}

		if attachment.Text != "" {
			names = append(names, getEmojiNamesForString(attachment.Text)...)
		}

		if attachment.Pretext != "" {
			names = append(names, getEmojiNamesForString(attachment.Pretext)...)
		}

		for _, field := range attachment.Fields {
			if field == nil {
				continue
			}
			if value, ok := field.Value.(string); ok {
				names = append(names, getEmojiNamesForString(value)...)
			}
		}
	}

	// Remove duplicates
	names = model.RemoveDuplicateStrings(names)

	return names
}

func (a *App) getCustomEmojisForPost(c request.CTX, post *model.Post, reactions []*model.Reaction) ([]*model.Emoji, *model.AppError) {
	if !*a.Config().ServiceSettings.EnableCustomEmoji {
		// Only custom emoji are returned
		return []*model.Emoji{}, nil
	}

	names := getEmojiNamesForPost(post, reactions)
	if len(names) == 0 {
		return []*model.Emoji{}, nil
	}

	return a.GetMultipleEmojiByName(c, names)
}

func (a *App) isLinkAllowedForPreview(rctx request.CTX, link string) bool {
	domains := normalizeDomains(*a.Config().ServiceSettings.RestrictLinkPreviews)
	for _, d := range domains {
		parsed, err := url.Parse(link)
		if err != nil {
			rctx.Logger().Warn("Unable to parse the link", mlog.String("link", link), mlog.Err(err))
			// We disable link preview if link is badly formed
			// to remain on the safe side
			return false
		}
		// Conforming to IDNA2008 using the UTS-46 standard.
		cleaned, err := idna.Lookup.ToASCII(parsed.Hostname())
		if err != nil {
			rctx.Logger().Warn("Unable to lookup hostname to ASCII", mlog.String("hostname", parsed.Hostname()), mlog.Err(err))
			// Same applies if compatibility processing fails.
			return false
		}
		if strings.Contains(cleaned, d) {
			return false
		}
	}

	return true
}

func normalizeDomains(domains string) []string {
	// commas and @ signs are optional
	// can be in the form of "@corp.mattermost.com, mattermost.com mattermost.org" -> corp.mattermost.com mattermost.com mattermost.org
	return strings.Fields(
		strings.TrimSpace(
			strings.ToLower(
				strings.ReplaceAll(
					strings.ReplaceAll(domains, "@", " "),
					",", " "),
			),
		),
	)
}

// Given a string, returns the first autolinked URL in the string as well as an array of all Markdown
// images of the form ![alt text](image url). Note that this does not return Markdown links of the
// form [text](url).
func (a *App) getFirstLinkAndImages(c request.CTX, str string) (string, []string) {
	firstLink := ""
	images := []string{}

	markdown.Inspect(str, func(blockOrInline any) bool {
		switch v := blockOrInline.(type) {
		case *markdown.Autolink:
			if link := v.Destination(); firstLink == "" && a.isLinkAllowedForPreview(c, link) {
				firstLink = link
			}
		case *markdown.InlineImage:
			if link := v.Destination(); a.isLinkAllowedForPreview(c, link) {
				images = append(images, link)
			}
		case *markdown.ReferenceImage:
			if link := v.ReferenceDefinition.Destination(); a.isLinkAllowedForPreview(c, link) {
				images = append(images, link)
			}
		}

		return true
	})

	return firstLink, images
}

func (a *App) getImagesInMessageAttachments(rctx request.CTX, post *model.Post) []string {
	var images []string

	for _, attachment := range post.Attachments() {
		_, imagesInText := a.getFirstLinkAndImages(rctx, attachment.Text)
		images = append(images, imagesInText...)

		_, imagesInPretext := a.getFirstLinkAndImages(rctx, attachment.Pretext)
		images = append(images, imagesInPretext...)

		for _, field := range attachment.Fields {
			if field == nil {
				continue
			}
			if value, ok := field.Value.(string); ok {
				_, imagesInFieldValue := a.getFirstLinkAndImages(rctx, value)
				images = append(images, imagesInFieldValue...)
			}
		}

		if attachment.AuthorIcon != "" {
			images = append(images, attachment.AuthorIcon)
		}

		if attachment.ImageURL != "" {
			images = append(images, attachment.ImageURL)
		}

		if attachment.ThumbURL != "" {
			images = append(images, attachment.ThumbURL)
		}

		if attachment.FooterIcon != "" {
			images = append(images, attachment.FooterIcon)
		}
	}

	return images
}

func looksLikeAPermalink(url, siteURL string) bool {
	path, hasPrefix := strings.CutPrefix(strings.TrimSpace(url), siteURL)
	if !hasPrefix {
		return false
	}
	path = strings.TrimPrefix(path, "/")
	matched, err := regexp.MatchString(`^[0-9a-z_-]{1,64}/pl/[a-z0-9]{26}$`, path)
	if err != nil {
		mlog.Warn("error matching regex", mlog.Err(err))
	}
	return matched
}

func (a *App) containsPermalink(rctx request.CTX, post *model.Post) bool {
	link, _ := a.getFirstLinkAndImages(rctx, post.Message)
	if link == "" {
		return false
	}
	return looksLikeAPermalink(link, a.GetSiteURL())
}

func (a *App) getLinkMetadata(c request.CTX, requestURL string, timestamp int64, isNewPost bool, previewedPostPropVal string) (*opengraph.OpenGraph, *model.PostImage, *model.Permalink, error) {
	requestURL = resolveMetadataURL(requestURL, a.GetSiteURL())

	// If it's an embedded image, nothing to do.
	if strings.HasPrefix(strings.ToLower(requestURL), "data:image/") {
		return nil, nil, nil, nil
	}

	timestamp = model.FloorToNearestHour(timestamp)

	// Check cache
	og, image, permalink, ok := getLinkMetadataFromCache(requestURL, timestamp)
	if !*a.Config().ServiceSettings.EnablePermalinkPreviews {
		permalink = nil
	}

	if ok && previewedPostPropVal == "" {
		return og, image, permalink, nil
	}

	// Check the database if this isn't a new post. If it is a new post and the data is cached, it should be in memory.
	if !isNewPost {
		og, image, ok = a.getLinkMetadataFromDatabase(requestURL, timestamp)
		if ok && previewedPostPropVal == "" {
			cacheLinkMetadata(c, requestURL, timestamp, og, image, nil)
			return og, image, nil, nil
		}
	}

	var err error
	if looksLikeAPermalink(requestURL, a.GetSiteURL()) && *a.Config().ServiceSettings.EnablePermalinkPreviews {
		permalink, err = a.getLinkMetadataForPermalink(c, requestURL)

		if err != nil {
			return nil, nil, nil, err
		}
	} else if oEmbedProvider := oembed.FindEndpointForURL(requestURL); oEmbedProvider != nil {
		og, err = a.getLinkMetadataFromOEmbed(c, requestURL, oEmbedProvider)
	} else {
		og, image, err = a.getLinkMetadataForURL(c, requestURL)

		// We intentionally don't return early on an error because we want to save that there is no metadata for this link

		a.saveLinkMetadataToDatabase(requestURL, timestamp, og, image)
	}

	// Write back to cache and database, even if there was an error and the results are nil
	cacheLinkMetadata(c, requestURL, timestamp, og, image, permalink)

	return og, image, permalink, err
}

func (a *App) getLinkMetadataForPermalink(c request.CTX, requestURL string) (*model.Permalink, error) {
	referencedPostID := requestURL[len(requestURL)-26:]

	referencedPost, appErr := a.GetSinglePost(c, referencedPostID, false)
	// TODO: Look into saving a value in the LinkMetadata.Data field to prevent perpetually re-querying for the deleted post.
	if appErr != nil {
		return nil, appErr
	}

	referencedChannel, appErr := a.GetChannel(c, referencedPost.ChannelId)
	if appErr != nil {
		return nil, appErr
	}

	var referencedTeam *model.Team
	if referencedChannel.Type == model.ChannelTypeDirect || referencedChannel.Type == model.ChannelTypeGroup {
		referencedTeam = &model.Team{}
	} else {
		referencedTeam, appErr = a.GetTeam(referencedChannel.TeamId)
		if appErr != nil {
			return nil, appErr
		}
	}

	// Get metadata for embedded post
	var permalink *model.Permalink
	if a.containsPermalink(c, referencedPost) {
		// referencedPost contains a permalink: we don't get its metadata
		permalink = &model.Permalink{PreviewPost: model.NewPreviewPost(referencedPost, referencedTeam, referencedChannel)}
	} else {
		// referencedPost does not contain a permalink: we get its metadata
		referencedPostWithMetadata := a.PreparePostForClientWithEmbedsAndImages(c, referencedPost, false, false, false)
		permalink = &model.Permalink{PreviewPost: model.NewPreviewPost(referencedPostWithMetadata, referencedTeam, referencedChannel)}
	}

	return permalink, nil
}

func (a *App) getLinkMetadataFromOEmbed(c request.CTX, requestURL string, provider *oembed.ProviderEndpoint) (*opengraph.OpenGraph, error) {
	request, err := http.NewRequest("GET", provider.GetProviderURL(requestURL), nil)
	if err != nil {
		return nil, err
	}

	request.Header.Add("Accept", "application/json")
	request.Header.Add("Accept-Language", *a.Config().LocalizationSettings.DefaultServerLocale)

	client := a.HTTPService().MakeClient(false)
	client.Timeout = time.Duration(*a.Config().ExperimentalSettings.LinkMetadataTimeoutMilliseconds) * time.Millisecond

	res, err := client.Do(request)
	if err != nil {
		c.Logger().Warn("error fetching oEmbed data", mlog.Err(err))
		return nil, errors.Wrap(err, "getLinkMetadataFromOEmbed: Unable to get oEmbed data")
	}

	defer func() {
		if _, err = io.Copy(io.Discard, res.Body); err != nil {
			c.Logger().Warn("error discarding oEmbed response body", mlog.Err(err))
		}
		res.Body.Close()
	}()

	return a.parseOpenGraphFromOEmbed(requestURL, res.Body)
}

func (a *App) getLinkMetadataForURL(c request.CTX, requestURL string) (*opengraph.OpenGraph, *model.PostImage, error) {
	var request *http.Request
	// Make request for a web page or an image
	request, err := http.NewRequest("GET", requestURL, nil)
	if err != nil {
		return nil, nil, err
	}

	var body io.ReadCloser
	var contentType string

	if (request.URL.Scheme+"://"+request.URL.Host) == a.GetSiteURL() && request.URL.Path == "/api/v4/image" {
		// /api/v4/image requires authentication, so bypass the API by hitting the proxy directly
		body, contentType, err = a.ImageProxy().GetImageDirect(a.ImageProxy().GetUnproxiedImageURL(request.URL.String()))
	} else {
		request.Header.Add("Accept", "image/*")
		request.Header.Add("Accept", "text/html;q=0.8")
		request.Header.Add("Accept-Language", *a.Config().LocalizationSettings.DefaultServerLocale)

		client := a.HTTPService().MakeClient(false)
		client.Timeout = time.Duration(*a.Config().ExperimentalSettings.LinkMetadataTimeoutMilliseconds) * time.Millisecond

		var res *http.Response
		res, err = client.Do(request)
		if err != nil {
			c.Logger().Warn("error fetching OG image data", mlog.Err(err))
		}

		if res != nil {
			body = res.Body
			contentType = res.Header.Get("Content-Type")
		}
	}

	if body != nil {
		defer func() {
			if _, err = io.Copy(io.Discard, body); err != nil {
				c.Logger().Warn("error discarding OG image response body", mlog.Err(err))
			}
			body.Close()
		}()
	}

	var og *opengraph.OpenGraph
	var image *model.PostImage

	if err == nil {
		// Parse the data
		og, image, err = a.parseLinkMetadata(requestURL, body, contentType)
	}
	og = model.TruncateOpenGraph(og) // remove unwanted length of texts

	return og, image, err
}

// resolveMetadataURL resolves a given URL relative to the server's site URL.
func resolveMetadataURL(requestURL string, siteURL string) string {
	base, err := url.Parse(siteURL)
	if err != nil {
		return ""
	}

	resolved, err := base.Parse(requestURL)
	if err != nil {
		return ""
	}

	return resolved.String()
}

func getLinkMetadataFromCache(requestURL string, timestamp int64) (*opengraph.OpenGraph, *model.PostImage, *model.Permalink, bool) {
	var cached linkMetadataCache
	err := platform.LinkCache().Get(strconv.FormatInt(model.GenerateLinkMetadataHash(requestURL, timestamp), 16), &cached)
	if err != nil {
		return nil, nil, nil, false
	}

	return cached.OpenGraph, cached.PostImage, cached.Permalink, true
}

func (a *App) getLinkMetadataFromDatabase(requestURL string, timestamp int64) (*opengraph.OpenGraph, *model.PostImage, bool) {
	linkMetadata, err := a.Srv().Store().LinkMetadata().Get(requestURL, timestamp)
	if err != nil {
		return nil, nil, false
	}

	data := linkMetadata.Data

	switch v := data.(type) {
	case *opengraph.OpenGraph:
		return v, nil, true
	case *model.PostImage:
		return nil, v, true
	default:
		return nil, nil, true
	}
}

func (a *App) saveLinkMetadataToDatabase(requestURL string, timestamp int64, og *opengraph.OpenGraph, image *model.PostImage) {
	metadata := &model.LinkMetadata{
		URL:       requestURL,
		Timestamp: timestamp,
	}

	if og != nil {
		metadata.Type = model.LinkMetadataTypeOpengraph
		metadata.Data = og
	} else if image != nil {
		metadata.Type = model.LinkMetadataTypeImage
		metadata.Data = image
	} else {
		metadata.Type = model.LinkMetadataTypeNone
	}

	_, err := a.Srv().Store().LinkMetadata().Save(metadata)
	if err != nil {
		mlog.Warn("Failed to write link metadata", mlog.String("request_url", requestURL), mlog.Err(err))
	}
}

func cacheLinkMetadata(rctx request.CTX, requestURL string, timestamp int64, og *opengraph.OpenGraph, image *model.PostImage, permalink *model.Permalink) {
	metadata := linkMetadataCache{
		OpenGraph: og,
		PostImage: image,
		Permalink: permalink,
	}

	if err := platform.LinkCache().SetWithExpiry(strconv.FormatInt(model.GenerateLinkMetadataHash(requestURL, timestamp), 16), metadata, platform.LinkCacheDuration); err != nil {
		rctx.Logger().Warn("Failed to cache link metadata", mlog.String("request_url", requestURL), mlog.Err(err))
	}
}

// peekContentType peeks at the first 512 bytes of p, and attempts to detect
// the content type.  Returns empty string if error occurs.
func peekContentType(p *bufio.Reader) string {
	byt, err := p.Peek(512)
	if err != nil && err != bufio.ErrBufferFull && err != io.EOF {
		return ""
	}
	return http.DetectContentType(byt)
}

func (a *App) parseLinkMetadata(requestURL string, body io.Reader, contentType string) (*opengraph.OpenGraph, *model.PostImage, error) {
	if contentType == "" {
		bufRd := bufio.NewReader(body)
		// If the content-type is missing we try to detect it from the actual data.
		contentType = peekContentType(bufRd)
		body = bufRd
	}

	if contentType == "image/svg+xml" {
		image := &model.PostImage{
			Format: "svg",
		}

		return nil, image, nil
	} else if strings.HasPrefix(contentType, "image") {
		image, err := parseImages(io.LimitReader(body, MaxMetadataImageSize))
		return nil, image, err
	} else if strings.HasPrefix(contentType, "text/html") {
		og := a.parseOpenGraphMetadata(requestURL, body, contentType)

		// The OpenGraph library and Go HTML library don't error for malformed input, so check that at least
		// one of these required fields exists before returning the OpenGraph data
		if og.Title != "" || og.Type != "" || og.URL != "" {
			return og, nil, nil
		}
		return nil, nil, nil
	}
	// Not an image or web page with OpenGraph information
	return nil, nil, nil
}

func parseImages(body io.Reader) (*model.PostImage, error) {
	// Store any data that is read for the config for any further processing
	buf := &bytes.Buffer{}
	t := io.TeeReader(body, buf)

	// Read the image config to get the format and dimensions
	config, format, err := image.DecodeConfig(t)
	if err != nil {
		return nil, err
	}

	image := &model.PostImage{
		Width:  config.Width,
		Height: config.Height,
		Format: format,
	}

	if format == "jpeg" {
		if imageOrientation, err := imaging.GetImageOrientation(io.MultiReader(buf, body)); err == nil &&
			(imageOrientation == imaging.RotatedCWMirrored ||
				imageOrientation == imaging.RotatedCCW ||
				imageOrientation == imaging.RotatedCCWMirrored ||
				imageOrientation == imaging.RotatedCW) {
			image.Width, image.Height = image.Height, image.Width
		}
	}

	if format == "gif" {
		// Decoding the config may have read some of the image data, so re-read the data that has already been read first
		frameCount, err := imgutils.CountGIFFrames(io.MultiReader(buf, body))
		if err != nil {
			return nil, err
		}

		image.FrameCount = frameCount
	}

	// Make image information nil when the format is tiff
	if format == "tiff" {
		image = nil
	}

	return image, nil
}
