// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

type SlackChannel struct {
	Id      string          `json:"id"`
	Name    string          `json:"name"`
	Creator string          `json:"creator"`
	Members []string        `json:"members"`
	Purpose SlackChannelSub `json:"purpose"`
	Topic   SlackChannelSub `json:"topic"`
	Type    string
}

type SlackChannelSub struct {
	Value string `json:"value"`
}

type SlackProfile struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email"`
}

type SlackUser struct {
	Id       string       `json:"id"`
	Username string       `json:"name"`
	Profile  SlackProfile `json:"profile"`
}

type SlackFile struct {
	Id    string `json:"id"`
	Title string `json:"title"`
}

type SlackPost struct {
	User        string                   `json:"user"`
	BotId       string                   `json:"bot_id"`
	BotUsername string                   `json:"username"`
	Text        string                   `json:"text"`
	TimeStamp   string                   `json:"ts"`
	ThreadTS    string                   `json:"thread_ts"`
	Type        string                   `json:"type"`
	SubType     string                   `json:"subtype"`
	Comment     *SlackComment            `json:"comment"`
	Upload      bool                     `json:"upload"`
	File        *SlackFile               `json:"file"`
	Files       []*SlackFile             `json:"files"`
	Attachments []*model.SlackAttachment `json:"attachments"`
}

var isValidChannelNameCharacters = regexp.MustCompile(`^[a-zA-Z0-9\-_]+$`).MatchString

const SLACK_IMPORT_MAX_FILE_SIZE = 1024 * 1024 * 70

type SlackComment struct {
	User    string `json:"user"`
	Comment string `json:"comment"`
}

func truncateRunes(s string, i int) string {
	runes := []rune(s)
	if len(runes) > i {
		return string(runes[:i])
	}
	return s
}

func SlackConvertTimeStamp(ts string) int64 {
	timeString := strings.SplitN(ts, ".", 2)[0]

	timeStamp, err := strconv.ParseInt(timeString, 10, 64)
	if err != nil {
		mlog.Warn("Slack Import: Bad timestamp detected.")
		return 1
	}
	return timeStamp * 1000 // Convert to milliseconds
}

func SlackConvertChannelName(channelName string, channelId string) string {
	newName := strings.Trim(channelName, "_-")
	if len(newName) == 1 {
		return "slack-channel-" + newName
	}

	if isValidChannelNameCharacters(newName) {
		return newName
	}
	return strings.ToLower(channelId)
}

func SlackParseChannels(data io.Reader, channelType string) ([]SlackChannel, error) {
	decoder := json.NewDecoder(data)

	var channels []SlackChannel
	if err := decoder.Decode(&channels); err != nil {
		mlog.Warn("Slack Import: Error occurred when parsing some Slack channels. Import may work anyway.")
		return channels, err
	}

	for i := range channels {
		channels[i].Type = channelType
	}

	return channels, nil
}

func SlackParseUsers(data io.Reader) ([]SlackUser, error) {
	decoder := json.NewDecoder(data)

	var users []SlackUser
	err := decoder.Decode(&users)
	// This actually returns errors that are ignored.
	// In this case it is erroring because of a null that Slack
	// introduced. So we just return the users here.
	return users, err
}

func SlackParsePosts(data io.Reader) ([]SlackPost, error) {
	decoder := json.NewDecoder(data)

	var posts []SlackPost
	if err := decoder.Decode(&posts); err != nil {
		mlog.Warn("Slack Import: Error occurred when parsing some Slack posts. Import may work anyway.")
		return posts, err
	}
	return posts, nil
}

func (a *App) SlackAddUsers(teamId string, slackusers []SlackUser, importerLog *bytes.Buffer) map[string]*model.User {
	// Log header
	importerLog.WriteString(utils.T("api.slackimport.slack_add_users.created"))
	importerLog.WriteString("===============\r\n\r\n")

	addedUsers := make(map[string]*model.User)

	// Need the team
	team, err := a.Srv.Store.Team().Get(teamId)
	if err != nil {
		importerLog.WriteString(utils.T("api.slackimport.slack_import.team_fail"))
		return addedUsers
	}

	for _, sUser := range slackusers {
		firstName := sUser.Profile.FirstName
		lastName := sUser.Profile.LastName
		email := sUser.Profile.Email
		if email == "" {
			email = sUser.Username + "@example.com"
			importerLog.WriteString(utils.T("api.slackimport.slack_add_users.missing_email_address", map[string]interface{}{"Email": email, "Username": sUser.Username}))
			mlog.Warn("Slack Import: User does not have an email address in the Slack export. Used username as a placeholder. The user should update their email address once logged in to the system.", mlog.String("user_email", email), mlog.String("user_name", sUser.Username))
		}

		password := model.NewId()

		// Check for email conflict and use existing user if found
		if existingUser, err := a.Srv.Store.User().GetByEmail(email); err == nil {
			addedUsers[sUser.Id] = existingUser
			if err := a.JoinUserToTeam(team, addedUsers[sUser.Id], ""); err != nil {
				importerLog.WriteString(utils.T("api.slackimport.slack_add_users.merge_existing_failed", map[string]interface{}{"Email": existingUser.Email, "Username": existingUser.Username}))
			} else {
				importerLog.WriteString(utils.T("api.slackimport.slack_add_users.merge_existing", map[string]interface{}{"Email": existingUser.Email, "Username": existingUser.Username}))
			}
			continue
		}

		newUser := model.User{
			Username:  sUser.Username,
			FirstName: firstName,
			LastName:  lastName,
			Email:     email,
			Password:  password,
		}

		mUser := a.OldImportUser(team, &newUser)
		if mUser == nil {
			importerLog.WriteString(utils.T("api.slackimport.slack_add_users.unable_import", map[string]interface{}{"Username": sUser.Username}))
			continue
		}
		addedUsers[sUser.Id] = mUser
		importerLog.WriteString(utils.T("api.slackimport.slack_add_users.email_pwd", map[string]interface{}{"Email": newUser.Email, "Password": password}))
	}

	return addedUsers
}

func (a *App) SlackAddBotUser(teamId string, log *bytes.Buffer) *model.User {
	team, err := a.Srv.Store.Team().Get(teamId)
	if err != nil {
		log.WriteString(utils.T("api.slackimport.slack_import.team_fail"))
		return nil
	}

	password := model.NewId()
	username := "slackimportuser_" + model.NewId()
	email := username + "@localhost"

	botUser := model.User{
		Username:  username,
		FirstName: "",
		LastName:  "",
		Email:     email,
		Password:  password,
	}

	mUser := a.OldImportUser(team, &botUser)
	if mUser == nil {
		log.WriteString(utils.T("api.slackimport.slack_add_bot_user.unable_import", map[string]interface{}{"Username": username}))
		return nil
	}

	log.WriteString(utils.T("api.slackimport.slack_add_bot_user.email_pwd", map[string]interface{}{"Email": botUser.Email, "Password": password}))
	return mUser
}

func (a *App) SlackAddPosts(teamId string, channel *model.Channel, posts []SlackPost, users map[string]*model.User, uploads map[string]*zip.File, botUser *model.User) {
	sort.Slice(posts, func(i, j int) bool {
		return SlackConvertTimeStamp(posts[i].TimeStamp) < SlackConvertTimeStamp(posts[j].TimeStamp)
	})
	threads := make(map[string]string)
	for _, sPost := range posts {
		switch {
		case sPost.Type == "message" && (sPost.SubType == "" || sPost.SubType == "file_share"):
			if sPost.User == "" {
				mlog.Debug("Slack Import: Unable to import the message as the user field is missing.")
				continue
			}
			if users[sPost.User] == nil {
				mlog.Debug("Slack Import: Unable to add the message as the Slack user does not exist in Mattermost.", mlog.String("user", sPost.User))
				continue
			}
			newPost := model.Post{
				UserId:    users[sPost.User].Id,
				ChannelId: channel.Id,
				Message:   sPost.Text,
				CreateAt:  SlackConvertTimeStamp(sPost.TimeStamp),
			}
			if sPost.Upload {
				if sPost.File != nil {
					if fileInfo, ok := a.SlackUploadFile(sPost.File, uploads, teamId, newPost.ChannelId, newPost.UserId, sPost.TimeStamp); ok {
						newPost.FileIds = append(newPost.FileIds, fileInfo.Id)
					}
				} else if sPost.Files != nil {
					for _, file := range sPost.Files {
						if fileInfo, ok := a.SlackUploadFile(file, uploads, teamId, newPost.ChannelId, newPost.UserId, sPost.TimeStamp); ok {
							newPost.FileIds = append(newPost.FileIds, fileInfo.Id)
						}
					}
				}
			}
			// If post in thread
			if sPost.ThreadTS != "" && sPost.ThreadTS != sPost.TimeStamp {
				newPost.RootId = threads[sPost.ThreadTS]
				newPost.ParentId = threads[sPost.ThreadTS]
			}
			postId := a.OldImportPost(&newPost)
			// If post is thread starter
			if sPost.ThreadTS == sPost.TimeStamp {
				threads[sPost.ThreadTS] = postId
			}
		case sPost.Type == "message" && sPost.SubType == "file_comment":
			if sPost.Comment == nil {
				mlog.Debug("Slack Import: Unable to import the message as it has no comments.")
				continue
			}
			if sPost.Comment.User == "" {
				mlog.Debug("Slack Import: Unable to import the message as the user field is missing.")
				continue
			}
			if users[sPost.Comment.User] == nil {
				mlog.Debug("Slack Import: Unable to add the message as the Slack user does not exist in Mattermost.", mlog.String("user", sPost.User))
				continue
			}
			newPost := model.Post{
				UserId:    users[sPost.Comment.User].Id,
				ChannelId: channel.Id,
				Message:   sPost.Comment.Comment,
				CreateAt:  SlackConvertTimeStamp(sPost.TimeStamp),
			}
			a.OldImportPost(&newPost)
		case sPost.Type == "message" && sPost.SubType == "bot_message":
			if botUser == nil {
				mlog.Warn("Slack Import: Unable to import the bot message as the bot user does not exist.")
				continue
			}
			if sPost.BotId == "" {
				mlog.Warn("Slack Import: Unable to import bot message as the BotId field is missing.")
				continue
			}

			props := make(model.StringInterface)
			props["override_username"] = sPost.BotUsername
			if len(sPost.Attachments) > 0 {
				props["attachments"] = sPost.Attachments
			}

			post := &model.Post{
				UserId:    botUser.Id,
				ChannelId: channel.Id,
				CreateAt:  SlackConvertTimeStamp(sPost.TimeStamp),
				Message:   sPost.Text,
				Type:      model.POST_SLACK_ATTACHMENT,
			}

			postId := a.OldImportIncomingWebhookPost(post, props)
			// If post is thread starter
			if sPost.ThreadTS == sPost.TimeStamp {
				threads[sPost.ThreadTS] = postId
			}
		case sPost.Type == "message" && (sPost.SubType == "channel_join" || sPost.SubType == "channel_leave"):
			if sPost.User == "" {
				mlog.Debug("Slack Import: Unable to import the message as the user field is missing.")
				continue
			}
			if users[sPost.User] == nil {
				mlog.Debug("Slack Import: Unable to add the message as the Slack user does not exist in Mattermost.", mlog.String("user", sPost.User))
				continue
			}

			var postType string
			if sPost.SubType == "channel_join" {
				postType = model.POST_JOIN_CHANNEL
			} else {
				postType = model.POST_LEAVE_CHANNEL
			}

			newPost := model.Post{
				UserId:    users[sPost.User].Id,
				ChannelId: channel.Id,
				Message:   sPost.Text,
				CreateAt:  SlackConvertTimeStamp(sPost.TimeStamp),
				Type:      postType,
				Props: model.StringInterface{
					"username": users[sPost.User].Username,
				},
			}
			a.OldImportPost(&newPost)
		case sPost.Type == "message" && sPost.SubType == "me_message":
			if sPost.User == "" {
				mlog.Debug("Slack Import: Unable to import the message as the user field is missing.")
				continue
			}
			if users[sPost.User] == nil {
				mlog.Debug("Slack Import: Unable to add the message as the Slack user does not exist in Mattermost.", mlog.String("user", sPost.User))
				continue
			}
			newPost := model.Post{
				UserId:    users[sPost.User].Id,
				ChannelId: channel.Id,
				Message:   "*" + sPost.Text + "*",
				CreateAt:  SlackConvertTimeStamp(sPost.TimeStamp),
			}
			postId := a.OldImportPost(&newPost)
			// If post is thread starter
			if sPost.ThreadTS == sPost.TimeStamp {
				threads[sPost.ThreadTS] = postId
			}
		case sPost.Type == "message" && sPost.SubType == "channel_topic":
			if sPost.User == "" {
				mlog.Debug("Slack Import: Unable to import the message as the user field is missing.")
				continue
			}
			if users[sPost.User] == nil {
				mlog.Debug("Slack Import: Unable to add the message as the Slack user does not exist in Mattermost.", mlog.String("user", sPost.User))
				continue
			}
			newPost := model.Post{
				UserId:    users[sPost.User].Id,
				ChannelId: channel.Id,
				Message:   sPost.Text,
				CreateAt:  SlackConvertTimeStamp(sPost.TimeStamp),
				Type:      model.POST_HEADER_CHANGE,
			}
			a.OldImportPost(&newPost)
		case sPost.Type == "message" && sPost.SubType == "channel_purpose":
			if sPost.User == "" {
				mlog.Debug("Slack Import: Unable to import the message as the user field is missing.")
				continue
			}
			if users[sPost.User] == nil {
				mlog.Debug("Slack Import: Unable to add the message as the Slack user does not exist in Mattermost.", mlog.String("user", sPost.User))
				continue
			}
			newPost := model.Post{
				UserId:    users[sPost.User].Id,
				ChannelId: channel.Id,
				Message:   sPost.Text,
				CreateAt:  SlackConvertTimeStamp(sPost.TimeStamp),
				Type:      model.POST_PURPOSE_CHANGE,
			}
			a.OldImportPost(&newPost)
		case sPost.Type == "message" && sPost.SubType == "channel_name":
			if sPost.User == "" {
				mlog.Debug("Slack Import: Unable to import the message as the user field is missing.")
				continue
			}
			if users[sPost.User] == nil {
				mlog.Debug("Slack Import: Unable to add the message as the Slack user does not exist in Mattermost.", mlog.String("user", sPost.User))
				continue
			}
			newPost := model.Post{
				UserId:    users[sPost.User].Id,
				ChannelId: channel.Id,
				Message:   sPost.Text,
				CreateAt:  SlackConvertTimeStamp(sPost.TimeStamp),
				Type:      model.POST_DISPLAYNAME_CHANGE,
			}
			a.OldImportPost(&newPost)
		default:
			mlog.Warn(
				"Slack Import: Unable to import the message as its type is not supported",
				mlog.String("post_type", sPost.Type),
				mlog.String("post_subtype", sPost.SubType),
			)
		}
	}
}

func (a *App) SlackUploadFile(slackPostFile *SlackFile, uploads map[string]*zip.File, teamId string, channelId string, userId string, slackTimestamp string) (*model.FileInfo, bool) {
	if slackPostFile == nil {
		mlog.Warn("Slack Import: Unable to attach the file to the post as the latter has no file section present in Slack export.")
		return nil, false
	}
	file, ok := uploads[slackPostFile.Id]
	if !ok {
		mlog.Warn("Slack Import: Unable to import file as the file is missing from the Slack export zip file.", mlog.String("file_id", slackPostFile.Id))
		return nil, false
	}
	openFile, err := file.Open()
	if err != nil {
		mlog.Warn("Slack Import: Unable to open the file from the Slack export.", mlog.String("file_id", slackPostFile.Id), mlog.Err(err))
		return nil, false
	}
	defer openFile.Close()

	timestamp := utils.TimeFromMillis(SlackConvertTimeStamp(slackTimestamp))
	uploadedFile, err := a.OldImportFile(timestamp, openFile, teamId, channelId, userId, filepath.Base(file.Name))
	if err != nil {
		mlog.Warn("Slack Import: An error occurred when uploading file.", mlog.String("file_id", slackPostFile.Id), mlog.Err(err))
		return nil, false
	}

	return uploadedFile, true
}

func (a *App) deactivateSlackBotUser(user *model.User) {
	if _, err := a.UpdateActive(user, false); err != nil {
		mlog.Warn("Slack Import: Unable to deactivate the user account used for the bot.")
	}
}

func (a *App) addSlackUsersToChannel(members []string, users map[string]*model.User, channel *model.Channel, log *bytes.Buffer) {
	for _, member := range members {
		user, ok := users[member]
		if !ok {
			log.WriteString(utils.T("api.slackimport.slack_add_channels.failed_to_add_user", map[string]interface{}{"Username": "?"}))
			continue
		}
		if _, err := a.AddUserToChannel(user, channel); err != nil {
			log.WriteString(utils.T("api.slackimport.slack_add_channels.failed_to_add_user", map[string]interface{}{"Username": user.Username}))
		}
	}
}

func SlackSanitiseChannelProperties(channel model.Channel) model.Channel {
	if utf8.RuneCountInString(channel.DisplayName) > model.CHANNEL_DISPLAY_NAME_MAX_RUNES {
		mlog.Warn("Slack Import: Channel display name exceeds the maximum length. It will be truncated when imported.", mlog.String("channel_display_name", channel.DisplayName))
		channel.DisplayName = truncateRunes(channel.DisplayName, model.CHANNEL_DISPLAY_NAME_MAX_RUNES)
	}

	if len(channel.Name) > model.CHANNEL_NAME_MAX_LENGTH {
		mlog.Warn("Slack Import: Channel handle exceeds the maximum length. It will be truncated when imported.", mlog.String("channel_display_name", channel.DisplayName))
		channel.Name = channel.Name[0:model.CHANNEL_NAME_MAX_LENGTH]
	}

	if utf8.RuneCountInString(channel.Purpose) > model.CHANNEL_PURPOSE_MAX_RUNES {
		mlog.Warn("Slack Import: Channel purpose exceeds the maximum length. It will be truncated when imported.", mlog.String("channel_display_name", channel.DisplayName))
		channel.Purpose = truncateRunes(channel.Purpose, model.CHANNEL_PURPOSE_MAX_RUNES)
	}

	if utf8.RuneCountInString(channel.Header) > model.CHANNEL_HEADER_MAX_RUNES {
		mlog.Warn("Slack Import: Channel header exceeds the maximum length. It will be truncated when imported.", mlog.String("channel_display_name", channel.DisplayName))
		channel.Header = truncateRunes(channel.Header, model.CHANNEL_HEADER_MAX_RUNES)
	}

	return channel
}

func (a *App) SlackAddChannels(teamId string, slackchannels []SlackChannel, posts map[string][]SlackPost, users map[string]*model.User, uploads map[string]*zip.File, botUser *model.User, importerLog *bytes.Buffer) map[string]*model.Channel {
	// Write Header
	importerLog.WriteString(utils.T("api.slackimport.slack_add_channels.added"))
	importerLog.WriteString("=================\r\n\r\n")

	addedChannels := make(map[string]*model.Channel)
	for _, sChannel := range slackchannels {
		newChannel := model.Channel{
			TeamId:      teamId,
			Type:        sChannel.Type,
			DisplayName: sChannel.Name,
			Name:        SlackConvertChannelName(sChannel.Name, sChannel.Id),
			Purpose:     sChannel.Purpose.Value,
			Header:      sChannel.Topic.Value,
		}

		// Direct message channels in Slack don't have a name so we set the id as name or else the messages won't get imported.
		if newChannel.Type == model.CHANNEL_DIRECT {
			sChannel.Name = sChannel.Id
		}

		newChannel = SlackSanitiseChannelProperties(newChannel)

		var mChannel *model.Channel
		var err *model.AppError
		if mChannel, err = a.Srv.Store.Channel().GetByName(teamId, sChannel.Name, true); err == nil {
			// The channel already exists as an active channel. Merge with the existing one.
			importerLog.WriteString(utils.T("api.slackimport.slack_add_channels.merge", map[string]interface{}{"DisplayName": newChannel.DisplayName}))
		} else if _, err := a.Srv.Store.Channel().GetDeletedByName(teamId, sChannel.Name); err == nil {
			// The channel already exists but has been deleted. Generate a random string for the handle instead.
			newChannel.Name = model.NewId()
			newChannel = SlackSanitiseChannelProperties(newChannel)
		}

		if mChannel == nil {
			// Haven't found an existing channel to merge with. Try importing it as a new one.
			mChannel = a.OldImportChannel(&newChannel, sChannel, users)
			if mChannel == nil {
				mlog.Warn("Slack Import: Unable to import Slack channel.", mlog.String("channel_display_name", newChannel.DisplayName))
				importerLog.WriteString(utils.T("api.slackimport.slack_add_channels.import_failed", map[string]interface{}{"DisplayName": newChannel.DisplayName}))
				continue
			}
		}

		// Members for direct and group channels are added during the creation of the channel in the OldImportChannel function
		if sChannel.Type == model.CHANNEL_OPEN || sChannel.Type == model.CHANNEL_PRIVATE {
			a.addSlackUsersToChannel(sChannel.Members, users, mChannel, importerLog)
		}
		importerLog.WriteString(newChannel.DisplayName + "\r\n")
		addedChannels[sChannel.Id] = mChannel
		a.SlackAddPosts(teamId, mChannel, posts[sChannel.Name], users, uploads, botUser)
	}

	return addedChannels
}

func SlackConvertUserMentions(users []SlackUser, posts map[string][]SlackPost) map[string][]SlackPost {
	var regexes = make(map[string]*regexp.Regexp, len(users))
	for _, user := range users {
		r, err := regexp.Compile("<@" + user.Id + `(\|` + user.Username + ")?>")
		if err != nil {
			mlog.Warn("Slack Import: Unable to compile the @mention, matching regular expression for the Slack user.", mlog.String("user_name", user.Username), mlog.String("user_id", user.Id))
			continue
		}
		regexes["@"+user.Username] = r
	}

	// Special cases.
	regexes["@here"], _ = regexp.Compile(`<!here\|@here>`)
	regexes["@channel"], _ = regexp.Compile("<!channel>")
	regexes["@all"], _ = regexp.Compile("<!everyone>")

	for channelName, channelPosts := range posts {
		for postIdx, post := range channelPosts {
			for mention, r := range regexes {
				post.Text = r.ReplaceAllString(post.Text, mention)
				posts[channelName][postIdx] = post
			}
		}
	}

	return posts
}

func SlackConvertChannelMentions(channels []SlackChannel, posts map[string][]SlackPost) map[string][]SlackPost {
	var regexes = make(map[string]*regexp.Regexp, len(channels))
	for _, channel := range channels {
		r, err := regexp.Compile("<#" + channel.Id + `(\|` + channel.Name + ")?>")
		if err != nil {
			mlog.Warn("Slack Import: Unable to compile the !channel, matching regular expression for the Slack channel.", mlog.String("channel_id", channel.Id), mlog.String("channel_name", channel.Name))
			continue
		}
		regexes["~"+channel.Name] = r
	}

	for channelName, channelPosts := range posts {
		for postIdx, post := range channelPosts {
			for channelReplace, r := range regexes {
				post.Text = r.ReplaceAllString(post.Text, channelReplace)
				posts[channelName][postIdx] = post
			}
		}
	}

	return posts
}

func SlackConvertPostsMarkup(posts map[string][]SlackPost) map[string][]SlackPost {
	regexReplaceAllString := []struct {
		regex *regexp.Regexp
		rpl   string
	}{
		// URL
		{
			regexp.MustCompile(`<([^|<>]+)\|([^|<>]+)>`),
			"[$2]($1)",
		},
		// bold
		{
			regexp.MustCompile(`(^|[\s.;,])\*(\S[^*\n]+)\*`),
			"$1**$2**",
		},
		// strikethrough
		{
			regexp.MustCompile(`(^|[\s.;,])\~(\S[^~\n]+)\~`),
			"$1~~$2~~",
		},
		// single paragraph blockquote
		// Slack converts > character to &gt;
		{
			regexp.MustCompile(`(?sm)^&gt;`),
			">",
		},
	}

	regexReplaceAllStringFunc := []struct {
		regex *regexp.Regexp
		fn    func(string) string
	}{
		// multiple paragraphs blockquotes
		{
			regexp.MustCompile(`(?sm)^>&gt;&gt;(.+)$`),
			func(src string) string {
				// remove >>> prefix, might have leading \n
				prefixRegexp := regexp.MustCompile(`^([\n])?>&gt;&gt;(.*)`)
				src = prefixRegexp.ReplaceAllString(src, "$1$2")
				// append > to start of line
				appendRegexp := regexp.MustCompile(`(?m)^`)
				return appendRegexp.ReplaceAllString(src, ">$0")
			},
		},
	}

	for channelName, channelPosts := range posts {
		for postIdx, post := range channelPosts {
			result := post.Text

			for _, rule := range regexReplaceAllString {
				result = rule.regex.ReplaceAllString(result, rule.rpl)
			}

			for _, rule := range regexReplaceAllStringFunc {
				result = rule.regex.ReplaceAllStringFunc(result, rule.fn)
			}
			posts[channelName][postIdx].Text = result
		}
	}

	return posts
}

func (a *App) SlackImport(fileData multipart.File, fileSize int64, teamID string) (*model.AppError, *bytes.Buffer) {
	// Create log file
	log := bytes.NewBufferString(utils.T("api.slackimport.slack_import.log"))

	zipreader, err := zip.NewReader(fileData, fileSize)
	if err != nil || zipreader.File == nil {
		log.WriteString(utils.T("api.slackimport.slack_import.zip.app_error"))
		return model.NewAppError("SlackImport", "api.slackimport.slack_import.zip.app_error", nil, err.Error(), http.StatusBadRequest), log
	}

	var channels []SlackChannel
	var publicChannels []SlackChannel
	var privateChannels []SlackChannel
	var groupChannels []SlackChannel
	var directChannels []SlackChannel

	var users []SlackUser
	posts := make(map[string][]SlackPost)
	uploads := make(map[string]*zip.File)
	for _, file := range zipreader.File {
		if file.UncompressedSize64 > SLACK_IMPORT_MAX_FILE_SIZE {
			log.WriteString(utils.T("api.slackimport.slack_import.zip.file_too_large", map[string]interface{}{"Filename": file.Name}))
			continue
		}
		reader, err := file.Open()
		if err != nil {
			log.WriteString(utils.T("api.slackimport.slack_import.open.app_error", map[string]interface{}{"Filename": file.Name}))
			return model.NewAppError("SlackImport", "api.slackimport.slack_import.open.app_error", map[string]interface{}{"Filename": file.Name}, err.Error(), http.StatusInternalServerError), log
		}
		if file.Name == "channels.json" {
			publicChannels, _ = SlackParseChannels(reader, model.CHANNEL_OPEN)
			channels = append(channels, publicChannels...)
		} else if file.Name == "dms.json" {
			directChannels, _ = SlackParseChannels(reader, model.CHANNEL_DIRECT)
			channels = append(channels, directChannels...)
		} else if file.Name == "groups.json" {
			privateChannels, _ = SlackParseChannels(reader, model.CHANNEL_PRIVATE)
			channels = append(channels, privateChannels...)
		} else if file.Name == "mpims.json" {
			groupChannels, _ = SlackParseChannels(reader, model.CHANNEL_GROUP)
			channels = append(channels, groupChannels...)
		} else if file.Name == "users.json" {
			users, _ = SlackParseUsers(reader)
		} else {
			spl := strings.Split(file.Name, "/")
			if len(spl) == 2 && strings.HasSuffix(spl[1], ".json") {
				newposts, _ := SlackParsePosts(reader)
				channel := spl[0]
				if _, ok := posts[channel]; !ok {
					posts[channel] = newposts
				} else {
					posts[channel] = append(posts[channel], newposts...)
				}
			} else if len(spl) == 3 && spl[0] == "__uploads" {
				uploads[spl[1]] = file
			}
		}
	}

	posts = SlackConvertUserMentions(users, posts)
	posts = SlackConvertChannelMentions(channels, posts)
	posts = SlackConvertPostsMarkup(posts)

	addedUsers := a.SlackAddUsers(teamID, users, log)
	botUser := a.SlackAddBotUser(teamID, log)

	a.SlackAddChannels(teamID, channels, posts, addedUsers, uploads, botUser, log)

	if botUser != nil {
		a.deactivateSlackBotUser(botUser)
	}

	a.InvalidateAllCaches()

	log.WriteString(utils.T("api.slackimport.slack_import.notes"))
	log.WriteString("=======\r\n\r\n")

	log.WriteString(utils.T("api.slackimport.slack_import.note1"))
	log.WriteString(utils.T("api.slackimport.slack_import.note2"))
	log.WriteString(utils.T("api.slackimport.slack_import.note3"))

	return nil, log
}

//
// -- Old SlackImport Functions --
// Import functions are suitable for entering posts and users into the database without
// some of the usual checks. (IsValid is still run)
//

func (a *App) OldImportPost(post *model.Post) string {
	// Workaround for empty messages, which may be the case if they are webhook posts.
	firstIteration := true
	firstPostId := ""
	if post.ParentId != "" {
		firstPostId = post.ParentId
	}
	maxPostSize := a.MaxPostSize()
	for messageRuneCount := utf8.RuneCountInString(post.Message); messageRuneCount > 0 || firstIteration; messageRuneCount = utf8.RuneCountInString(post.Message) {
		var remainder string
		if messageRuneCount > maxPostSize {
			remainder = string(([]rune(post.Message))[maxPostSize:])
			post.Message = truncateRunes(post.Message, maxPostSize)
		} else {
			remainder = ""
		}

		post.Hashtags, _ = model.ParseHashtags(post.Message)

		post.RootId = firstPostId
		post.ParentId = firstPostId

		_, err := a.Srv.Store.Post().Save(post)
		if err != nil {
			mlog.Debug("Error saving post.", mlog.String("user_id", post.UserId), mlog.String("message", post.Message))
		}

		if firstIteration {
			if firstPostId == "" {
				firstPostId = post.Id
			}
			for _, fileId := range post.FileIds {
				if err := a.Srv.Store.FileInfo().AttachToPost(fileId, post.Id, post.UserId); err != nil {
					mlog.Error(
						"Error attaching files to post.",
						mlog.String("post_id", post.Id),
						mlog.String("file_ids", strings.Join(post.FileIds, ",")),
						mlog.String("user_id", post.UserId),
						mlog.Err(err),
					)
				}
			}
			post.FileIds = nil
		}

		post.Id = ""
		post.CreateAt++
		post.Message = remainder
		firstIteration = false
	}
	return firstPostId
}

func (a *App) OldImportUser(team *model.Team, user *model.User) *model.User {
	user.MakeNonNil()

	user.Roles = model.SYSTEM_USER_ROLE_ID

	ruser, err := a.Srv.Store.User().Save(user)
	if err != nil {
		mlog.Error("Error saving user.", mlog.Err(err))
		return nil
	}

	if _, err = a.Srv.Store.User().VerifyEmail(ruser.Id, ruser.Email); err != nil {
		mlog.Error("Failed to set email verified.", mlog.Err(err))
	}

	if err = a.JoinUserToTeam(team, user, ""); err != nil {
		mlog.Error("Failed to join team when importing.", mlog.Err(err))
	}

	return ruser
}

func (a *App) OldImportChannel(channel *model.Channel, sChannel SlackChannel, users map[string]*model.User) *model.Channel {
	if channel.Type == model.CHANNEL_DIRECT {
		sc, err := a.createDirectChannel(users[sChannel.Members[0]].Id, users[sChannel.Members[1]].Id)
		if err != nil {
			return nil
		}

		return sc
	}

	// check if direct channel has less than 8 members and if not import as private channel instead
	if channel.Type == model.CHANNEL_GROUP && len(sChannel.Members) < 8 {
		members := make([]string, len(sChannel.Members))

		for i := range sChannel.Members {
			members[i] = users[sChannel.Members[i]].Id
		}

		sc, err := a.createGroupChannel(members, users[sChannel.Creator].Id)
		if err != nil {
			return nil
		}

		return sc
	} else if channel.Type == model.CHANNEL_GROUP {
		channel.Type = model.CHANNEL_PRIVATE
		sc, err := a.CreateChannel(channel, false)
		if err != nil {
			return nil
		}

		return sc
	}

	sc, err := a.Srv.Store.Channel().Save(channel, *a.Config().TeamSettings.MaxChannelsPerTeam)
	if err != nil {
		return nil
	}

	return sc
}

func (a *App) OldImportFile(timestamp time.Time, file io.Reader, teamId string, channelId string, userId string, fileName string) (*model.FileInfo, error) {
	buf := bytes.NewBuffer(nil)
	io.Copy(buf, file)
	data := buf.Bytes()

	fileInfo, err := a.DoUploadFile(timestamp, teamId, channelId, userId, fileName, data)
	if err != nil {
		return nil, err
	}

	if fileInfo.IsImage() && fileInfo.MimeType != "image/svg+xml" {
		img, width, height := prepareImage(data)
		if img != nil {
			a.generateThumbnailImage(img, fileInfo.ThumbnailPath, width, height)
			a.generatePreviewImage(img, fileInfo.PreviewPath, width)
		}
	}

	return fileInfo, nil
}

func (a *App) OldImportIncomingWebhookPost(post *model.Post, props model.StringInterface) string {
	linkWithTextRegex := regexp.MustCompile(`<([^<\|]+)\|([^>]+)>`)
	post.Message = linkWithTextRegex.ReplaceAllString(post.Message, "[${2}](${1})")

	post.AddProp("from_webhook", "true")

	if _, ok := props["override_username"]; !ok {
		post.AddProp("override_username", model.DEFAULT_WEBHOOK_USERNAME)
	}

	if len(props) > 0 {
		for key, val := range props {
			if key == "attachments" {
				if attachments, success := val.([]*model.SlackAttachment); success {
					model.ParseSlackAttachment(post, attachments)
				}
			} else if key != "from_webhook" {
				post.AddProp(key, val)
			}
		}
	}

	return a.OldImportPost(post)
}
