// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"

	l4g "code.google.com/p/log4go"

	"github.com/mattermost/platform/model"
)

const (
	MODE_DEV        = "dev"
	MODE_BETA       = "beta"
	MODE_PROD       = "prod"
	LOG_ROTATE_SIZE = 10000
)

var Cfg *model.Config = &model.Config{}
var CfgLastModified int64 = 0
var CfgFileName string = ""
var ClientProperties map[string]string = map[string]string{}
var SanitizeOptions map[string]bool = map[string]bool{}

func FindConfigFile(fileName string) string {
	if _, err := os.Stat("/tmp/" + fileName); err == nil {
		fileName, _ = filepath.Abs("/tmp/" + fileName)
	} else if _, err := os.Stat("./config/" + fileName); err == nil {
		fileName, _ = filepath.Abs("./config/" + fileName)
	} else if _, err := os.Stat("../config/" + fileName); err == nil {
		fileName, _ = filepath.Abs("../config/" + fileName)
	} else if _, err := os.Stat(fileName); err == nil {
		fileName, _ = filepath.Abs(fileName)
	}

	return fileName
}

func FindDir(dir string) string {
	fileName := "."
	if _, err := os.Stat("./" + dir + "/"); err == nil {
		fileName, _ = filepath.Abs("./" + dir + "/")
	} else if _, err := os.Stat("../" + dir + "/"); err == nil {
		fileName, _ = filepath.Abs("../" + dir + "/")
	} else if _, err := os.Stat("/tmp/" + dir); err == nil {
		fileName, _ = filepath.Abs("/tmp/" + dir)
	}

	return fileName + "/"
}

func ConfigureCmdLineLog() {
	ls := model.LogSettings{}
	ls.EnableConsole = true
	ls.ConsoleLevel = "ERROR"
	ls.EnableFile = false
	configureLog(&ls)
}

func configureLog(s *model.LogSettings) {

	l4g.Close()

	if s.EnableConsole {
		level := l4g.DEBUG
		if s.ConsoleLevel == "INFO" {
			level = l4g.INFO
		} else if s.ConsoleLevel == "ERROR" {
			level = l4g.ERROR
		}

		l4g.AddFilter("stdout", level, l4g.NewConsoleLogWriter())
	}

	if s.EnableFile {

		var fileFormat = s.FileFormat

		if fileFormat == "" {
			fileFormat = "[%D %T] [%L] %M"
		}

		level := l4g.DEBUG
		if s.FileLevel == "INFO" {
			level = l4g.INFO
		} else if s.FileLevel == "ERROR" {
			level = l4g.ERROR
		}

		flw := l4g.NewFileLogWriter(GetLogFileLocation(s.FileLocation), false)
		flw.SetFormat(fileFormat)
		flw.SetRotate(true)
		flw.SetRotateLines(LOG_ROTATE_SIZE)
		l4g.AddFilter("file", level, flw)
	}
}

func GetLogFileLocation(fileLocation string) string {
	if fileLocation == "" {
		return FindDir("logs") + "mattermost.log"
	} else {
		return fileLocation
	}
}

func SaveConfig(fileName string, config *model.Config) *model.AppError {
	b, err := json.MarshalIndent(config, "", "    ")
	if err != nil {
		return model.NewAppError("SaveConfig", "An error occurred while saving the file to "+fileName, err.Error())
	}

	err = ioutil.WriteFile(fileName, b, 0644)
	if err != nil {
		return model.NewAppError("SaveConfig", "An error occurred while saving the file to "+fileName, err.Error())
	}

	return nil
}

// LoadConfig will try to search around for the corresponding config file.
// It will search /tmp/fileName then attempt ./config/fileName,
// then ../config/fileName and last it will look at fileName
func LoadConfig(fileName string) {

	fileName = FindConfigFile(fileName)

	file, err := os.Open(fileName)
	if err != nil {
		panic("Error opening config file=" + fileName + ", err=" + err.Error())
	}

	decoder := json.NewDecoder(file)
	config := model.Config{}
	err = decoder.Decode(&config)
	if err != nil {
		panic("Error decoding config file=" + fileName + ", err=" + err.Error())
	}

	if info, err := file.Stat(); err != nil {
		panic("Error getting config info file=" + fileName + ", err=" + err.Error())
	} else {
		CfgLastModified = info.ModTime().Unix()
		CfgFileName = fileName
	}

	if err := config.IsValid(); err != nil {
		panic("Error validating config file=" + fileName + ", err=" + err.Message)
	}

	configureLog(&config.LogSettings)
	TestConnection(&config)

	Cfg = &config
	SanitizeOptions = getSanitizeOptions(Cfg)
	ClientProperties = getClientProperties(Cfg)
}

func getSanitizeOptions(c *model.Config) map[string]bool {
	options := map[string]bool{}
	options["fullname"] = c.PrivacySettings.ShowFullName
	options["email"] = c.PrivacySettings.ShowEmailAddress

	return options
}

func getClientProperties(c *model.Config) map[string]string {
	props := make(map[string]string)

	props["Version"] = model.CurrentVersion
	props["BuildNumber"] = model.BuildNumber
	props["BuildDate"] = model.BuildDate
	props["BuildHash"] = model.BuildHash

	props["SiteName"] = c.TeamSettings.SiteName
	props["EnableTeamCreation"] = strconv.FormatBool(c.TeamSettings.EnableTeamCreation)

	props["EnableOAuthServiceProvider"] = strconv.FormatBool(c.ServiceSettings.EnableOAuthServiceProvider)

	props["SegmentDeveloperKey"] = c.ServiceSettings.SegmentDeveloperKey
	props["GoogleDeveloperKey"] = c.ServiceSettings.GoogleDeveloperKey
	props["EnableIncomingWebhooks"] = strconv.FormatBool(c.ServiceSettings.EnableIncomingWebhooks)
	props["EnablePostUsernameOverride"] = strconv.FormatBool(c.ServiceSettings.EnablePostUsernameOverride)
	props["EnablePostIconOverride"] = strconv.FormatBool(c.ServiceSettings.EnablePostIconOverride)

	props["SendEmailNotifications"] = strconv.FormatBool(c.EmailSettings.SendEmailNotifications)
	props["EnableSignUpWithEmail"] = strconv.FormatBool(c.EmailSettings.EnableSignUpWithEmail)
	props["RequireEmailVerification"] = strconv.FormatBool(c.EmailSettings.RequireEmailVerification)
	props["FeedbackEmail"] = c.EmailSettings.FeedbackEmail

	props["EnableSignUpWithGitLab"] = strconv.FormatBool(c.GitLabSettings.Enable)

	props["ShowEmailAddress"] = strconv.FormatBool(c.PrivacySettings.ShowEmailAddress)

	props["EnablePublicLink"] = strconv.FormatBool(c.FileSettings.EnablePublicLink)
	props["ProfileHeight"] = fmt.Sprintf("%v", c.FileSettings.ProfileHeight)
	props["ProfileWidth"] = fmt.Sprintf("%v", c.FileSettings.ProfileWidth)

	return props
}
