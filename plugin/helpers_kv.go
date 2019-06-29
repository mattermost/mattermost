package plugin

import (
	"encoding/json"

	"github.com/pkg/errors"
)

func (p *HelpersImpl) KVGetJSON(key string, value interface{}) error {
	data, err := p.API.KVGet(key)
	if err != nil {
		return err
	}

	return json.Unmarshal(data, value)
}

func (p *HelpersImpl) KVSetJSON(key string, value interface{}) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return p.API.KVSet(key, data)
}

func (p *HelpersImpl) KVCompareAndSetJSON(key string, oldValue interface{}, newValue interface{}) (bool, error) {
	oldData, err := json.Marshal(oldValue)
	if err != nil {
		return false, errors.Wrap(err, "unable to marshal old value")
	}

	newData, err := json.Marshal(newValue)
	if err != nil {
		return false, errors.Wrap(err, "unable to marshal new value")
	}

	return p.API.KVCompareAndSet(key, oldData, newData)
}

func (p *HelpersImpl) KVSetWithExpiryJSON(key string, value interface{}, expireInSeconds int64) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return p.API.KVSetWithExpiry(key, data, expireInSeconds)
}
