// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package config

import "github.com/pkg/errors"

func Migrate(source Store, destination Store) error {

	sourceConfig := source.Get()

	_, err := destination.Set(sourceConfig)

	if err != nil {
		return errors.Wrap(err, "failed to migrate config")
	}

	IdpFile, err := source.GetFile(*sourceConfig.SamlSettings.IdpCertificateFile)

	if err != nil {
		return errors.Wrap(err, "failed to fetch SAML IDP certificate file")
	}

	err = destination.SetFile(*sourceConfig.SamlSettings.IdpCertificateFile, IdpFile)

	if err != nil {
		return errors.Wrap(err, "failed to set SAML IDP certificate file")
	}

	PublicCertificateFile, err := source.GetFile(*sourceConfig.SamlSettings.PublicCertificateFile)

	if err != nil {
		return errors.Wrap(err, "failed to fetch SAML certificate file")
	}

	err = destination.SetFile(*sourceConfig.SamlSettings.PublicCertificateFile, PublicCertificateFile)

	if err != nil {
		return errors.Wrap(err, "failed to set SAML Public certificate file")
	}

	PrivateKeyFile, err := source.GetFile(*sourceConfig.SamlSettings.PrivateKeyFile)

	if err != nil {
		return errors.Wrap(err, "failed to fetch SAML Private key file")
	}

	err = destination.SetFile(*sourceConfig.SamlSettings.PrivateKeyFile, PrivateKeyFile)

	if err != nil {
		return errors.Wrap(err, "failed to set SAML Private key file")
	}

	return nil
}
