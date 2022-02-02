package flow

import (
	"errors"

	pluginapi "github.com/mattermost/mattermost-plugin-api"
)

type Store interface {
	SetPostID(userID, flowName, stepName, postID string) error
	GetPostID(userID, flowName, stepName string) (string, error)
	RemovePostID(userID, flowName, stepName string) error

	GetCurrentStep(userID, flowName string) (int, error)
	SetCurrentStep(userID, flowName string, step int) error
	DeleteCurrentStep(userID, flowName string) error

	// GetContext(userID string) (map[string]interface{}, error)
	// GetContext(userID string, key string) (interface{}, error)
}

type flowStore struct {
	kv        *pluginapi.KVService
	keyPrefix string
}

func NewFlowStore(kv *pluginapi.KVService, keyPrefix string) Store {
	return &flowStore{
		kv:        kv,
		keyPrefix: keyPrefix,
	}
}

func (fs *flowStore) SetPostID(userID, flowName, stepName, postID string) error {
	ok, err := fs.kv.Set(fs.getPostKey(userID, flowName, stepName), postID)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("value not set without errors")
	}

	return nil
}

func (fs *flowStore) GetPostID(userID, flowName, stepName string) (string, error) {
	var postID string
	err := fs.kv.Get(fs.getPostKey(userID, flowName, stepName), &postID)
	if err != nil {
		return "", err
	}

	return postID, nil
}

func (fs *flowStore) RemovePostID(userID, flowName, stepName string) error {
	return fs.kv.Delete(fs.getPostKey(userID, flowName, stepName))
}

func (fs *flowStore) GetCurrentStep(userID, flowName string) (int, error) {
	var step int
	err := fs.kv.Get(fs.getStepKey(userID, flowName), &step)
	if err != nil {
		return 0, err
	}
	return step, nil
}

func (fs *flowStore) SetCurrentStep(userID, flowName string, step int) error {
	ok, err := fs.kv.Set(fs.getStepKey(userID, flowName), step)
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("value not set without errors")
	}
	return nil
}

func (fs *flowStore) DeleteCurrentStep(userID, flowName string) error {
	return fs.kv.Delete(fs.getStepKey(userID, flowName))
}

func (fs *flowStore) getPostKey(userID, flowName, stepName string) string {
	return fs.keyPrefix + "-post-" + userID + "-" + flowName + "-" + stepName
}

func (fs *flowStore) getStepKey(userID, flowName string) string {
	return fs.keyPrefix + "-step-" + userID + "-" + flowName
}
