package server

import (
	"reflect"
)

// configuration captures the plugin's external configuration as exposed in the Mattermost server
// configuration, as well as values computed from the configuration. Any public fields will be
// deserialized from the Mattermost server configuration in OnConfigurationChange.
//
// As plugins are inherently concurrent (hooks being called asynchronously), and the plugin
// configuration can change at any time, access to the configuration must be synchronized. The
// strategy used in this plugin is to guard a pointer to the configuration, and clone the entire
// struct whenever it changes. You may replace this with whatever strategy you choose.
//
// If you add non-reference types to your configuration struct, be sure to rewrite Clone as a deep
// copy appropriate for your types.
type configuration struct {
	EnablePublicSharedBoards bool
}

// Clone shallow copies the configuration. Your implementation may require a deep copy if
// your configuration has reference types.
func (c *configuration) Clone() *configuration {
	var clone = *c
	return &clone
}

// getConfiguration retrieves the active configuration under lock, making it safe to use
// concurrently. The active configuration may change underneath the client of this method, but
// the struct returned by this API call is considered immutable.
/*
func (b *BoardsService) getConfiguration() *configuration {
	b.configurationLock.RLock()
	defer b.configurationLock.RUnlock()

	if b.configuration == nil {
		return &configuration{}
	}

	return b.configuration
}
*/

// setConfiguration replaces the active configuration under lock.
//
// Do not call setConfiguration while holding the configurationLock, as sync.Mutex is not
// reentrant. In particular, avoid using the plugin API entirely, as this may in turn trigger a
// hook back into the plugin. If that hook attempts to acquire this lock, a deadlock may occur.
//
// This method panics if setConfiguration is called with the existing configuration. This almost
// certainly means that the configuration was modified without being cloned and may result in
// an unsafe access.
func (b *BoardsService) setConfiguration(configuration *configuration) {
	b.configurationLock.Lock()
	defer b.configurationLock.Unlock()

	if configuration != nil && b.configuration == configuration {
		// Ignore assignment if the configuration struct is empty. Go will optimize the
		// allocation for same to point at the same memory address, breaking the check
		// above.
		if reflect.ValueOf(*configuration).NumField() == 0 {
			return
		}

		panic("setConfiguration called with the existing configuration")
	}

	b.configuration = configuration
}

// OnConfigurationChange is invoked when configuration changes may have been made.
func (b *BoardsService) OnConfigurationChange() error {
	// Have we been setup by OnActivate?
	if b.server == nil {
		return nil
	}
	mmconfig := b.servicesAPI.GetConfig()

	// handle plugin configuration settings
	enableShareBoards := false
	if mmconfig.PluginSettings.Plugins[PluginName][SharedBoardsName] == true {
		enableShareBoards = true
	}
	if mmconfig.ProductSettings.EnablePublicSharedBoards != nil {
		enableShareBoards = *mmconfig.ProductSettings.EnablePublicSharedBoards
	}
	configuration := &configuration{
		EnablePublicSharedBoards: enableShareBoards,
	}
	b.setConfiguration(configuration)
	b.server.Config().EnablePublicSharedBoards = enableShareBoards

	// handle feature flags
	b.server.Config().FeatureFlags = parseFeatureFlags(mmconfig.FeatureFlags.ToMap())

	// handle Data Retention settings
	enableBoardsDeletion := false
	if mmconfig.DataRetentionSettings.EnableBoardsDeletion != nil {
		enableBoardsDeletion = true
	}
	b.server.Config().EnableDataRetention = enableBoardsDeletion
	b.server.Config().DataRetentionDays = *mmconfig.DataRetentionSettings.BoardsRetentionDays
	b.server.Config().TeammateNameDisplay = *mmconfig.TeamSettings.TeammateNameDisplay
	showEmailAddress := false
	if mmconfig.PrivacySettings.ShowEmailAddress != nil {
		showEmailAddress = *mmconfig.PrivacySettings.ShowEmailAddress
	}
	b.server.Config().ShowEmailAddress = showEmailAddress
	showFullName := false
	if mmconfig.PrivacySettings.ShowFullName != nil {
		showFullName = *mmconfig.PrivacySettings.ShowFullName
	}
	b.server.Config().ShowFullName = showFullName
	maxFileSize := int64(0)
	if mmconfig.FileSettings.MaxFileSize != nil {
		maxFileSize = *mmconfig.FileSettings.MaxFileSize
	}
	b.server.Config().MaxFileSize = maxFileSize

	b.server.UpdateAppConfig()
	b.wsPluginAdapter.BroadcastConfigChange(*b.server.App().GetClientConfig())
	return nil
}
