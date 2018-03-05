// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package nosqlstore

import (
	"github.com/mattermost/mattermost-server/store"
)

type NoSQLStore struct {
	store.Store
	WebhookStore *WebhookStore
}

func New(driver Driver) (*NoSQLStore, error) {
	ret := &NoSQLStore{}
	if webhookStore, err := NewWebhookStore(driver); err != nil {
		return nil, err
	} else {
		ret.WebhookStore = webhookStore
	}
	return ret, nil
}

func (s *NoSQLStore) Webhook() store.WebhookStore {
	return s.WebhookStore
}
