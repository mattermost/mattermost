package sqlstore

import (
"github.com/mattermost/mattermost-server/v5/einterfaces"
"github.com/mattermost/mattermost-server/v5/model"
"github.com/mattermost/mattermost-server/v5/store"
)

type SqlFriendStore struct {
	SqlStore
}

func (fs SqlFriendStore) Save(friend *model.Friend) (*model.Friend, *model.AppError) {
	fs.GetMaster().Insert(friend)
	return friend, nil
}

func (fs SqlFriendStore) Update(friend *model.Friend) (*model.Friend, *model.AppError) {
	fs.GetMaster().Update(friend)
	return friend, nil
}

func newSqlFriendStore(sqlStore SqlStore, metrics einterfaces.MetricsInterface) store.FriendStore {
	s := &SqlFriendStore{
		SqlStore: sqlStore,
	}

	for _, db := range sqlStore.GetAllConns() {
		db.AddTableWithName(model.Friend{}, "Friend").SetKeys(false, "UserId1", "UserId2")
	}

	return s
}
