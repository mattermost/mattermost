// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package product

type ServiceKey string

const (
	ChannelKey       ServiceKey = "channel"
	ConfigKey        ServiceKey = "config"
	LicenseKey       ServiceKey = "license"
	FilestoreKey     ServiceKey = "filestore"
	FileInfoStoreKey ServiceKey = "fileinfostore"
	ClusterKey       ServiceKey = "cluster"
	CloudKey         ServiceKey = "cloud"
	PostKey          ServiceKey = "post"
	TeamKey          ServiceKey = "team"
	UserKey          ServiceKey = "user"
	PermissionsKey   ServiceKey = "permissions"
	RouterKey        ServiceKey = "router"
	BotKey           ServiceKey = "bot"
	LogKey           ServiceKey = "log"
	HooksKey         ServiceKey = "hooks"
	KVStoreKey       ServiceKey = "kvstore"
	StoreKey         ServiceKey = "storekey"
	SystemKey        ServiceKey = "systemkey"
	PreferencesKey   ServiceKey = "preferenceskey"
	BoardsKey        ServiceKey = "boards"
	SessionKey       ServiceKey = "sessionkey"
	FrontendKey      ServiceKey = "frontendkey"
	CommandKey       ServiceKey = "commandkey"
	ThreadsKey       ServiceKey = "threadskey"
)
