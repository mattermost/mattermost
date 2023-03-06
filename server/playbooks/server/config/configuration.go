package config

// Configuration captures the plugin's external configuration as exposed in the Mattermost server
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
type Configuration struct {
	// PlaybookCreatorsUserIds is a list of users that can edit playbooks
	PlaybookCreatorsUserIds []string

	// EnableExperimentalFeatures determines if experimental features are enabled.
	EnableExperimentalFeatures bool

	// ** The following are NOT stored on the server
	// AdminUserIDs contains a list of user IDs that are allowed
	// to administer plugin functions, even if not Mattermost sysadmins.
	AllowedUserIDs []string

	// BotUserID used to post messages.
	BotUserID string

	// AdminLogLevel is "debug", "info", "warn", or "error".
	AdminLogLevel string

	// AdminLogVerbose: set to include full context with admin log messages.
	AdminLogVerbose bool
}

// Clone shallow copies the configuration. Your implementation may require a deep copy if
// your configuration has reference types.
func (c *Configuration) Clone() *Configuration {
	var clone = *c
	return &clone
}

func (c *Configuration) serialize() map[string]interface{} {
	ret := make(map[string]interface{})
	ret["BotUserID"] = c.BotUserID
	return ret
}
