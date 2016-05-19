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

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
)

const (
	MODE_DEV        = "dev"
	MODE_BETA       = "beta"
	MODE_PROD       = "prod"
	LOG_ROTATE_SIZE = 10000
)

var Cfg *model.Config = &model.Config{}
var CfgDiagnosticId = ""
var CfgLastModified int64 = 0
var CfgFileName string = ""
var ClientCfg map[string]string = map[string]string{}

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

func DisableDebugLogForTest() {
	l4g.Global["stdout"].Level = l4g.WARNING
}

func EnableDebugLogForTest() {
	l4g.Global["stdout"].Level = l4g.DEBUG
}

func ConfigureCmdLineLog() {
	ls := model.LogSettings{}
	ls.EnableConsole = true
	ls.ConsoleLevel = "WARN"
	configureLog(&ls)
}

func configureLog(s *model.LogSettings) {

	l4g.Close()

	if s.EnableConsole {
		level := l4g.DEBUG
		if s.ConsoleLevel == "INFO" {
			level = l4g.INFO
		} else if s.ConsoleLevel == "WARN" {
			level = l4g.WARNING
		} else if s.ConsoleLevel == "ERROR" {
			level = l4g.ERROR
		}

		lw := l4g.NewConsoleLogWriter()
		lw.SetFormat("[%D %T] [%L] %M")
		l4g.AddFilter("stdout", level, lw)
	}

	if s.EnableFile {

		var fileFormat = s.FileFormat

		if fileFormat == "" {
			fileFormat = "[%D %T] [%L] %M"
		}

		level := l4g.DEBUG
		if s.FileLevel == "INFO" {
			level = l4g.INFO
		} else if s.FileLevel == "WARN" {
			level = l4g.WARNING
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
		return model.NewLocAppError("SaveConfig", "utils.config.save_config.saving.app_error",
			map[string]interface{}{"Filename": fileName}, err.Error())
	}

	err = ioutil.WriteFile(fileName, b, 0644)
	if err != nil {
		return model.NewLocAppError("SaveConfig", "utils.config.save_config.saving.app_error",
			map[string]interface{}{"Filename": fileName}, err.Error())
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
		panic(T("utils.config.load_config.opening.panic",
			map[string]interface{}{"Filename": fileName, "Error": err.Error()}))
	}

	decoder := json.NewDecoder(file)
	config := model.Config{}
	err = decoder.Decode(&config)
	if err != nil {
		panic(T("utils.config.load_config.decoding.panic",
			map[string]interface{}{"Filename": fileName, "Error": err.Error()}))
	}

	if info, err := file.Stat(); err != nil {
		panic(T("utils.config.load_config.getting.panic",
			map[string]interface{}{"Filename": fileName, "Error": err.Error()}))
	} else {
		CfgLastModified = info.ModTime().Unix()
		CfgFileName = fileName
	}

	config.SetDefaults()

	if err := config.IsValid(); err != nil {
		panic(T("utils.config.load_config.validating.panic",
			map[string]interface{}{"Filename": fileName, "Error": err.Message}))
	}

	if err := ValidateLdapFilter(&config); err != nil {
		panic(T("utils.config.load_config.validating.panic",
			map[string]interface{}{"Filename": fileName, "Error": err.Message}))
	}

	configureLog(&config.LogSettings)
	TestConnection(&config)

	if config.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		dir := config.FileSettings.Directory
		if len(dir) > 0 && dir[len(dir)-1:] != "/" {
			config.FileSettings.Directory += "/"
		}
	}

	Cfg = &config
	ClientCfg = getClientConfig(Cfg)
}

func getClientConfig(c *model.Config) map[string]string {
	props := make(map[string]string)

	props["Version"] = model.CurrentVersion
	props["BuildNumber"] = model.BuildNumber
	props["BuildDate"] = model.BuildDate
	props["BuildHash"] = model.BuildHash
	props["BuildEnterpriseReady"] = model.BuildEnterpriseReady

	props["SiteName"] = c.TeamSettings.SiteName
	props["EnableTeamCreation"] = strconv.FormatBool(c.TeamSettings.EnableTeamCreation)
	props["EnableUserCreation"] = strconv.FormatBool(c.TeamSettings.EnableUserCreation)
	props["EnableOpenServer"] = strconv.FormatBool(*c.TeamSettings.EnableOpenServer)
	props["RestrictTeamNames"] = strconv.FormatBool(*c.TeamSettings.RestrictTeamNames)
	props["RestrictDirectMessage"] = *c.TeamSettings.RestrictDirectMessage

	props["EnableOAuthServiceProvider"] = strconv.FormatBool(c.ServiceSettings.EnableOAuthServiceProvider)
	props["SegmentDeveloperKey"] = c.ServiceSettings.SegmentDeveloperKey
	props["GoogleDeveloperKey"] = c.ServiceSettings.GoogleDeveloperKey
	props["EnableIncomingWebhooks"] = strconv.FormatBool(c.ServiceSettings.EnableIncomingWebhooks)
	props["EnableOutgoingWebhooks"] = strconv.FormatBool(c.ServiceSettings.EnableOutgoingWebhooks)
	props["EnableCommands"] = strconv.FormatBool(*c.ServiceSettings.EnableCommands)
	props["EnableOnlyAdminIntegrations"] = strconv.FormatBool(*c.ServiceSettings.EnableOnlyAdminIntegrations)
	props["EnablePostUsernameOverride"] = strconv.FormatBool(c.ServiceSettings.EnablePostUsernameOverride)
	props["EnablePostIconOverride"] = strconv.FormatBool(c.ServiceSettings.EnablePostIconOverride)
	props["EnableDeveloper"] = strconv.FormatBool(*c.ServiceSettings.EnableDeveloper)

	props["SendEmailNotifications"] = strconv.FormatBool(c.EmailSettings.SendEmailNotifications)
	props["SendPushNotifications"] = strconv.FormatBool(*c.EmailSettings.SendPushNotifications)
	props["EnableSignUpWithEmail"] = strconv.FormatBool(c.EmailSettings.EnableSignUpWithEmail)
	props["EnableSignInWithEmail"] = strconv.FormatBool(*c.EmailSettings.EnableSignInWithEmail)
	props["EnableSignInWithUsername"] = strconv.FormatBool(*c.EmailSettings.EnableSignInWithUsername)
	props["RequireEmailVerification"] = strconv.FormatBool(c.EmailSettings.RequireEmailVerification)
	props["FeedbackEmail"] = c.EmailSettings.FeedbackEmail

	props["EnableSignUpWithGitLab"] = strconv.FormatBool(c.GitLabSettings.Enable)
	props["EnableSignUpWithGoogle"] = strconv.FormatBool(c.GoogleSettings.Enable)

	props["ShowEmailAddress"] = strconv.FormatBool(c.PrivacySettings.ShowEmailAddress)

	props["TermsOfServiceLink"] = *c.SupportSettings.TermsOfServiceLink
	props["PrivacyPolicyLink"] = *c.SupportSettings.PrivacyPolicyLink
	props["AboutLink"] = *c.SupportSettings.AboutLink
	props["HelpLink"] = *c.SupportSettings.HelpLink
	props["ReportAProblemLink"] = *c.SupportSettings.ReportAProblemLink
	props["SupportEmail"] = *c.SupportSettings.SupportEmail

	props["EnablePublicLink"] = strconv.FormatBool(c.FileSettings.EnablePublicLink)
	props["ProfileHeight"] = fmt.Sprintf("%v", c.FileSettings.ProfileHeight)
	props["ProfileWidth"] = fmt.Sprintf("%v", c.FileSettings.ProfileWidth)

	props["WebsocketPort"] = fmt.Sprintf("%v", *c.ServiceSettings.WebsocketPort)
	props["WebsocketSecurePort"] = fmt.Sprintf("%v", *c.ServiceSettings.WebsocketSecurePort)

	props["AllowCorsFrom"] = *c.ServiceSettings.AllowCorsFrom

	if IsLicensed {
		if *License.Features.CustomBrand {
			props["EnableCustomBrand"] = strconv.FormatBool(*c.TeamSettings.EnableCustomBrand)
			props["CustomBrandText"] = *c.TeamSettings.CustomBrandText
		}

		if *License.Features.LDAP {
			props["EnableLdap"] = strconv.FormatBool(*c.LdapSettings.Enable)
			props["LdapLoginFieldName"] = *c.LdapSettings.LoginFieldName
			props["NicknameAttributeSet"] = strconv.FormatBool(*c.LdapSettings.NicknameAttribute != "")
		}

		if *License.Features.MFA {
			props["EnableMultifactorAuthentication"] = strconv.FormatBool(*c.ServiceSettings.EnableMultifactorAuthentication)
		}

		if *License.Features.Compliance {
			props["EnableCompliance"] = strconv.FormatBool(*c.ComplianceSettings.Enable)
		}
	}

	return props
}

func ValidateLdapFilter(cfg *model.Config) *model.AppError {
	ldapInterface := einterfaces.GetLdapInterface()
	if *cfg.LdapSettings.Enable && ldapInterface != nil && *cfg.LdapSettings.UserFilter != "" {
		if err := ldapInterface.ValidateFilter(*cfg.LdapSettings.UserFilter); err != nil {
			return err
		}
	}
	return nil
}

func Desanitize(cfg *model.Config) {
	if cfg.LdapSettings.BindPassword != nil && *cfg.LdapSettings.BindPassword == model.FAKE_SETTING {
		*cfg.LdapSettings.BindPassword = *Cfg.LdapSettings.BindPassword
	}

	if cfg.FileSettings.PublicLinkSalt == model.FAKE_SETTING {
		cfg.FileSettings.PublicLinkSalt = Cfg.FileSettings.PublicLinkSalt
	}
	if cfg.FileSettings.AmazonS3SecretAccessKey == model.FAKE_SETTING {
		cfg.FileSettings.AmazonS3SecretAccessKey = Cfg.FileSettings.AmazonS3SecretAccessKey
	}

	if cfg.EmailSettings.InviteSalt == model.FAKE_SETTING {
		cfg.EmailSettings.InviteSalt = Cfg.EmailSettings.InviteSalt
	}
	if cfg.EmailSettings.PasswordResetSalt == model.FAKE_SETTING {
		cfg.EmailSettings.PasswordResetSalt = Cfg.EmailSettings.PasswordResetSalt
	}
	if cfg.EmailSettings.SMTPPassword == model.FAKE_SETTING {
		cfg.EmailSettings.SMTPPassword = Cfg.EmailSettings.SMTPPassword
	}

	if cfg.GitLabSettings.Secret == model.FAKE_SETTING {
		cfg.GitLabSettings.Secret = Cfg.GitLabSettings.Secret
	}

	if cfg.SqlSettings.DataSource == model.FAKE_SETTING {
		cfg.SqlSettings.DataSource = Cfg.SqlSettings.DataSource
	}
	if cfg.SqlSettings.AtRestEncryptKey == model.FAKE_SETTING {
		cfg.SqlSettings.AtRestEncryptKey = Cfg.SqlSettings.AtRestEncryptKey
	}

	for i := range cfg.SqlSettings.DataSourceReplicas {
		cfg.SqlSettings.DataSourceReplicas[i] = Cfg.SqlSettings.DataSourceReplicas[i]
	}
}
