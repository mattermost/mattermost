package freetextfetcher

import (
	"errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

// FreetextStore defines the behavior needed to store all the data for the FreetextFetcher
type FreetextStore interface {
	StartFetching(userID, fetcherID, payload string) error
	StopFetching(userID string) error
	ShouldProcessFreetext(userID, fetcherID string) (bool, string, error)
}

type freetextStore struct {
	client    pluginapi.Client
	keyPrefix string
}

type storeElement struct {
	fetcherID string
	payload   string
}

// NewFreetextStore creates a new store for the FreetextFetcher
func NewFreetextStore(apiClient pluginapi.Client, keyPrefix string) FreetextStore {
	return &freetextStore{
		client:    apiClient,
		keyPrefix: keyPrefix,
	}
}

func (fts *freetextStore) StartFetching(userID, fetcherID, payload string) error {
	toStore := storeElement{
		fetcherID: fetcherID,
		payload:   payload,
	}
	ok, err := fts.client.KV.Set(fts.getKey(userID), toStore)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("value not set without errors")
	}
	return nil
}

func (fts *freetextStore) StopFetching(userID string) error {
	return fts.client.KV.Delete(fts.getKey(userID))
}

func (fts *freetextStore) ShouldProcessFreetext(userID, fetcherID string) (shouldProcess bool, payload string, err error) {
	var se storeElement
	err = fts.client.KV.Get(fts.getKey(userID), &se)
	if err != nil {
		return false, "", err
	}

	if se.fetcherID != fetcherID {
		return false, "", nil
	}

	return true, se.payload, nil
}

func (fts *freetextStore) getKey(userID string) string {
	return fts.keyPrefix + "-" + userID
}
