// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	l4g "github.com/alecthomas/log4go"
	"github.com/fsnotify/fsnotify"
	"github.com/spf13/viper"

	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
)

const (
	MODE_DEV        = "dev"
	MODE_BETA       = "beta"
	MODE_PROD       = "prod"
	LOG_ROTATE_SIZE = 10000
	LOG_FILENAME    = "mattermost.log"
)

var cfgMutex = &sync.Mutex{}
var watcher *fsnotify.Watcher
var Cfg *model.Config = &model.Config{}
var CfgDiagnosticId = ""
var CfgHash = ""
var ClientCfgHash = ""
var CfgFileName string = ""
var CfgDisableConfigWatch = false
var ClientCfg map[string]string = map[string]string{}
var originalDisableDebugLvl l4g.Level = l4g.DEBUG
var siteURL = ""

func GetSiteURL() string {
	return siteURL
}

func SetSiteURL(url string) {
	siteURL = strings.TrimRight(url, "/")
}

var cfgListeners = map[string]func(*model.Config, *model.Config){}

// Registers a function with a given to be called when the config is reloaded and may have changed. The function
// will be called with two arguments: the old config and the new config. AddConfigListener returns a unique ID
// for the listener that can later be used to remove it.
func AddConfigListener(listener func(*model.Config, *model.Config)) string {
	id := model.NewId()
	cfgListeners[id] = listener
	return id
}

// Removes a listener function by the unique ID returned when AddConfigListener was called
func RemoveConfigListener(id string) {
	delete(cfgListeners, id)
}

func FindConfigFile(fileName string) string {
	if _, err := os.Stat("./config/" + fileName); err == nil {
		fileName, _ = filepath.Abs("./config/" + fileName)
	} else if _, err := os.Stat("../config/" + fileName); err == nil {
		fileName, _ = filepath.Abs("../config/" + fileName)
	} else if _, err := os.Stat(fileName); err == nil {
		fileName, _ = filepath.Abs(fileName)
	}

	return fileName
}

func FindDir(dir string) (string, bool) {
	fileName := "."
	found := false
	if _, err := os.Stat("./" + dir + "/"); err == nil {
		fileName, _ = filepath.Abs("./" + dir + "/")
		found = true
	} else if _, err := os.Stat("../" + dir + "/"); err == nil {
		fileName, _ = filepath.Abs("../" + dir + "/")
		found = true
	} else if _, err := os.Stat("../../" + dir + "/"); err == nil {
		fileName, _ = filepath.Abs("../../" + dir + "/")
		found = true
	}

	return fileName + "/", found
}

func DisableDebugLogForTest() {
	cfgMutex.Lock()
	defer cfgMutex.Unlock()
	if l4g.Global["stdout"] != nil {
		originalDisableDebugLvl = l4g.Global["stdout"].Level
		l4g.Global["stdout"].Level = l4g.ERROR
	}
}

func EnableDebugLogForTest() {
	cfgMutex.Lock()
	defer cfgMutex.Unlock()
	if l4g.Global["stdout"] != nil {
		l4g.Global["stdout"].Level = originalDisableDebugLvl
	}
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
		logDir, _ := FindDir("logs")
		return logDir + LOG_FILENAME
	} else {
		return fileLocation + LOG_FILENAME
	}
}

func SaveConfig(fileName string, config *model.Config) *model.AppError {
	cfgMutex.Lock()
	defer cfgMutex.Unlock()

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

func EnableConfigFromEnviromentVars() {
	viper.SetEnvPrefix("mm")
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()
}

func InitializeConfigWatch() {
	cfgMutex.Lock()
	defer cfgMutex.Unlock()

	if CfgDisableConfigWatch {
		return
	}

	if watcher == nil {
		var err error
		watcher, err = fsnotify.NewWatcher()
		if err != nil {
			l4g.Error(fmt.Sprintf("Failed to watch config file at %v with err=%v", CfgFileName, err.Error()))
		}

		go func() {
			configFile := filepath.Clean(CfgFileName)

			for {
				select {
				case event := <-watcher.Events:
					// we only care about the config file
					if filepath.Clean(event.Name) == configFile {
						if event.Op&fsnotify.Write == fsnotify.Write || event.Op&fsnotify.Create == fsnotify.Create {
							l4g.Info(fmt.Sprintf("Config file watcher detected a change reloading %v", CfgFileName))

							if configReadErr := viper.ReadInConfig(); configReadErr == nil {
								LoadConfig(CfgFileName)
							} else {
								l4g.Error(fmt.Sprintf("Failed to read while watching config file at %v with err=%v", CfgFileName, configReadErr.Error()))
							}
						}
					}
				case err := <-watcher.Errors:
					l4g.Error(fmt.Sprintf("Failed while watching config file at %v with err=%v", CfgFileName, err.Error()))
				}
			}
		}()
	}
}

func EnableConfigWatch() {
	cfgMutex.Lock()
	defer cfgMutex.Unlock()

	if watcher != nil {
		configFile := filepath.Clean(CfgFileName)
		configDir, _ := filepath.Split(configFile)

		if watcher != nil {
			watcher.Add(configDir)
		}
	}
}

func DisableConfigWatch() {
	cfgMutex.Lock()
	defer cfgMutex.Unlock()

	if watcher != nil {
		configFile := filepath.Clean(CfgFileName)
		configDir, _ := filepath.Split(configFile)
		watcher.Remove(configDir)
	}
}

func InitAndLoadConfig(filename string) error {
	if err := TranslationsPreInit(); err != nil {
		return err
	}

	EnableConfigFromEnviromentVars()
	LoadConfig(filename)
	InitializeConfigWatch()
	EnableConfigWatch()

	return nil
}

// LoadConfig will try to search around for the corresponding config file.
// It will search /tmp/fileName then attempt ./config/fileName,
// then ../config/fileName and last it will look at fileName
func LoadConfig(fileName string) {
	cfgMutex.Lock()
	defer cfgMutex.Unlock()

	// Cfg should never be null
	oldConfig := *Cfg

	fileNameWithExtension := filepath.Base(fileName)
	fileExtension := filepath.Ext(fileNameWithExtension)
	fileDir := filepath.Dir(fileName)

	if len(fileNameWithExtension) > 0 {
		fileNameOnly := fileNameWithExtension[:len(fileNameWithExtension)-len(fileExtension)]
		viper.SetConfigName(fileNameOnly)
	} else {
		viper.SetConfigName("config")
	}

	if len(fileDir) > 0 {
		viper.AddConfigPath(fileDir)
	}

	viper.SetConfigType("json")
	viper.AddConfigPath("./config")
	viper.AddConfigPath("../config")
	viper.AddConfigPath("../../config")
	viper.AddConfigPath(".")

	configReadErr := viper.ReadInConfig()
	if configReadErr != nil {
		errMsg := T("utils.config.load_config.opening.panic", map[string]interface{}{"Filename": fileName, "Error": configReadErr.Error()})
		fmt.Fprintln(os.Stderr, errMsg)
		os.Exit(1)
	}

	var config model.Config
	unmarshalErr := viper.Unmarshal(&config)
	if unmarshalErr != nil {
		errMsg := T("utils.config.load_config.decoding.panic", map[string]interface{}{"Filename": fileName, "Error": unmarshalErr.Error()})
		fmt.Fprintln(os.Stderr, errMsg)
		os.Exit(1)
	}

	CfgFileName = viper.ConfigFileUsed()

	needSave := len(config.SqlSettings.AtRestEncryptKey) == 0 || len(*config.FileSettings.PublicLinkSalt) == 0 ||
		len(config.EmailSettings.InviteSalt) == 0

	config.SetDefaults()

	if err := config.IsValid(); err != nil {
		panic(T(err.Id))
	}

	if needSave {
		cfgMutex.Unlock()
		if err := SaveConfig(CfgFileName, &config); err != nil {
			err.Translate(T)
			l4g.Warn(err.Error())
		}
		cfgMutex.Lock()
	}

	if err := ValidateLocales(&config); err != nil {
		cfgMutex.Unlock()
		if err := SaveConfig(CfgFileName, &config); err != nil {
			err.Translate(T)
			l4g.Warn(err.Error())
		}
		cfgMutex.Lock()
	}

	if err := ValidateLdapFilter(&config); err != nil {
		panic(T(err.Id))
	}

	configureLog(&config.LogSettings)

	if config.FileSettings.DriverName == model.IMAGE_DRIVER_LOCAL {
		dir := config.FileSettings.Directory
		if len(dir) > 0 && dir[len(dir)-1:] != "/" {
			config.FileSettings.Directory += "/"
		}
	}

	Cfg = &config
	CfgHash = fmt.Sprintf("%x", md5.Sum([]byte(Cfg.ToJson())))
	ClientCfg = getClientConfig(Cfg)
	clientCfgJson, _ := json.Marshal(ClientCfg)
	ClientCfgHash = fmt.Sprintf("%x", md5.Sum(clientCfgJson))

	// Actions that need to run every time the config is loaded
	if ldapI := einterfaces.GetLdapInterface(); ldapI != nil {
		// This restarts the job if nessisary (works for config reloads)
		ldapI.StartLdapSyncJob()
	}

	if samlI := einterfaces.GetSamlInterface(); samlI != nil {
		samlI.ConfigureSP()
	}

	SetDefaultRolesBasedOnConfig()
	SetSiteURL(*Cfg.ServiceSettings.SiteURL)

	for _, listener := range cfgListeners {
		listener(&oldConfig, &config)
	}
}

func RegenerateClientConfig() {
	ClientCfg = getClientConfig(Cfg)
}

func getClientConfig(c *model.Config) map[string]string {
	props := make(map[string]string)

	props["Version"] = model.CurrentVersion
	props["BuildNumber"] = model.BuildNumber
	props["BuildDate"] = model.BuildDate
	props["BuildHash"] = model.BuildHash
	props["BuildHashEnterprise"] = model.BuildHashEnterprise
	props["BuildEnterpriseReady"] = model.BuildEnterpriseReady

	props["SiteURL"] = strings.TrimRight(*c.ServiceSettings.SiteURL, "/")
	props["SiteName"] = c.TeamSettings.SiteName
	props["EnableTeamCreation"] = strconv.FormatBool(c.TeamSettings.EnableTeamCreation)
	props["EnableUserCreation"] = strconv.FormatBool(c.TeamSettings.EnableUserCreation)
	props["EnableOpenServer"] = strconv.FormatBool(*c.TeamSettings.EnableOpenServer)
	props["RestrictDirectMessage"] = *c.TeamSettings.RestrictDirectMessage
	props["RestrictTeamInvite"] = *c.TeamSettings.RestrictTeamInvite
	props["RestrictPublicChannelCreation"] = *c.TeamSettings.RestrictPublicChannelCreation
	props["RestrictPrivateChannelCreation"] = *c.TeamSettings.RestrictPrivateChannelCreation
	props["RestrictPublicChannelManagement"] = *c.TeamSettings.RestrictPublicChannelManagement
	props["RestrictPrivateChannelManagement"] = *c.TeamSettings.RestrictPrivateChannelManagement
	props["RestrictPublicChannelDeletion"] = *c.TeamSettings.RestrictPublicChannelDeletion
	props["RestrictPrivateChannelDeletion"] = *c.TeamSettings.RestrictPrivateChannelDeletion
	props["RestrictPrivateChannelManageMembers"] = *c.TeamSettings.RestrictPrivateChannelManageMembers
	props["TeammateNameDisplay"] = *c.TeamSettings.TeammateNameDisplay

	props["EnableOAuthServiceProvider"] = strconv.FormatBool(c.ServiceSettings.EnableOAuthServiceProvider)
	props["GoogleDeveloperKey"] = c.ServiceSettings.GoogleDeveloperKey
	props["EnableIncomingWebhooks"] = strconv.FormatBool(c.ServiceSettings.EnableIncomingWebhooks)
	props["EnableOutgoingWebhooks"] = strconv.FormatBool(c.ServiceSettings.EnableOutgoingWebhooks)
	props["EnableCommands"] = strconv.FormatBool(*c.ServiceSettings.EnableCommands)
	props["EnableOnlyAdminIntegrations"] = strconv.FormatBool(*c.ServiceSettings.EnableOnlyAdminIntegrations)
	props["EnablePostUsernameOverride"] = strconv.FormatBool(c.ServiceSettings.EnablePostUsernameOverride)
	props["EnablePostIconOverride"] = strconv.FormatBool(c.ServiceSettings.EnablePostIconOverride)
	props["EnableUserAccessTokens"] = strconv.FormatBool(*c.ServiceSettings.EnableUserAccessTokens)
	props["EnableLinkPreviews"] = strconv.FormatBool(*c.ServiceSettings.EnableLinkPreviews)
	props["EnableTesting"] = strconv.FormatBool(c.ServiceSettings.EnableTesting)
	props["EnableDeveloper"] = strconv.FormatBool(*c.ServiceSettings.EnableDeveloper)
	props["EnableDiagnostics"] = strconv.FormatBool(*c.LogSettings.EnableDiagnostics)
	props["RestrictPostDelete"] = *c.ServiceSettings.RestrictPostDelete
	props["AllowEditPost"] = *c.ServiceSettings.AllowEditPost
	props["PostEditTimeLimit"] = fmt.Sprintf("%v", *c.ServiceSettings.PostEditTimeLimit)

	props["SendEmailNotifications"] = strconv.FormatBool(c.EmailSettings.SendEmailNotifications)
	props["SendPushNotifications"] = strconv.FormatBool(*c.EmailSettings.SendPushNotifications)
	props["EnableSignUpWithEmail"] = strconv.FormatBool(c.EmailSettings.EnableSignUpWithEmail)
	props["EnableSignInWithEmail"] = strconv.FormatBool(*c.EmailSettings.EnableSignInWithEmail)
	props["EnableSignInWithUsername"] = strconv.FormatBool(*c.EmailSettings.EnableSignInWithUsername)
	props["RequireEmailVerification"] = strconv.FormatBool(c.EmailSettings.RequireEmailVerification)
	props["EnableEmailBatching"] = strconv.FormatBool(*c.EmailSettings.EnableEmailBatching)
	props["EmailNotificationContentsType"] = *c.EmailSettings.EmailNotificationContentsType

	props["EnableSignUpWithGitLab"] = strconv.FormatBool(c.GitLabSettings.Enable)

	props["ShowEmailAddress"] = strconv.FormatBool(c.PrivacySettings.ShowEmailAddress)

	props["TermsOfServiceLink"] = *c.SupportSettings.TermsOfServiceLink
	props["PrivacyPolicyLink"] = *c.SupportSettings.PrivacyPolicyLink
	props["AboutLink"] = *c.SupportSettings.AboutLink
	props["HelpLink"] = *c.SupportSettings.HelpLink
	props["ReportAProblemLink"] = *c.SupportSettings.ReportAProblemLink
	props["AdministratorsGuideLink"] = *c.SupportSettings.AdministratorsGuideLink
	props["TroubleshootingForumLink"] = *c.SupportSettings.TroubleshootingForumLink
	props["CommercialSupportLink"] = *c.SupportSettings.CommercialSupportLink
	props["SupportEmail"] = *c.SupportSettings.SupportEmail

	props["EnableFileAttachments"] = strconv.FormatBool(*c.FileSettings.EnableFileAttachments)
	props["EnableMobileFileUpload"] = strconv.FormatBool(*c.FileSettings.EnableMobileUpload)
	props["EnableMobileFileDownload"] = strconv.FormatBool(*c.FileSettings.EnableMobileDownload)
	props["EnablePublicLink"] = strconv.FormatBool(c.FileSettings.EnablePublicLink)

	props["WebsocketPort"] = fmt.Sprintf("%v", *c.ServiceSettings.WebsocketPort)
	props["WebsocketSecurePort"] = fmt.Sprintf("%v", *c.ServiceSettings.WebsocketSecurePort)

	props["DefaultClientLocale"] = *c.LocalizationSettings.DefaultClientLocale
	props["AvailableLocales"] = *c.LocalizationSettings.AvailableLocales
	props["SQLDriverName"] = c.SqlSettings.DriverName

	props["EnableCustomEmoji"] = strconv.FormatBool(*c.ServiceSettings.EnableCustomEmoji)
	props["EnableEmojiPicker"] = strconv.FormatBool(*c.ServiceSettings.EnableEmojiPicker)
	props["RestrictCustomEmojiCreation"] = *c.ServiceSettings.RestrictCustomEmojiCreation
	props["MaxFileSize"] = strconv.FormatInt(*c.FileSettings.MaxFileSize, 10)

	props["AppDownloadLink"] = *c.NativeAppSettings.AppDownloadLink
	props["AndroidAppDownloadLink"] = *c.NativeAppSettings.AndroidAppDownloadLink
	props["IosAppDownloadLink"] = *c.NativeAppSettings.IosAppDownloadLink

	props["EnableWebrtc"] = strconv.FormatBool(*c.WebrtcSettings.Enable)

	props["MaxNotificationsPerChannel"] = strconv.FormatInt(*c.TeamSettings.MaxNotificationsPerChannel, 10)
	props["TimeBetweenUserTypingUpdatesMilliseconds"] = strconv.FormatInt(*c.ServiceSettings.TimeBetweenUserTypingUpdatesMilliseconds, 10)
	props["EnableUserTypingMessages"] = strconv.FormatBool(*c.ServiceSettings.EnableUserTypingMessages)
	props["EnableChannelViewedMessages"] = strconv.FormatBool(*c.ServiceSettings.EnableChannelViewedMessages)

	props["DiagnosticId"] = CfgDiagnosticId
	props["DiagnosticsEnabled"] = strconv.FormatBool(*c.LogSettings.EnableDiagnostics)

	if IsLicensed {
		if *License.Features.CustomBrand {
			props["EnableCustomBrand"] = strconv.FormatBool(*c.TeamSettings.EnableCustomBrand)
			props["CustomBrandText"] = *c.TeamSettings.CustomBrandText
			props["CustomDescriptionText"] = *c.TeamSettings.CustomDescriptionText
		}

		if *License.Features.LDAP {
			props["EnableLdap"] = strconv.FormatBool(*c.LdapSettings.Enable)
			props["LdapLoginFieldName"] = *c.LdapSettings.LoginFieldName
			props["NicknameAttributeSet"] = strconv.FormatBool(*c.LdapSettings.NicknameAttribute != "")
			props["FirstNameAttributeSet"] = strconv.FormatBool(*c.LdapSettings.FirstNameAttribute != "")
			props["LastNameAttributeSet"] = strconv.FormatBool(*c.LdapSettings.LastNameAttribute != "")
		}

		if *License.Features.MFA {
			props["EnableMultifactorAuthentication"] = strconv.FormatBool(*c.ServiceSettings.EnableMultifactorAuthentication)
			props["EnforceMultifactorAuthentication"] = strconv.FormatBool(*c.ServiceSettings.EnforceMultifactorAuthentication)
		}

		if *License.Features.Compliance {
			props["EnableCompliance"] = strconv.FormatBool(*c.ComplianceSettings.Enable)
		}

		if *License.Features.SAML {
			props["EnableSaml"] = strconv.FormatBool(*c.SamlSettings.Enable)
			props["SamlLoginButtonText"] = *c.SamlSettings.LoginButtonText
			props["FirstNameAttributeSet"] = strconv.FormatBool(*c.SamlSettings.FirstNameAttribute != "")
			props["LastNameAttributeSet"] = strconv.FormatBool(*c.SamlSettings.LastNameAttribute != "")
			props["NicknameAttributeSet"] = strconv.FormatBool(*c.SamlSettings.NicknameAttribute != "")
		}

		if *License.Features.Cluster {
			props["EnableCluster"] = strconv.FormatBool(*c.ClusterSettings.Enable)
		}

		if *License.Features.Cluster {
			props["EnableMetrics"] = strconv.FormatBool(*c.MetricsSettings.Enable)
		}

		if *License.Features.GoogleOAuth {
			props["EnableSignUpWithGoogle"] = strconv.FormatBool(c.GoogleSettings.Enable)
		}

		if *License.Features.Office365OAuth {
			props["EnableSignUpWithOffice365"] = strconv.FormatBool(c.Office365Settings.Enable)
		}

		if *License.Features.PasswordRequirements {
			props["PasswordMinimumLength"] = fmt.Sprintf("%v", *c.PasswordSettings.MinimumLength)
			props["PasswordRequireLowercase"] = strconv.FormatBool(*c.PasswordSettings.Lowercase)
			props["PasswordRequireUppercase"] = strconv.FormatBool(*c.PasswordSettings.Uppercase)
			props["PasswordRequireNumber"] = strconv.FormatBool(*c.PasswordSettings.Number)
			props["PasswordRequireSymbol"] = strconv.FormatBool(*c.PasswordSettings.Symbol)
		}

		if *License.Features.Announcement {
			props["EnableBanner"] = strconv.FormatBool(*c.AnnouncementSettings.EnableBanner)
			props["BannerText"] = *c.AnnouncementSettings.BannerText
			props["BannerColor"] = *c.AnnouncementSettings.BannerColor
			props["BannerTextColor"] = *c.AnnouncementSettings.BannerTextColor
			props["AllowBannerDismissal"] = strconv.FormatBool(*c.AnnouncementSettings.AllowBannerDismissal)
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

func ValidateLocales(cfg *model.Config) *model.AppError {
	var err *model.AppError
	locales := GetSupportedLocales()
	if _, ok := locales[*cfg.LocalizationSettings.DefaultServerLocale]; !ok {
		*cfg.LocalizationSettings.DefaultServerLocale = model.DEFAULT_LOCALE
		err = model.NewLocAppError("ValidateLocales", "utils.config.supported_server_locale.app_error", nil, "")
	}

	if _, ok := locales[*cfg.LocalizationSettings.DefaultClientLocale]; !ok {
		*cfg.LocalizationSettings.DefaultClientLocale = model.DEFAULT_LOCALE
		err = model.NewLocAppError("ValidateLocales", "utils.config.supported_client_locale.app_error", nil, "")
	}

	if len(*cfg.LocalizationSettings.AvailableLocales) > 0 {
		isDefaultClientLocaleInAvailableLocales := false
		for _, word := range strings.Split(*cfg.LocalizationSettings.AvailableLocales, ",") {
			if _, ok := locales[word]; !ok {
				*cfg.LocalizationSettings.AvailableLocales = ""
				isDefaultClientLocaleInAvailableLocales = true
				err = model.NewLocAppError("ValidateLocales", "utils.config.supported_available_locales.app_error", nil, "")
				break
			}

			if word == *cfg.LocalizationSettings.DefaultClientLocale {
				isDefaultClientLocaleInAvailableLocales = true
			}
		}

		availableLocales := *cfg.LocalizationSettings.AvailableLocales

		if !isDefaultClientLocaleInAvailableLocales {
			availableLocales += "," + *cfg.LocalizationSettings.DefaultClientLocale
			err = model.NewLocAppError("ValidateLocales", "utils.config.add_client_locale.app_error", nil, "")
		}

		*cfg.LocalizationSettings.AvailableLocales = strings.Join(RemoveDuplicatesFromStringArray(strings.Split(availableLocales, ",")), ",")
	}

	return err
}

func Desanitize(cfg *model.Config) {
	if cfg.LdapSettings.BindPassword != nil && *cfg.LdapSettings.BindPassword == model.FAKE_SETTING {
		*cfg.LdapSettings.BindPassword = *Cfg.LdapSettings.BindPassword
	}

	if *cfg.FileSettings.PublicLinkSalt == model.FAKE_SETTING {
		*cfg.FileSettings.PublicLinkSalt = *Cfg.FileSettings.PublicLinkSalt
	}
	if cfg.FileSettings.AmazonS3SecretAccessKey == model.FAKE_SETTING {
		cfg.FileSettings.AmazonS3SecretAccessKey = Cfg.FileSettings.AmazonS3SecretAccessKey
	}

	if cfg.EmailSettings.InviteSalt == model.FAKE_SETTING {
		cfg.EmailSettings.InviteSalt = Cfg.EmailSettings.InviteSalt
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

	if *cfg.ElasticsearchSettings.Password == model.FAKE_SETTING {
		*cfg.ElasticsearchSettings.Password = *Cfg.ElasticsearchSettings.Password
	}

	for i := range cfg.SqlSettings.DataSourceReplicas {
		cfg.SqlSettings.DataSourceReplicas[i] = Cfg.SqlSettings.DataSourceReplicas[i]
	}

	for i := range cfg.SqlSettings.DataSourceSearchReplicas {
		cfg.SqlSettings.DataSourceSearchReplicas[i] = Cfg.SqlSettings.DataSourceSearchReplicas[i]
	}
}
