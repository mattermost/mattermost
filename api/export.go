// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"archive/zip"
	"encoding/json"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"io"
	"os"
)

const (
	EXPORT_PATH                   = "export/"
	EXPORT_FILENAME               = "MattermostExport.zip"
	EXPORT_OPTIONS_FILE           = "options.json"
	EXPORT_TEAMS_FOLDER           = "teams"
	EXPORT_CHANNELS_FOLDER        = "channels"
	EXPORT_CHANNEL_MEMBERS_FOLDER = "members"
	EXPORT_POSTS_FOLDER           = "posts"
	EXPORT_USERS_FOLDER           = "users"
	EXPORT_LOCAL_STORAGE_FOLDER   = "files"
)

type ExportWriter interface {
	Create(name string) (io.Writer, error)
}

type ExportOptions struct {
	TeamsToExport      []string `json:"teams"`
	ChannelsToExport   []string `json:"channels"`
	UsersToExport      []string `json:"users"`
	ExportLocalStorage bool     `json:"export_local_storage"`
}

func (options *ExportOptions) ToJson() string {
	b, err := json.Marshal(options)
	if err != nil {
		return ""
	} else {
		return string(b)
	}
}

func ExportOptionsFromJson(data io.Reader) *ExportOptions {
	decoder := json.NewDecoder(data)
	var o ExportOptions
	decoder.Decode(&o)
	return &o
}

func ExportToFile(options *ExportOptions) (link string, err *model.AppError) {
	// Open file for export
	if file, err := openFileWriteStream(EXPORT_PATH + EXPORT_FILENAME); err != nil {
		return "", err
	} else {
		defer closeFileWriteStream(file)
		ExportToWriter(file, options)
	}

	return "/api/v1/files/get_export", nil
}

func ExportToWriter(w io.Writer, options *ExportOptions) *model.AppError {
	// Open a writer to write to zip file
	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

	// Write our options to file
	if optionsFile, err := zipWriter.Create(EXPORT_OPTIONS_FILE); err != nil {
		return model.NewAppError("ExportToWriter", "Unable to create options file", err.Error())
	} else {
		if _, err := optionsFile.Write([]byte(options.ToJson())); err != nil {
			return model.NewAppError("ExportToWriter", "Unable to write to options file", err.Error())
		}
	}

	// Export Teams
	ExportTeams(zipWriter, options)

	return nil
}

func ExportTeams(writer ExportWriter, options *ExportOptions) *model.AppError {
	// Get the teams
	var teams []*model.Team
	if len(options.TeamsToExport) == 0 {
		if result := <-Srv.Store.Team().GetAll(); result.Err != nil {
			return result.Err
		} else {
			teams = result.Data.([]*model.Team)
		}
	} else {
		for _, teamId := range options.TeamsToExport {
			if result := <-Srv.Store.Team().Get(teamId); result.Err != nil {
				return result.Err
			} else {
				team := result.Data.(*model.Team)
				teams = append(teams, team)
			}
		}
	}

	// Export the teams
	for i := range teams {
		// Sanitize
		teams[i].PreExport()

		if teamFile, err := writer.Create(EXPORT_TEAMS_FOLDER + "/" + teams[i].Name + ".json"); err != nil {
			return model.NewAppError("ExportTeams", "Unable to open file for export", err.Error())
		} else {
			if _, err := teamFile.Write([]byte(teams[i].ToJson())); err != nil {
				return model.NewAppError("ExportTeams", "Unable to write to team export file", err.Error())
			}
		}

	}

	// Export the channels, local storage and users
	for _, team := range teams {
		if err := ExportChannels(writer, options, team.Id); err != nil {
			return err
		}
		if err := ExportUsers(writer, options, team.Id); err != nil {
			return err
		}
		if err := ExportLocalStorage(writer, options, team.Id); err != nil {
			return err
		}
	}

	return nil
}

func ExportChannels(writer ExportWriter, options *ExportOptions, teamId string) *model.AppError {
	// Get the channels
	var channels []*model.Channel
	if len(options.ChannelsToExport) == 0 {
		if result := <-Srv.Store.Channel().GetForExport(teamId); result.Err != nil {
			return result.Err
		} else {
			channels = result.Data.([]*model.Channel)
		}
	} else {
		for _, channelId := range options.ChannelsToExport {
			if result := <-Srv.Store.Channel().Get(channelId); result.Err != nil {
				return result.Err
			} else {
				channel := result.Data.(*model.Channel)
				channels = append(channels, channel)
			}
		}
	}

	for i := range channels {
		// Get members
		mchan := Srv.Store.Channel().GetMembers(channels[i].Id)

		// Sanitize
		channels[i].PreExport()

		if channelFile, err := writer.Create(EXPORT_CHANNELS_FOLDER + "/" + channels[i].Id + ".json"); err != nil {
			return model.NewAppError("ExportChannels", "Unable to open file for export", err.Error())
		} else {
			if _, err := channelFile.Write([]byte(channels[i].ToJson())); err != nil {
				return model.NewAppError("ExportChannels", "Unable to write to export file", err.Error())
			}
		}

		var members []model.ChannelMember
		if result := <-mchan; result.Err != nil {
			return result.Err
		} else {
			members = result.Data.([]model.ChannelMember)
		}

		if membersFile, err := writer.Create(EXPORT_CHANNELS_FOLDER + "/" + channels[i].Id + "_members.json"); err != nil {
			return model.NewAppError("ExportChannels", "Unable to open file for export", err.Error())
		} else {
			result, err2 := json.Marshal(members)
			if err2 != nil {
				return model.NewAppError("ExportChannels", "Unable to convert to json", err.Error())
			}
			if _, err3 := membersFile.Write([]byte(result)); err3 != nil {
				return model.NewAppError("ExportChannels", "Unable to write to export file", err.Error())
			}
		}
	}

	for _, channel := range channels {
		if err := ExportPosts(writer, options, channel.Id); err != nil {
			return err
		}
	}

	return nil
}

func ExportPosts(writer ExportWriter, options *ExportOptions, channelId string) *model.AppError {
	// Get the posts
	var posts []*model.Post
	if result := <-Srv.Store.Post().GetForExport(channelId); result.Err != nil {
		return result.Err
	} else {
		posts = result.Data.([]*model.Post)
	}

	// Export the posts
	if postsFile, err := writer.Create(EXPORT_POSTS_FOLDER + "/" + channelId + "_posts.json"); err != nil {
		return model.NewAppError("ExportPosts", "Unable to open file for export", err.Error())
	} else {
		result, err2 := json.Marshal(posts)
		if err2 != nil {
			return model.NewAppError("ExportPosts", "Unable to convert to json", err.Error())
		}
		if _, err3 := postsFile.Write([]byte(result)); err3 != nil {
			return model.NewAppError("ExportPosts", "Unable to write to export file", err.Error())
		}
	}

	return nil
}

func ExportUsers(writer ExportWriter, options *ExportOptions, teamId string) *model.AppError {
	// Get the users
	var users []*model.User
	if result := <-Srv.Store.User().GetForExport(teamId); result.Err != nil {
		return result.Err
	} else {
		users = result.Data.([]*model.User)
	}

	// Write the users
	if usersFile, err := writer.Create(EXPORT_USERS_FOLDER + "/" + teamId + "_users.json"); err != nil {
		return model.NewAppError("ExportUsers", "Unable to open file for export", err.Error())
	} else {
		result, err2 := json.Marshal(users)
		if err2 != nil {
			return model.NewAppError("ExportUsers", "Unable to convert to json", err.Error())
		}
		if _, err3 := usersFile.Write([]byte(result)); err3 != nil {
			return model.NewAppError("ExportUsers", "Unable to write to export file", err.Error())
		}
	}
	return nil
}

func copyDirToExportWriter(writer ExportWriter, inPath string, outPath string) *model.AppError {
	dir, err := os.Open(inPath)
	if err != nil {
		return model.NewAppError("copyDirToExportWriter", "Unable to open directory", err.Error())
	}

	fileInfoList, err := dir.Readdir(0)
	if err != nil {
		return model.NewAppError("copyDirToExportWriter", "Unable to read directory", err.Error())
	}

	for _, fileInfo := range fileInfoList {
		if fileInfo.IsDir() {
			copyDirToExportWriter(writer, inPath+"/"+fileInfo.Name(), outPath+"/"+fileInfo.Name())
		} else {
			if toFile, err := writer.Create(outPath + "/" + fileInfo.Name()); err != nil {
				return model.NewAppError("copyDirToExportWriter", "Unable to open file for export", err.Error())
			} else {
				fromFile, err := os.Open(inPath + "/" + fileInfo.Name())
				if err != nil {
					return model.NewAppError("copyDirToExportWriter", "Unable to open file", err.Error())
				}
				io.Copy(toFile, fromFile)
			}
		}
	}

	return nil
}

func ExportLocalStorage(writer ExportWriter, options *ExportOptions, teamId string) *model.AppError {
	teamDir := utils.Cfg.FileSettings.Directory + "teams/" + teamId

	if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_S3 {
		return model.NewAppError("ExportLocalStorage", "S3 is not supported for local storage export.", "")
	} else if utils.Cfg.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		if err := copyDirToExportWriter(writer, teamDir, EXPORT_LOCAL_STORAGE_FOLDER); err != nil {
			return err
		}
	}

	return nil
}
