// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"io"
	"mime/multipart"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

type SlackChannel struct {
	Id      string            `json:"id"`
	Name    string            `json:"name"`
	Members []string          `json:"members"`
	Topic   map[string]string `json:"topic"`
	Purpose map[string]string `json:"purpose"`
}

type SlackUser struct {
	Id       string            `json:"id"`
	Username string            `json:"name"`
	Profile  map[string]string `json:"profile"`
}

type SlackFile struct {
	Id    string `json:"id"`
	Title string `json:"title"`
}

type SlackPost struct {
	User        string            `json:"user"`
	BotId       string            `json:"bot_id"`
	BotUsername string            `json:"username"`
	Text        string            `json:"text"`
	TimeStamp   string            `json:"ts"`
	Type        string            `json:"type"`
	SubType     string            `json:"subtype"`
	Comment     *SlackComment     `json:"comment"`
	Upload      bool              `json:"upload"`
	File        *SlackFile        `json:"file"`
	Attachments []SlackAttachment `json:"attachments"`
}

type SlackComment struct {
	User    string `json:"user"`
	Comment string `json:"comment"`
}

type SlackAttachment struct {
	Id      int                      `json:"id"`
	Text    string                   `json:"text"`
	Pretext string                   `json:"pretext"`
	Fields  []map[string]interface{} `json:"fields"`
}

func SlackConvertTimeStamp(ts string) int64 {
	timeString := strings.SplitN(ts, ".", 2)[0]

	timeStamp, err := strconv.ParseInt(timeString, 10, 64)
	if err != nil {
		l4g.Warn(utils.T("api.slackimport.slack_convert_timestamp.bad.warn"))
		return 1
	}
	return timeStamp * 1000 // Convert to milliseconds
}

func SlackConvertChannelName(channelName string) string {
	newName := strings.Trim(channelName, "_-")
	if len(newName) == 1 {
		return "slack-channel-" + newName
	}

	return newName
}

func SlackParseChannels(data io.Reader) ([]SlackChannel, error) {
	decoder := json.NewDecoder(data)

	var channels []SlackChannel
	if err := decoder.Decode(&channels); err != nil {
		l4g.Warn(utils.T("api.slackimport.slack_parse_channels.error"))
		return channels, err
	}
	return channels, nil
}

func SlackParseUsers(data io.Reader) ([]SlackUser, error) {
	decoder := json.NewDecoder(data)

	var users []SlackUser
	if err := decoder.Decode(&users); err != nil {
		// This actually returns errors that are ignored.
		// In this case it is erroring because of a null that Slack
		// introduced. So we just return the users here.
		return users, err
	}
	return users, nil
}

func SlackParsePosts(data io.Reader) ([]SlackPost, error) {
	decoder := json.NewDecoder(data)

	var posts []SlackPost
	if err := decoder.Decode(&posts); err != nil {
		l4g.Warn(utils.T("api.slackimport.slack_parse_posts.error"))
		return posts, err
	}
	return posts, nil
}

func SlackAddUsers(teamId string, slackusers []SlackUser, log *bytes.Buffer) map[string]*model.User {
	// Log header
	log.WriteString(utils.T("api.slackimport.slack_add_users.created"))
	log.WriteString("===============\r\n\r\n")

	addedUsers := make(map[string]*model.User)

	// Need the team
	var team *model.Team
	if result := <-Srv.Store.Team().Get(teamId); result.Err != nil {
		log.WriteString(utils.T("api.slackimport.slack_import.team_fail"))
		return addedUsers
	} else {
		team = result.Data.(*model.Team)
	}

	for _, sUser := range slackusers {
		firstName := ""
		lastName := ""
		if name, ok := sUser.Profile["first_name"]; ok {
			firstName = name
		}
		if name, ok := sUser.Profile["last_name"]; ok {
			lastName = name
		}

		email := sUser.Profile["email"]

		password := model.NewId()

		// Check for email conflict and use existing user if found
		if result := <-Srv.Store.User().GetByEmail(email); result.Err == nil {
			existingUser := result.Data.(*model.User)
			addedUsers[sUser.Id] = existingUser
			log.WriteString(utils.T("api.slackimport.slack_add_users.merge_existing", map[string]interface{}{"Email": existingUser.Email, "Username": existingUser.Username}))
			continue
		}

		newUser := model.User{
			Username:  sUser.Username,
			FirstName: firstName,
			LastName:  lastName,
			Email:     email,
			Password:  password,
		}

		if mUser := ImportUser(team, &newUser); mUser != nil {
			addedUsers[sUser.Id] = mUser
			log.WriteString(utils.T("api.slackimport.slack_add_users.email_pwd", map[string]interface{}{"Email": newUser.Email, "Password": password}))
		} else {
			log.WriteString(utils.T("api.slackimport.slack_add_users.unable_import", map[string]interface{}{"Username": sUser.Username}))
		}
	}

	return addedUsers
}

func SlackAddBotUser(teamId string, log *bytes.Buffer) *model.User {
	var team *model.Team
	if result := <-Srv.Store.Team().Get(teamId); result.Err != nil {
		log.WriteString(utils.T("api.slackimport.slack_import.team_fail"))
		return nil
	} else {
		team = result.Data.(*model.Team)
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

	if mUser := ImportUser(team, &botUser); mUser != nil {
		log.WriteString(utils.T("api.slackimport.slack_add_bot_user.email_pwd", map[string]interface{}{"Email": botUser.Email, "Password": password}))
		return mUser
	} else {
		log.WriteString(utils.T("api.slackimport.slack_add_bot_user.unable_import", map[string]interface{}{"Username": username}))
		return nil
	}
}

func SlackAddPosts(teamId string, channel *model.Channel, posts []SlackPost, users map[string]*model.User, uploads map[string]*zip.File, botUser *model.User) {
	for _, sPost := range posts {
		switch {
		case sPost.Type == "message" && (sPost.SubType == "" || sPost.SubType == "file_share"):
			if sPost.User == "" {
				l4g.Debug(utils.T("api.slackimport.slack_add_posts.without_user.debug"))
				continue
			} else if users[sPost.User] == nil {
				l4g.Debug(utils.T("api.slackimport.slack_add_posts.user_no_exists.debug"), sPost.User)
				continue
			}
			newPost := model.Post{
				UserId:    users[sPost.User].Id,
				ChannelId: channel.Id,
				Message:   sPost.Text,
				CreateAt:  SlackConvertTimeStamp(sPost.TimeStamp),
			}
			if sPost.Upload {
				if fileInfo, ok := SlackUploadFile(sPost, uploads, teamId, newPost.ChannelId, newPost.UserId); ok == true {
					newPost.FileIds = append(newPost.FileIds, fileInfo.Id)
					newPost.Message = sPost.File.Title
				}
			}
			ImportPost(&newPost)
			for _, fileId := range newPost.FileIds {
				if result := <-Srv.Store.FileInfo().AttachToPost(fileId, newPost.Id); result.Err != nil {
					l4g.Error(utils.T("api.slackimport.slack_add_posts.attach_files.error"), newPost.Id, newPost.FileIds, result.Err)
				}
			}

		case sPost.Type == "message" && sPost.SubType == "file_comment":
			if sPost.Comment == nil {
				l4g.Debug(utils.T("api.slackimport.slack_add_posts.msg_no_comment.debug"))
				continue
			} else if sPost.Comment.User == "" {
				l4g.Debug(utils.T("api.slackimport.slack_add_posts.msg_no_usr.debug"))
				continue
			} else if users[sPost.Comment.User] == nil {
				l4g.Debug(utils.T("api.slackimport.slack_add_posts.user_no_exists.debug"), sPost.User)
				continue
			}
			newPost := model.Post{
				UserId:    users[sPost.Comment.User].Id,
				ChannelId: channel.Id,
				Message:   sPost.Comment.Comment,
				CreateAt:  SlackConvertTimeStamp(sPost.TimeStamp),
			}
			ImportPost(&newPost)
		case sPost.Type == "message" && sPost.SubType == "bot_message":
			if botUser == nil {
				l4g.Warn(utils.T("api.slackimport.slack_add_posts.bot_user_no_exists.warn"))
				continue
			} else if sPost.BotId == "" {
				l4g.Warn(utils.T("api.slackimport.slack_add_posts.no_bot_id.warn"))
				continue
			}

			props := make(model.StringInterface)
			props["override_username"] = sPost.BotUsername
			if len(sPost.Attachments) > 0 {
				var mAttachments []interface{}
				for _, attachment := range sPost.Attachments {
					mAttachments = append(mAttachments, map[string]interface{}{
						"text":    attachment.Text,
						"pretext": attachment.Pretext,
						"fields":  attachment.Fields,
					})
				}
				props["attachments"] = mAttachments
			}

			post := &model.Post{
				UserId:    botUser.Id,
				ChannelId: channel.Id,
				CreateAt:  SlackConvertTimeStamp(sPost.TimeStamp),
				Message:   sPost.Text,
				Type:      model.POST_SLACK_ATTACHMENT,
			}

			ImportIncomingWebhookPost(post, props)
		case sPost.Type == "message" && (sPost.SubType == "channel_join" || sPost.SubType == "channel_leave"):
			if sPost.User == "" {
				l4g.Debug(utils.T("api.slackimport.slack_add_posts.msg_no_usr.debug"))
				continue
			} else if users[sPost.User] == nil {
				l4g.Debug(utils.T("api.slackimport.slack_add_posts.user_no_exists.debug"), sPost.User)
				continue
			}
			newPost := model.Post{
				UserId:    users[sPost.User].Id,
				ChannelId: channel.Id,
				Message:   sPost.Text,
				CreateAt:  SlackConvertTimeStamp(sPost.TimeStamp),
				Type:      model.POST_JOIN_LEAVE,
			}
			ImportPost(&newPost)
		case sPost.Type == "message" && sPost.SubType == "me_message":
			if sPost.User == "" {
				l4g.Debug(utils.T("api.slackimport.slack_add_posts.without_user.debug"))
				continue
			} else if users[sPost.User] == nil {
				l4g.Debug(utils.T("api.slackimport.slack_add_posts.user_no_exists.debug"), sPost.User)
				continue
			}
			newPost := model.Post{
				UserId:    users[sPost.User].Id,
				ChannelId: channel.Id,
				Message:   "*" + sPost.Text + "*",
				CreateAt:  SlackConvertTimeStamp(sPost.TimeStamp),
			}
			ImportPost(&newPost)
		default:
			l4g.Warn(utils.T("api.slackimport.slack_add_posts.unsupported.warn"), sPost.Type, sPost.SubType)
		}
	}
}

func SlackUploadFile(sPost SlackPost, uploads map[string]*zip.File, teamId string, channelId string, userId string) (*model.FileInfo, bool) {
	if sPost.File != nil {
		if file, ok := uploads[sPost.File.Id]; ok == true {
			openFile, err := file.Open()
			if err != nil {
				l4g.Warn(utils.T("api.slackimport.slack_add_posts.upload_file_open_failed.warn", map[string]interface{}{"FileId": sPost.File.Id, "Error": err.Error()}))
				return nil, false
			}
			defer openFile.Close()

			uploadedFile, err := ImportFile(openFile, teamId, channelId, userId, filepath.Base(file.Name))
			if err != nil {
				l4g.Warn(utils.T("api.slackimport.slack_add_posts.upload_file_upload_failed.warn", map[string]interface{}{"FileId": sPost.File.Id, "Error": err.Error()}))
				return nil, false
			}

			return uploadedFile, true
		} else {
			l4g.Warn(utils.T("api.slackimport.slack_add_posts.upload_file_not_found.warn", map[string]interface{}{"FileId": sPost.File.Id}))
			return nil, false
		}
	} else {
		l4g.Warn(utils.T("api.slackimport.slack_add_posts.upload_file_not_in_json.warn"))
		return nil, false
	}
}

func deactivateSlackBotUser(user *model.User) {
	_, err := UpdateActive(user, false)
	if err != nil {
		l4g.Warn(utils.T("api.slackimport.slack_deactivate_bot_user.failed_to_deactivate", err))
	}
}

func addSlackUsersToChannel(members []string, users map[string]*model.User, channel *model.Channel, log *bytes.Buffer) {
	for _, member := range members {
		if user, ok := users[member]; !ok {
			log.WriteString(utils.T("api.slackimport.slack_add_channels.failed_to_add_user", map[string]interface{}{"Username": "?"}))
		} else {
			if _, err := AddUserToChannel(user, channel); err != nil {
				log.WriteString(utils.T("api.slackimport.slack_add_channels.failed_to_add_user", map[string]interface{}{"Username": user.Username}))
			}
		}
	}
}

func SlackAddChannels(teamId string, slackchannels []SlackChannel, posts map[string][]SlackPost, users map[string]*model.User, uploads map[string]*zip.File, botUser *model.User, log *bytes.Buffer) map[string]*model.Channel {
	// Write Header
	log.WriteString(utils.T("api.slackimport.slack_add_channels.added"))
	log.WriteString("=================\r\n\r\n")

	addedChannels := make(map[string]*model.Channel)
	for _, sChannel := range slackchannels {
		newChannel := model.Channel{
			TeamId:      teamId,
			Type:        model.CHANNEL_OPEN,
			DisplayName: sChannel.Name,
			Name:        SlackConvertChannelName(sChannel.Name),
			Purpose:     sChannel.Purpose["value"],
			Header:      sChannel.Topic["value"],
		}
		mChannel := ImportChannel(&newChannel)
		if mChannel == nil {
			// Maybe it already exists?
			if result := <-Srv.Store.Channel().GetByName(teamId, sChannel.Name); result.Err != nil {
				l4g.Warn(utils.T("api.slackimport.slack_add_channels.import_failed.warn"), newChannel.DisplayName)
				log.WriteString(utils.T("api.slackimport.slack_add_channels.import_failed", map[string]interface{}{"DisplayName": newChannel.DisplayName}))
				continue
			} else {
				mChannel = result.Data.(*model.Channel)
				log.WriteString(utils.T("api.slackimport.slack_add_channels.merge", map[string]interface{}{"DisplayName": newChannel.DisplayName}))
			}
		}
		addSlackUsersToChannel(sChannel.Members, users, mChannel, log)
		log.WriteString(newChannel.DisplayName + "\r\n")
		addedChannels[sChannel.Id] = mChannel
		SlackAddPosts(teamId, mChannel, posts[sChannel.Name], users, uploads, botUser)
	}

	return addedChannels
}

func SlackConvertUserMentions(users []SlackUser, posts map[string][]SlackPost) map[string][]SlackPost {
	var regexes = make(map[string]*regexp.Regexp, len(users))
	for _, user := range users {
		r, err := regexp.Compile("<@" + user.Id + `(\|` + user.Username + ")?>")
		if err != nil {
			l4g.Warn(utils.T("api.slackimport.slack_convert_user_mentions.compile_regexp_failed.warn"), user.Id, user.Username)
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
			l4g.Warn(utils.T("api.slackimport.slack_convert_channel_mentions.compile_regexp_failed.warn"), channel.Id, channel.Name)
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

func SlackImport(fileData multipart.File, fileSize int64, teamID string) (*model.AppError, *bytes.Buffer) {
	// Create log file
	log := bytes.NewBufferString(utils.T("api.slackimport.slack_import.log"))

	zipreader, err := zip.NewReader(fileData, fileSize)
	if err != nil || zipreader.File == nil {
		log.WriteString(utils.T("api.slackimport.slack_import.zip.app_error"))
		return model.NewLocAppError("SlackImport", "api.slackimport.slack_import.zip.app_error", nil, err.Error()), log
	}

	var channels []SlackChannel
	var users []SlackUser
	posts := make(map[string][]SlackPost)
	uploads := make(map[string]*zip.File)
	for _, file := range zipreader.File {
		reader, err := file.Open()
		if err != nil {
			log.WriteString(utils.T("api.slackimport.slack_import.open.app_error", map[string]interface{}{"Filename": file.Name}))
			return model.NewLocAppError("SlackImport", "api.slackimport.slack_import.open.app_error", map[string]interface{}{"Filename": file.Name}, err.Error()), log
		}
		if file.Name == "channels.json" {
			channels, _ = SlackParseChannels(reader)
		} else if file.Name == "users.json" {
			users, _ = SlackParseUsers(reader)
		} else {
			spl := strings.Split(file.Name, "/")
			if len(spl) == 2 && strings.HasSuffix(spl[1], ".json") {
				newposts, _ := SlackParsePosts(reader)
				channel := spl[0]
				if _, ok := posts[channel]; ok == false {
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

	addedUsers := SlackAddUsers(teamID, users, log)
	botUser := SlackAddBotUser(teamID, log)

	SlackAddChannels(teamID, channels, posts, addedUsers, uploads, botUser, log)

	if botUser != nil {
		deactivateSlackBotUser(botUser)
	}

	log.WriteString(utils.T("api.slackimport.slack_import.notes"))
	log.WriteString("=======\r\n\r\n")

	log.WriteString(utils.T("api.slackimport.slack_import.note1"))
	log.WriteString(utils.T("api.slackimport.slack_import.note2"))
	log.WriteString(utils.T("api.slackimport.slack_import.note3"))

	return nil, log
}
