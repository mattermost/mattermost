// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	mm_model "github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/markdown"
)

func postWithBoardsEmbed(post *mm_model.Post) *mm_model.Post {
	if _, ok := post.GetProps()["boards"]; ok {
		post.AddProp("boards", nil)
	}

	firstLink, newPostMessage := getFirstLinkAndShortenAllBoardsLink(post.Message)
	post.Message = newPostMessage

	if firstLink == "" {
		return post
	}

	u, err := url.Parse(firstLink)

	if err != nil {
		return post
	}

	// Trim away the first / because otherwise after we split the string, the first element in the array is a empty element
	urlPath := u.Path
	urlPath = strings.TrimPrefix(urlPath, "/")
	urlPath = strings.TrimSuffix(urlPath, "/")
	pathSplit := strings.Split(strings.ToLower(urlPath), "/")
	queryParams := u.Query()

	if len(pathSplit) == 0 {
		return post
	}

	teamID, boardID, viewID, cardID := returnBoardsParams(pathSplit)

	if teamID != "" && boardID != "" && viewID != "" && cardID != "" {
		b, _ := json.Marshal(BoardsEmbed{
			TeamID:       teamID,
			BoardID:      boardID,
			ViewID:       viewID,
			CardID:       cardID,
			ReadToken:    queryParams.Get("r"),
			OriginalPath: u.RequestURI(),
		})

		BoardsPostEmbed := &mm_model.PostEmbed{
			Type: mm_model.PostEmbedBoards,
			Data: string(b),
		}

		if post.Metadata == nil {
			post.Metadata = &mm_model.PostMetadata{}
		}

		post.Metadata.Embeds = []*mm_model.PostEmbed{BoardsPostEmbed}
		post.AddProp("boards", string(b))
	}

	return post
}

func getFirstLinkAndShortenAllBoardsLink(postMessage string) (firstLink, newPostMessage string) {
	newPostMessage = postMessage
	seenLinks := make(map[string]bool)
	markdown.Inspect(postMessage, func(blockOrInline interface{}) bool {
		if autoLink, ok := blockOrInline.(*markdown.Autolink); ok {
			link := autoLink.Destination()

			if firstLink == "" {
				firstLink = link
			}

			if seen := seenLinks[link]; !seen && isBoardsLink(link) {
				// TODO: Make sure that <Jump To Card> is Internationalized and translated to the Users Language preference
				markdownFormattedLink := fmt.Sprintf("[%s](%s)", "<Jump To Card>", link)
				newPostMessage = strings.ReplaceAll(newPostMessage, link, markdownFormattedLink)
				seenLinks[link] = true
			}
		}
		if inlineLink, ok := blockOrInline.(*markdown.InlineLink); ok {
			if link := inlineLink.Destination(); firstLink == "" {
				firstLink = link
			}
		}
		return true
	})

	return firstLink, newPostMessage
}

func returnBoardsParams(pathArray []string) (teamID, boardID, viewID, cardID string) {
	// The reason we are doing this search for the first instance of boards or plugins is to take into account URL subpaths
	index := -1
	for i := 0; i < len(pathArray); i++ {
		if pathArray[i] == "boards" || pathArray[i] == "plugins" {
			index = i
			break
		}
	}

	if index == -1 {
		return teamID, boardID, viewID, cardID
	}

	// If at index, the parameter in the path is boards,
	// then we've copied this directly as logged in user of that board

	// If at index, the parameter in the path is plugins,
	// then we've copied this from a shared board

	// For card links copied on a non-shared board, the path looks like {...Mattermost Url}.../boards/team/teamID/boardID/viewID/cardID

	// For card links copied on a shared board, the path looks like
	// {...Mattermost Url}.../plugins/focalboard/team/teamID/shared/boardID/viewID/cardID?r=read_token

	// This is a non-shared board card link
	if len(pathArray)-index == 6 && pathArray[index] == "boards" && pathArray[index+1] == "team" {
		teamID = pathArray[index+2]
		boardID = pathArray[index+3]
		viewID = pathArray[index+4]
		cardID = pathArray[index+5]
	} else if len(pathArray)-index == 8 && pathArray[index] == "plugins" &&
		pathArray[index+1] == "focalboard" &&
		pathArray[index+2] == "team" &&
		pathArray[index+4] == "shared" { // This is a shared board card link
		teamID = pathArray[index+3]
		boardID = pathArray[index+5]
		viewID = pathArray[index+6]
		cardID = pathArray[index+7]
	}
	return teamID, boardID, viewID, cardID
}

func isBoardsLink(link string) bool {
	u, err := url.Parse(link)

	if err != nil {
		return false
	}

	urlPath := u.Path
	urlPath = strings.TrimPrefix(urlPath, "/")
	urlPath = strings.TrimSuffix(urlPath, "/")
	pathSplit := strings.Split(strings.ToLower(urlPath), "/")

	if len(pathSplit) == 0 {
		return false
	}

	teamID, boardID, viewID, cardID := returnBoardsParams(pathSplit)
	return teamID != "" && boardID != "" && viewID != "" && cardID != ""
}
