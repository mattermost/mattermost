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

	idpCertificateFile, err := sourceStore.GetFile(*sourceConfig.SamlSettings.IdpCertificateFile)

	if idpCertificateFile != nil {
		err = destinationStore.SetFile(*sourceConfig.SamlSettings.IdpCertificateFile, idpCertificateFile)
		if err != nil {
			return errors.Wrapf(err, "failed to migrate idpCertificateFile")
		}

	}

	return nil
}
