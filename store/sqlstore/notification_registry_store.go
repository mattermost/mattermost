// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package sqlstore

import (
	"net/http"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
)

type SqlNotificationRegistryStore struct {
	SqlStore
}

func NewSqlNotificationRegistryStore(sqlStore SqlStore) store.NotificationRegistryStore {
	s := &SqlNotificationRegistryStore{sqlStore}

	for _, db := range sqlStore.GetAllConns() {
		table := db.AddTableWithName(model.NotificationRegistry{}, "NotificationRegistry").SetKeys(false, "AckId")
		table.ColMap("AckId").SetMaxSize(26)
		table.ColMap("UserId").SetMaxSize(26)
		table.ColMap("PostId").SetMaxSize(26)
		table.ColMap("DeviceId").SetMaxSize(512)
		table.ColMap("Type").SetMaxSize(26)
		table.ColMap("SendStatus").SetMaxSize(4096)
	}

	return s
}

func (s *SqlNotificationRegistryStore) CreateIndexesIfNotExists() {
	s.CreateIndexIfNotExists("idx_notification_ack_id", "NotificationRegistry", "AckId")
	s.CreateIndexIfNotExists("idx_notification_create_at", "NotificationRegistry", "CreateAt")
	s.CreateIndexIfNotExists("idx_notification_receive_at", "NotificationRegistry", "ReceiveAt")
	s.CreateIndexIfNotExists("idx_notification_post_id", "NotificationRegistry", "PostId")
	s.CreateIndexIfNotExists("idx_notification_user_id", "NotificationRegistry", "UserId")
	s.CreateIndexIfNotExists("idx_notification_type", "NotificationRegistry", "Type")
}

func (s *SqlNotificationRegistryStore) Save(notification *model.NotificationRegistry) (*model.NotificationRegistry, *model.AppError) {
	notification.PreSave()

	appErr := notification.IsValid()
	if appErr != nil {
		return nil, appErr
	}

	err := s.GetMaster().Insert(notification)
	if err != nil {
		appErr = model.NewAppError("SqlNotificationRegistryStore.Save", "store.sql_notification.save.app_error", nil, "id="+notification.AckId+", "+err.Error(), http.StatusInternalServerError)
		return nil, appErr
	}

	return notification, nil
}

func (s *SqlNotificationRegistryStore) MarkAsReceived(ackId string, time int64) *model.AppError {
	result, err := s.GetMaster().Exec("UPDATE NotificationRegistry SET ReceiveAt = :ReceiveAt WHERE AckId = :AckId AND ReceiveAt = 0", map[string]interface{}{"AckId": ackId, "ReceiveAt": time})
	if err != nil {
		return model.NewAppError("SqlNotificationRegistryStore.Save", "store.sql_notification.mark_as_received.app_error", nil, "id="+ackId+", "+err.Error(), http.StatusInternalServerError)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return model.NewAppError("SqlNotificationRegistryStore.Save", "store.sql_notification.mark_as_received.app_error", nil, "id="+ackId+", "+err.Error(), http.StatusInternalServerError)
	} else if affected != 1 {
		return model.NewAppError("SqlNotificationRegistryStore.Save", "store.sql_notification.mark_as_received.app_error", nil, "id="+ackId+", Message already received", http.StatusInternalServerError)
	}

	return nil
}

func (s *SqlNotificationRegistryStore) UpdateSendStatus(ackId, status string) *model.AppError {
	_, err := s.GetMaster().Exec("UPDATE NotificationRegistry SET SendStatus = :Status WHERE AckId = :AckId", map[string]interface{}{"AckId": ackId, "Status": status})
	if err != nil {
		return model.NewAppError("SqlNotificationRegistryStore.Save", "store.sql_notification.update_status.app_error", nil, "id="+ackId+", "+err.Error(), http.StatusInternalServerError)
	}
	return nil
}
