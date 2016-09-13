// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package store

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

const (
	VERSION_3_5_0 = "3.5.0"
	VERSION_3_4_0 = "3.4.0"
	VERSION_3_3_0 = "3.3.0"
	VERSION_3_2_0 = "3.2.0"
	VERSION_3_1_0 = "3.1.0"
	VERSION_3_0_0 = "3.0.0"
)

const (
	EXIT_VERSION_SAVE_MISSING = 1001
	EXIT_TOO_OLD              = 1002
	EXIT_VERSION_SAVE         = 1003
	EXIT_THEME_MIGRATION      = 1004
)

func UpgradeDatabase(sqlStore *SqlStore) {

	UpgradeDatabaseToVersion31(sqlStore)
	UpgradeDatabaseToVersion32(sqlStore)
	UpgradeDatabaseToVersion33(sqlStore)
	UpgradeDatabaseToVersion34(sqlStore)
	UpgradeDatabaseToVersion35(sqlStore)

	// If the SchemaVersion is empty this this is the first time it has ran
	// so lets set it to the current version.
	if sqlStore.SchemaVersion == "" {
		if result := <-sqlStore.system.Save(&model.System{Name: "Version", Value: model.CurrentVersion}); result.Err != nil {
			l4g.Critical(result.Err.Error())
			time.Sleep(time.Second)
			os.Exit(EXIT_VERSION_SAVE_MISSING)
		}

		sqlStore.SchemaVersion = model.CurrentVersion
		l4g.Info(utils.T("store.sql.schema_set.info"), model.CurrentVersion)
	}

	// If we're not on the current version then it's too old to be upgraded
	if sqlStore.SchemaVersion != model.CurrentVersion {
		l4g.Critical(utils.T("store.sql.schema_version.critical"), sqlStore.SchemaVersion)
		time.Sleep(time.Second)
		os.Exit(EXIT_TOO_OLD)
	}
}

func saveSchemaVersion(sqlStore *SqlStore, version string) {
	if result := <-sqlStore.system.Update(&model.System{Name: "Version", Value: model.CurrentVersion}); result.Err != nil {
		l4g.Critical(result.Err.Error())
		time.Sleep(time.Second)
		os.Exit(EXIT_VERSION_SAVE)
	}

	sqlStore.SchemaVersion = version
	l4g.Warn(utils.T("store.sql.upgraded.warn"), version)
}

func shouldPerformUpgrade(sqlStore *SqlStore, currentSchemaVersion string, expectedSchemaVersion string) bool {
	if sqlStore.SchemaVersion == currentSchemaVersion {
		l4g.Warn(utils.T("store.sql.schema_out_of_date.warn"), currentSchemaVersion)
		l4g.Warn(utils.T("store.sql.schema_upgrade_attempt.warn"), expectedSchemaVersion)

		return true
	}

	return false
}

func UpgradeDatabaseToVersion31(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_0_0, VERSION_3_1_0) {
		sqlStore.CreateColumnIfNotExists("OutgoingWebhooks", "ContentType", "varchar(128)", "varchar(128)", "")
		saveSchemaVersion(sqlStore, VERSION_3_1_0)
	}
}

func UpgradeDatabaseToVersion32(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_1_0, VERSION_3_2_0) {
		sqlStore.CreateColumnIfNotExists("TeamMembers", "DeleteAt", "bigint(20)", "bigint", "0")

		saveSchemaVersion(sqlStore, VERSION_3_2_0)
	}
}

func themeMigrationFailed(err error) {
	l4g.Critical(utils.T("store.sql_user.migrate_theme.critical"), err)
	time.Sleep(time.Second)
	os.Exit(EXIT_THEME_MIGRATION)
}

func UpgradeDatabaseToVersion33(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_2_0, VERSION_3_3_0) {
		if sqlStore.DoesColumnExist("Users", "ThemeProps") {
			params := map[string]interface{}{
				"Category": model.PREFERENCE_CATEGORY_THEME,
				"Name":     "",
			}

			transaction, err := sqlStore.GetMaster().Begin()
			if err != nil {
				themeMigrationFailed(err)
			}

			// increase size of Value column of Preferences table to match the size of the ThemeProps column
			if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_POSTGRES {
				if _, err := transaction.Exec("ALTER TABLE Preferences ALTER COLUMN Value TYPE varchar(2000)"); err != nil {
					themeMigrationFailed(err)
				}
			} else if utils.Cfg.SqlSettings.DriverName == model.DATABASE_DRIVER_MYSQL {
				if _, err := transaction.Exec("ALTER TABLE Preferences MODIFY Value text"); err != nil {
					themeMigrationFailed(err)
				}
			}

			// copy data across
			if _, err := transaction.Exec(
				`INSERT INTO
					Preferences(UserId, Category, Name, Value)
				SELECT
					Id, '`+model.PREFERENCE_CATEGORY_THEME+`', '', ThemeProps
				FROM
					Users
				WHERE
					Users.ThemeProps != 'null'`, params); err != nil {
				themeMigrationFailed(err)
			}

			// delete old data
			if _, err := transaction.Exec("ALTER TABLE Users DROP COLUMN ThemeProps"); err != nil {
				themeMigrationFailed(err)
			}

			if err := transaction.Commit(); err != nil {
				themeMigrationFailed(err)
			}

			// rename solarized_* code themes to solarized-* to match client changes in 3.0
			var data model.Preferences
			if _, err := sqlStore.GetMaster().Select(&data, "SELECT * FROM Preferences WHERE Category = '"+model.PREFERENCE_CATEGORY_THEME+"' AND Value LIKE '%solarized_%'"); err == nil {
				for i := range data {
					data[i].Value = strings.Replace(data[i].Value, "solarized_", "solarized-", -1)
				}

				sqlStore.Preference().Save(&data)
			}
		}

		sqlStore.CreateColumnIfNotExists("OAuthApps", "IsTrusted", "tinyint(1)", "boolean", "0")
		sqlStore.CreateColumnIfNotExists("OAuthApps", "IconURL", "varchar(512)", "varchar(512)", "")
		sqlStore.CreateColumnIfNotExists("OAuthAccessData", "ClientId", "varchar(26)", "varchar(26)", "")
		sqlStore.CreateColumnIfNotExists("OAuthAccessData", "UserId", "varchar(26)", "varchar(26)", "")
		sqlStore.CreateColumnIfNotExists("OAuthAccessData", "ExpiresAt", "bigint", "bigint", "0")

		if sqlStore.DoesColumnExist("OAuthAccessData", "AuthCode") {
			sqlStore.RemoveIndexIfExists("idx_oauthaccessdata_auth_code", "OAuthAccessData")
			sqlStore.RemoveColumnIfExists("OAuthAccessData", "AuthCode")
		}

		sqlStore.RemoveColumnIfExists("Users", "LastActivityAt")
		sqlStore.RemoveColumnIfExists("Users", "LastPingAt")

		sqlStore.CreateColumnIfNotExists("OutgoingWebhooks", "TriggerWhen", "tinyint", "integer", "0")

		saveSchemaVersion(sqlStore, VERSION_3_3_0)
	}
}

func UpgradeDatabaseToVersion34(sqlStore *SqlStore) {
	if shouldPerformUpgrade(sqlStore, VERSION_3_3_0, VERSION_3_4_0) {
		sqlStore.CreateColumnIfNotExists("Status", "Manual", "BOOLEAN", "BOOLEAN", "0")
		sqlStore.CreateColumnIfNotExists("Status", "ActiveChannel", "varchar(26)", "varchar(26)", "")

		saveSchemaVersion(sqlStore, VERSION_3_4_0)
	}
}

func UpgradeDatabaseToVersion35(sqlStore *SqlStore) {
	// if shouldPerformUpgrade(sqlStore, VERSION_3_4_0, VERSION_3_5_0) {
	sqlStore.CreateColumnIfNotExists("Posts", "HasFiles", "tinyint", "boolean", "0")

	if sqlStore.DoesColumnExist("Posts", "Filenames") {
		l4g.Warn(utils.T("store.sql.upgrade.files35.start.warn"))
		for {
			// Declare a new struct since model.Post no longer has the Filenames field
			var posts []*struct {
				Id           string
				UserId       string
				ChannelId    string
				TeamId       string
				CreateAt     int64
				UpdateAt     int64
				DeleteAt     int64
				Filenames    []string
				RawFilenames []byte // Gorp has a difficult time parsing string arrays sometimes, so do it manually
			}

			// Handle this 1000 posts at a time
			if _, err := sqlStore.GetMaster().Select(&posts,
				`SELECT
					Posts.Id as Id,
					Posts.UserId as UserId,
					Posts.ChannelId as ChannelId,
					Channels.TeamId as TeamId,
					Posts.CreateAt as CreateAt,
					Posts.UpdateAt as UpdateAt,
					Posts.DeleteAt as DeleteAt,
					Posts.Filenames as RawFilenames
				FROM
					Posts,
					Channels
				WHERE
					Posts.ChannelId = Channels.Id
					AND Posts.HasFiles = false
					AND Posts.Filenames != ''
				ORDER BY
					Posts.Id
				LIMIT
					1000`); err != nil {
				panic(err)
			}

			if len(posts) == 0 {
				// Nothing else to do
				l4g.Warn(utils.T("store.sql.upgrade.files35.posts_complete.warn"))
				break
			}

			for _, post := range posts {
				filesMigrated := false

				json.Unmarshal(post.RawFilenames, &post.Filenames)

				// Only bother creating entries for non-deleted posts since the files for previously deleted posts have already been renamed
				if post.DeleteAt == 0 {
					// Find the team that was used to make this post
					teamId := post.TeamId
					if teamId == "" {
						// Just assume all files on this post are on the same team, even though it's remotely possible they're not
						// if someone really wanted to mess with us
						split := strings.SplitN(post.Filenames[0], "/", 5)
						id := split[3]
						name, _ := url.QueryUnescape(split[4])

						// This post is in a direct channel so we need to figure out where the files are located
						if result := <-sqlStore.Team().GetTeamsByUserId(post.UserId); result.Err != nil {
							l4g.Error(utils.T("store.sql.upgrade.files35.teams.error"), post.UserId, result.Err)
						} else {
							teams := result.Data.([]*model.Team)

							for _, team := range teams {
								l4g.Debug("id is %v", id)
								l4g.Debug("name is %v", name)
								l4g.Debug(fmt.Sprintf("teams/%s/channels/%s/users/%s/%s/%s", team.Id, post.ChannelId, post.UserId, id, name))
								if _, err := utils.ReadFile(fmt.Sprintf("teams/%s/channels/%s/users/%s/%s/%s", team.Id, post.ChannelId, post.UserId, id, name)); err == nil {
									// Found the team that this file was posted from
									teamId = team.Id
									l4g.Debug("got team for DM channel %v", post.ChannelId)
									break
								}
							}

							if teamId == "" {
								l4g.Error(utils.T("store.sql.upgrade.files35.post_team.error"), post.Id, post.ChannelId)
							}
						}
					}

					if teamId != "" {
						// Insert FileInfo objects for this post
						for _, filename := range post.Filenames {
							// Filename is of the form /{channelId}/{userId}/{uid}/{nameWithExtension}
							split := strings.SplitN(filename, "/", 5)
							channelId := split[1]
							userId := split[2]
							id := split[3]
							name, _ := url.QueryUnescape(split[4])

							// TODO remove me before merging
							if split[0] != "" || split[1] != post.ChannelId || split[2] != post.UserId || strings.Contains(split[4], "/") {
								l4g.Debug("found post with unusual filename %v")
							}

							pathPrefix := fmt.Sprintf("teams/%s/channels/%s/users/%s/%s/", teamId, channelId, userId, id)
							path := pathPrefix + name

							if data, err := utils.ReadFile(path); err != nil {
								l4g.Error(utils.T("store.sql.upgrade.files35.file.error"), path, err)
							} else {
								info, _ := model.GetInfoForBytes(name, data)

								info.Id = id
								info.UserId = post.UserId
								info.PostId = post.Id
								info.CreateAt = post.CreateAt
								info.UpdateAt = post.UpdateAt

								info.Path = path
								if info.IsImage() {
									nameWithoutExtension := name[:strings.LastIndex(name, ".")]
									info.PreviewPath = pathPrefix + nameWithoutExtension + "_preview.jpg"
									info.ThumbnailPath = pathPrefix + nameWithoutExtension + "_thumb.jpg"
								}

								if result := <-sqlStore.FileInfo().Save(info); result.Err != nil {
									l4g.Error(utils.T("store.sql.upgrade.files35.save_file_info.error"), post.Id, filename, err)
								} else {
									l4g.Debug("row created")
									filesMigrated = true
								}
							}
						}
					} else {
						l4g.Warn(utils.T("Unable to link files to updated post, post_id=%v", post.Id))
					}
				} else {
					l4g.Warn("Not creating file entries for deleted post, post_id=%v", post.Id)
				}

				// Update Posts to clear Filenames and set HasFiles
				if _, err := sqlStore.GetMaster().Exec(
					`UPDATE
						Posts
					SET
						HasFiles = :HasFiles,
						Filenames = ''
					WHERE
						Id = :PostId`, map[string]interface{}{"HasFiles": filesMigrated, "PostId": post.Id}); err != nil {
					l4g.Error("Failed to update post to remove references to old files, post_id=%v, err=%v", post.Id, err)

					// Panic here since failing to update a post means that this will run forever on the same one
					panic(true)
				}
			}

			l4g.Warn(utils.T("store.sql.upgrade.files35.batch_complete.warn"))
		}

		sqlStore.RemoveColumnIfExists("Posts", "Filenames")
		l4g.Debug("column deleted")
	}
}

func UpgradeDatabaseToVersion35(sqlStore *SqlStore) {
	//if shouldPerformUpgrade(sqlStore, VERSION_3_4_0, VERSION_3_5_0) {

	sqlStore.GetMaster().Exec("UPDATE Users SET Roles = 'system_user' WHERE Roles = ''")
	sqlStore.GetMaster().Exec("UPDATE Users SET Roles = 'system_user system_admin' WHERE Roles = 'system_admin'")
	sqlStore.GetMaster().Exec("UPDATE TeamMembers SET Roles = 'team_user' WHERE Roles = ''")
	sqlStore.GetMaster().Exec("UPDATE TeamMembers SET Roles = 'team_user team_admin' WHERE Roles = 'admin'")
	sqlStore.GetMaster().Exec("UPDATE ChannelMembers SET Roles = 'channel_user' WHERE Roles = ''")
	sqlStore.GetMaster().Exec("UPDATE ChannelMembers SET Roles = 'channel_user channel_admin' WHERE Roles = 'admin'")

	// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
	// UNCOMMENT WHEN WE DO RELEASE
	// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
	//sqlStore.Session().RemoveAllSessions()

	//saveSchemaVersion(sqlStore, VERSION_3_5_0)
	//}
}
