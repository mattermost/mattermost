package panel

import (
	"errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

type Store interface {
	SetPanelPostID(userID string, postID string) error
	GetPanelPostID(userID string) (string, error)
	DeletePanelPostID(userID string) error
}

type panelStore struct {
	client    pluginapi.Client
	keyPrefix string
}

func NewPanelStore(apiClient pluginapi.Client, keyPrefix string) Store {
	return &panelStore{
		client:    apiClient,
		keyPrefix: keyPrefix,
	}
}

func (ps *panelStore) SetPanelPostID(userID, postID string) error {
	ok, err := ps.client.KV.Set(ps.getKey(userID), postID)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("value not set without errors")
	}
	return nil
}

func (ps *panelStore) GetPanelPostID(userID string) (string, error) {
	var postID string
	err := ps.client.KV.Get(ps.getKey(userID), &postID)
	if err != nil {
		return "", err
	}
	return postID, nil
}

func (ps *panelStore) DeletePanelPostID(userID string) error {
	return ps.client.KV.Delete(ps.getKey(userID))
}

func (ps *panelStore) getKey(userID string) string {
	return ps.keyPrefix + "-" + userID
}
