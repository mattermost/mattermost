// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package email

import (
	"fmt"
	"html"
	"html/template"
	"net/url"
	"path/filepath"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

type FieldRow struct {
	Cells []*model.SlackAttachmentField
}

type EmailMessageAttachment struct {
	model.SlackAttachment

	Pretext   template.HTML
	Text      template.HTML
	FieldRows []FieldRow
}

func (es *Service) GetMessageForNotification(post *model.Post, teamName, siteUrl string, translateFunc i18n.TranslateFunc) string {
	if strings.TrimSpace(post.Message) != "" || len(post.FileIds) == 0 {
		return es.prepareNotificationMessageForEmail(post.Message, teamName, siteUrl)
	}

	// extract the filenames from their paths and determine what type of files are attached
	infos, err := es.store.FileInfo().GetForPost(post.Id, true, false, true)
	if err != nil {
		mlog.Warn("Encountered error when getting files for notification message", mlog.String("post_id", post.Id), mlog.Err(err))
	}

	filenames := make([]string, len(infos))
	onlyImages := true
	for i, info := range infos {
		if escaped, err := url.QueryUnescape(filepath.Base(info.Name)); err != nil {
			// this should never error since filepath was escaped using url.QueryEscape
			filenames[i] = escaped
		} else {
			filenames[i] = info.Name
		}

		onlyImages = onlyImages && info.IsImage()
	}

	props := map[string]any{"Filenames": strings.Join(filenames, ", ")}

	if onlyImages {
		return translateFunc("api.post.get_message_for_notification.images_sent", len(filenames), props)
	}
	return translateFunc("api.post.get_message_for_notification.files_sent", len(filenames), props)
}

func ProcessMessageAttachments(post *model.Post, siteURL string) []*EmailMessageAttachment {
	emailMessageAttachments := []*EmailMessageAttachment{}

	for _, messageAttachment := range post.Attachments() {
		emailMessageAttachment := &EmailMessageAttachment{
			SlackAttachment: *messageAttachment,
			Pretext:         prepareTextForEmail(messageAttachment.Pretext, siteURL),
			Text:            prepareTextForEmail(messageAttachment.Text, siteURL),
		}

		stripedTitle, err := utils.StripMarkdown(emailMessageAttachment.Title)
		if err != nil {
			mlog.Warn("Failed parse to markdown from messageatatchment title", mlog.String("post_id", post.Id), mlog.Err(err))
			stripedTitle = ""
		}

		emailMessageAttachment.Title = stripedTitle

		shortFieldRow := FieldRow{}

		for i := range messageAttachment.Fields {
			// Create a new instance to avoid altering the original pointer reference
			// We update field value to parse markdown.
			// If we do that on the original pointer, the rendered text in mattermost
			// becomes invalid as its no longer a markdown string, but rather an HTML string.
			field := &model.SlackAttachmentField{
				Title: messageAttachment.Fields[i].Title,
				Value: messageAttachment.Fields[i].Value,
				Short: messageAttachment.Fields[i].Short,
			}

			if stringValue, ok := field.Value.(string); ok {
				field.Value = prepareTextForEmail(stringValue, siteURL)
			}

			if !field.Short {
				if len(shortFieldRow.Cells) > 0 {
					emailMessageAttachment.FieldRows = append(emailMessageAttachment.FieldRows, shortFieldRow)
					shortFieldRow = FieldRow{}
				}

				emailMessageAttachment.FieldRows = append(emailMessageAttachment.FieldRows, FieldRow{[]*model.SlackAttachmentField{field}})
			} else {
				shortFieldRow.Cells = append(shortFieldRow.Cells, field)

				if len(shortFieldRow.Cells) == 2 {
					emailMessageAttachment.FieldRows = append(emailMessageAttachment.FieldRows, shortFieldRow)
					shortFieldRow = FieldRow{}
				}
			}
		}

		// collect any leftover short fields
		if len(shortFieldRow.Cells) > 0 {
			emailMessageAttachment.FieldRows = append(emailMessageAttachment.FieldRows, shortFieldRow)
			shortFieldRow = FieldRow{}
		}

		emailMessageAttachments = append(emailMessageAttachments, emailMessageAttachment)
	}

	return emailMessageAttachments
}

func prepareTextForEmail(text, siteURL string) template.HTML {
	escapedText := html.EscapeString(text)
	markdownText, err := utils.MarkdownToHTML(escapedText, siteURL)
	if err != nil {
		mlog.Warn("Encountered error while converting markdown to HTML", mlog.Err(err))
		return template.HTML(text)
	}

	return template.HTML(markdownText)
}

func (es *Service) prepareNotificationMessageForEmail(postMessage, teamName, siteURL string) string {
	postMessage = html.EscapeString(postMessage)
	mdPostMessage, mdErr := utils.MarkdownToHTML(postMessage, siteURL)
	if mdErr != nil {
		mlog.Warn("Encountered error while converting markdown to HTML", mlog.Err(mdErr))
		mdPostMessage = postMessage
	}

	landingURL := siteURL + "/landing#/" + teamName
	normalizedPostMessage, err := es.GenerateHyperlinkForChannels(mdPostMessage, teamName, landingURL)
	if err != nil {
		mlog.Warn("Encountered error while generating hyperlink for channels", mlog.String("team_name", teamName), mlog.Err(err))
		normalizedPostMessage = mdPostMessage
	}
	return normalizedPostMessage
}

func (es *Service) GenerateHyperlinkForChannels(postMessage, teamName, landingURL string) (string, error) {
	channelNames := model.ChannelMentions(postMessage)
	if len(channelNames) == 0 {
		return postMessage, nil
	}

	team, err := es.Store().Team().GetByName(teamName)
	if err != nil {
		mlog.Error("Team not found with the name", mlog.String("team_name", teamName), mlog.Err(err))
		return postMessage, nil
	}

	channels, err := es.store.Channel().GetByNames(team.Id, channelNames, true)
	if err != nil {
		return "", err
	}

	visited := make(map[string]bool)
	for _, ch := range channels {
		if !visited[ch.Id] && ch.Type == model.ChannelTypeOpen {
			channelURL := landingURL + "/channels/" + ch.Name
			channelHyperLink := fmt.Sprintf("<a href='%s'>%s</a>", channelURL, "~"+ch.Name)
			postMessage = strings.Replace(postMessage, "~"+ch.Name, channelHyperLink, -1)
			visited[ch.Id] = true
		}
	}
	return postMessage, nil
}
