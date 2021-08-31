//go:generate mockgen --build_flags=--mod=mod -destination=mockstore/mockstore.go -package mockstore . Store
package store

import "github.com/mattermost/focalboard/server/model"

// Conainer represents a container in a store
// Using a struct to make extending this easier in the future.
type Container struct {
	WorkspaceID string
}

// Store represents the abstraction of the data storage.
type Store interface {
	GetBlocksWithParentAndType(c Container, parentID string, blockType string) ([]model.Block, error)
	GetBlocksWithParent(c Container, parentID string) ([]model.Block, error)
	GetBlocksWithRootID(c Container, rootID string) ([]model.Block, error)
	GetBlocksWithType(c Container, blockType string) ([]model.Block, error)
	GetSubTree2(c Container, blockID string) ([]model.Block, error)
	GetSubTree3(c Container, blockID string) ([]model.Block, error)
	GetAllBlocks(c Container) ([]model.Block, error)
	GetRootID(c Container, blockID string) (string, error)
	GetParentID(c Container, blockID string) (string, error)
	InsertBlock(c Container, block *model.Block, userID string) error
	DeleteBlock(c Container, blockID string, modifiedBy string) error
	GetBlockCountsByType() (map[string]int64, error)
	GetBlock(c Container, blockID string) (*model.Block, error)
	PatchBlock(c Container, blockID string, blockPatch *model.BlockPatch, userID string) error

	Shutdown() error

	GetSystemSettings() (map[string]string, error)
	SetSystemSetting(key, value string) error

	GetRegisteredUserCount() (int, error)
	GetUserByID(userID string) (*model.User, error)
	GetUserByEmail(email string) (*model.User, error)
	GetUserByUsername(username string) (*model.User, error)
	CreateUser(user *model.User) error
	UpdateUser(user *model.User) error
	UpdateUserPassword(username, password string) error
	UpdateUserPasswordByID(userID, password string) error
	GetUsersByWorkspace(workspaceID string) ([]*model.User, error)

	GetActiveUserCount(updatedSecondsAgo int64) (int, error)
	GetSession(token string, expireTime int64) (*model.Session, error)
	CreateSession(session *model.Session) error
	RefreshSession(session *model.Session) error
	UpdateSession(session *model.Session) error
	DeleteSession(sessionID string) error
	CleanUpSessions(expireTime int64) error

	UpsertSharing(c Container, sharing model.Sharing) error
	GetSharing(c Container, rootID string) (*model.Sharing, error)

	UpsertWorkspaceSignupToken(workspace model.Workspace) error
	UpsertWorkspaceSettings(workspace model.Workspace) error
	GetWorkspace(ID string) (*model.Workspace, error)
	HasWorkspaceAccess(userID string, workspaceID string) (bool, error)
	GetWorkspaceCount() (int64, error)
}
