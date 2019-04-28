// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package config

import (
	"github.com/pkg/errors"
	"strings"

	"github.com/mattermost/mattermost-server/model"
)

// Listener is a callback function invoked when the configuration changes.
type Listener func(oldConfig *model.Config, newConfig *model.Config)

// Store abstracts the act of getting and setting the configuration.
type Store interface {
	// Get fetches the current, cached configuration.
	Get() *model.Config

	// GetEnvironmentOverrides fetches the configuration fields overridden by environment variables.
	GetEnvironmentOverrides() map[string]interface{}

	// Set replaces the current configuration in its entirety and updates the backing store.
	Set(*model.Config) (*model.Config, error)

	// Load updates the current configuration from the backing store, possibly initializing.
	Load() (err error)

	// AddListener adds a callback function to invoke when the configuration is modified.
	AddListener(listener Listener) string

	// RemoveListener removes a callback function using an id returned from AddListener.
	RemoveListener(id string)

	// GetFile fetches the contents of a previously persisted configuration file.
	// If no such file exists, an empty byte array will be returned without error.
	GetFile(name string) ([]byte, error)

	// SetFile sets or replaces the contents of a configuration file.
	SetFile(name string, data []byte) error

	// HasFile returns true if the given file was previously persisted.
	HasFile(name string) (bool, error)

	// RemoveFile removes a previously persisted configuration file.
	RemoveFile(name string) error

	// String describes the backing store for the config.
	String() string

	// Close cleans up resources associated with the store.
	Close() error
}

// NewStore creates a database or file store given a data source name by which to connect.
func NewStore(dsn string, watch bool) (Store, error) {
	if strings.HasPrefix(dsn, "mysql://") || strings.HasPrefix(dsn, "postgres://") {
		return NewDatabaseStore(dsn)
	}

	return NewFileStore(dsn, watch)
}

func MigrateConfig(sourceStore, destinationStore Store) error {
	// Copy config from source to destination
	sourceStoreConfig := sourceStore.Get()

	_, err := destinationStore.Set(sourceStoreConfig)
	if err != nil {
		return errors.Wrap(err, "failed to migrate config")
	}

	//get the certificate files from sourceStore
	idpCertificateFile, err := sourceStore.GetFile(*sourceStoreConfig.SamlSettings.IdpCertificateFile)
	if err != nil {
		return errors.Wrap(err, "failed to migrate config")
	}

	publicCertificateFile, err := sourceStore.GetFile(*sourceStoreConfig.SamlSettings.PublicCertificateFile)
	if err != nil {
		return errors.Wrap(err, "failed to migrate config")
	}

	privateKeyFile, err := sourceStore.GetFile(*sourceStoreConfig.SamlSettings.PrivateKeyFile)
	if err != nil {
		return errors.Wrap(err, "failed to migrate config")
	}

	//copy files to destinationStore
	err = destinationStore.SetFile(*sourceStoreConfig.SamlSettings.IdpCertificateFile, idpCertificateFile)
	if err != nil {
		return errors.Wrap(err, "failed to migrate config")
	}

	err = destinationStore.SetFile(*sourceStoreConfig.SamlSettings.PublicCertificateFile, publicCertificateFile)
	if err != nil {
		return errors.Wrap(err, "failed to migrate config")
	}

	err = destinationStore.SetFile(*sourceStoreConfig.SamlSettings.PrivateKeyFile, privateKeyFile)
	if err != nil {
		return errors.Wrap(err, "failed to migrate config")
	}

	return nil
}
