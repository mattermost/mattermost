package flow

import (
	"errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

type PropertyStore interface {
	SetProperty(userID, propertyName string, value interface{}) error
}

type FlowStore interface {
	SetPostID(userID, propertyName, postID string) error
	GetPostID(userID, propertyName string) (string, error)
	RemovePostID(userID, propertyName string) error
	GetCurrentStep(userID string) (int, error)
	SetCurrentStep(userID string, step int) error
	DeleteCurrentStep(userID string) error
}

type flowStore struct {
	client    pluginapi.Client
	keyPrefix string
}

func NewFlowStore(apiClient pluginapi.Client, keyPrefix string) FlowStore {
	return &flowStore{
		client:    apiClient,
		keyPrefix: keyPrefix,
	}
}

func (fs *flowStore) SetPostID(userID, propertyName, postID string) error {
	ok, err := fs.client.KV.Set(fs.getPostKey(userID, propertyName), postID)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("value not set without errors")
	}
	return nil
}

func (fs *flowStore) GetPostID(userID, propertyName string) (string, error) {
	var postID string
	err := fs.client.KV.Get(fs.getPostKey(userID, propertyName), &postID)
	if err != nil {
		return "", err
	}
	return postID, nil
}

func (fs *flowStore) RemovePostID(userID, propertyName string) error {
	return fs.client.KV.Delete(fs.getPostKey(userID, propertyName))
}

func (fs *flowStore) GetCurrentStep(userID string) (int, error) {
	var step int
	err := fs.client.KV.Get(fs.getStepKey(userID), &step)
	if err != nil {
		return 0, err
	}
	return step, nil
}

func (fs *flowStore) SetCurrentStep(userID string, step int) error {
	ok, err := fs.client.KV.Set(fs.getStepKey(userID), step)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("value not set without errors")
	}
	return nil
}

func (fs *flowStore) DeleteCurrentStep(userID string) error {
	return fs.client.KV.Delete(fs.getStepKey(userID))
}

func (fs *flowStore) getPostKey(userID, propertyName string) string {
	return fs.keyPrefix + "-post-" + userID + "-" + propertyName
}

func (fs *flowStore) getStepKey(userID string) string {
	return fs.keyPrefix + "-step-" + userID
}
