package settings

// SettingStore defines the behavior needed to set and get settings
type SettingStore interface {
	SetSetting(userID, settingID string, value any) error
	GetSetting(userID, settingID string) (any, error)
}
