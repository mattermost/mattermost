package panel

import (
	"errors"

	"github.com/mattermost/mattermost/server/public/plugin/pluginapi"
)

type Store interface {
	SetPanelPostID(userID string, postID string) error
	GetPanelPostID(userID string) (string, error)
	DeletePanelPostID(userID string) error
}

type panelStore struct {
	kv        *pluginapi.KVService
	keyPrefix string
}

func NewPanelStore(kv *pluginapi.KVService, keyPrefix string) Store {
	return &panelStore{
		kv:        kv,
		keyPrefix: keyPrefix,
	}
}

func (ps *panelStore) SetPanelPostID(userID, postID string) error {
	ok, err := ps.kv.Set(ps.getKey(userID), postID)
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
	err := ps.kv.Get(ps.getKey(userID), &postID)
	if err != nil {
		return "", err
	}
	return postID, nil
}

func (ps *panelStore) DeletePanelPostID(userID string) error {
	return ps.kv.Delete(ps.getKey(userID))
}

func (ps *panelStore) getKey(userID string) string {
	return ps.keyPrefix + "-" + userID
}
