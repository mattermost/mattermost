// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package config

import "github.com/pkg/errors"

func Migrate(from, to string) error {
	sourceStore, err := NewStore(from, false)
	if err != nil {
		return errors.Wrapf(err, "failed to access source config %s", from)
	}

	destinationStore, err := NewStore(to, false)
	if err != nil {
		return errors.Wrapf(err, "failed to access destination config %s", to)
	}

	sourceConfig := sourceStore.Get()
	_, err = destinationStore.Set(sourceConfig)

	if err != nil {
		return errors.Wrapf(err, "failed to set config")
	}

	files := []string{*sourceConfig.SamlSettings.IdpCertificateFile, *sourceConfig.SamlSettings.PublicCertificateFile,
		*sourceConfig.SamlSettings.PrivateKeyFile}

	for _, file := range files {
		err = migrateFile(file, sourceStore, destinationStore)

		if err != nil {
			return err
		}
	}
	return nil
}

func migrateFile(file string, sourceStore Store, destinationStore Store) error {
	hasFile, err := sourceStore.HasFile(file)

	if err != nil {
		return errors.Wrapf(err, "failed to check existence of %s", file)
	}

	if hasFile {
		fileData, err := sourceStore.GetFile(file)
		err = destinationStore.SetFile(file, fileData)
		if err != nil {
			return errors.Wrapf(err, "failed to migrate %s", file)
		}
	}

	return nil
}
