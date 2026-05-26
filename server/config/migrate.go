// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import "fmt"

// Migrate migrates SAML keys, certificates, and other config files from one store to another given their data source names.
func Migrate(from, to string) error {
	source, err := NewStoreFromDSN(from, false, nil, false)
	if err != nil {
		return fmt.Errorf("failed to access source config %s: %w", from, err)
	}
	defer source.Close()

	destination, err := NewStoreFromDSN(to, false, nil, true)
	if err != nil {
		return fmt.Errorf("failed to access destination config %s: %w", to, err)
	}
	defer destination.Close()

	sourceConfig := source.Get()
	if _, _, err = destination.Set(sourceConfig); err != nil {
		return fmt.Errorf("failed to set config: %w", err)
	}

	files := []string{
		*sourceConfig.SamlSettings.IdpCertificateFile,
		*sourceConfig.SamlSettings.PublicCertificateFile,
		*sourceConfig.SamlSettings.PrivateKeyFile,
	}

	// Only migrate advanced logging config if it is a filespec.
	dsn := sourceConfig.LogSettings.GetAdvancedLoggingConfig()
	cfgSource, err := NewLogConfigSrc(dsn, source)
	if err == nil && cfgSource.GetType() == LogConfigSrcTypeFile {
		files = append(files, string(dsn))
	}

	files = append(files, sourceConfig.PluginSettings.SignaturePublicKeyFiles...)

	for _, file := range files {
		if err := migrateFile(file, source, destination); err != nil {
			return err
		}
	}

	return nil
}

func migrateFile(name string, source *Store, destination *Store) error {
	fileExists, err := source.HasFile(name)
	if err != nil {
		return fmt.Errorf("failed to check existence of %s: %w", name, err)
	}

	if fileExists {
		file, err := source.GetFile(name)
		if err != nil {
			return fmt.Errorf("failed to migrate %s: %w", name, err)
		}
		err = destination.SetFile(name, file)
		if err != nil {
			return fmt.Errorf("failed to migrate %s: %w", name, err)
		}
	}

	return nil
}
