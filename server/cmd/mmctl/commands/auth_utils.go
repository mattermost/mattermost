// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"encoding/json"
	"os"
	"os/user"
	"path/filepath"
	"strings"
	"sync"

	"github.com/pkg/errors"
	"github.com/spf13/viper"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

const (
	MethodPassword = "P"
	MethodToken    = "T"
	MethodMFA      = "M"

	userHomeVar      = "$HOME"
	configFileName   = "config"
	configParent     = "mmctl"
	xdgConfigHomeVar = "$XDG_CONFIG_HOME"
)

var once sync.Once

type Credentials struct {
	Name        string `json:"name"`
	Username    string `json:"username"`
	AuthToken   string `json:"authToken"`
	AuthMethod  string `json:"authMethod"`
	InstanceURL string `json:"instanceUrl"`
	Active      bool   `json:"active"`
}

type CredentialsList map[string]*Credentials

var currentUser *user.User

func init() {
	newUser, err := user.Current()
	if err != nil {
		panic(err)
	}

	SetUser(newUser)
}

func getDefaultConfigHomePath() string {
	if p, ok := os.LookupEnv(strings.TrimPrefix(xdgConfigHomeVar, "$")); ok {
		return p
	}

	return filepath.Join(currentUser.HomeDir, ".config")
}

func resolveLegacyConfigFilePath() string {
	configPath := viper.GetString("config-path")
	// We use the .mmctl file name (hidden) if the config is in $HOME directory.
	// If we were using other directory (e.g. XDG_CONFIG_HOME) we go with mmctl file name.
	switch configPath {
	case "$HOME":
		res := strings.Replace(configPath, userHomeVar, currentUser.HomeDir, 1)
		return filepath.Join(res, ".mmctl")
	case currentUser.HomeDir:
		return filepath.Join(configPath, ".mmctl")
	default:
		return filepath.Join(configPath, "mmctl")
	}
}

func resolveConfigFilePath() string {
	// we warn users that config-path is deprecated
	suppressWarnings := viper.GetBool("suppress-warnings")

	if viper.IsSet("config-path") {
		if !suppressWarnings {
			once.Do(func() {
				printer.PrintWarning("Since mmctl v6 we have been deprecated the --config-path and started to use --config flag instead.\n" +
					"Please use --config flag to set config file. (note that --config-path was pointing to a directory)\n\n" +
					"After moving your config file to new directory, please unset the --config-path flag or MMCTL_CONFIG_PATH environment variable.\n")
			})
		}

		return resolveLegacyConfigFilePath()
	}

	// resolve env vars if there are any
	fpath := strings.Replace(viper.GetString("config"), userHomeVar, currentUser.HomeDir, 1)

	return strings.Replace(fpath, xdgConfigHomeVar, getDefaultConfigHomePath(), 1)
}

func ReadCredentialsList() (*CredentialsList, error) {
	configPath := resolveConfigFilePath()

	if _, err := os.Stat(configPath); err != nil {
		return nil, errors.WithMessage(err, "cannot read user credentials, maybe you need to use login first")
	}

	fileContents, err := os.ReadFile(configPath)
	if err != nil {
		return nil, errors.WithMessage(err, "there was a problem reading the credentials file")
	}

	var credentialsList CredentialsList
	if err := json.Unmarshal(fileContents, &credentialsList); err != nil {
		return nil, errors.WithMessage(err, "there was a problem parsing the credentials file")
	}

	return &credentialsList, nil
}

func GetCurrentCredentials() (*Credentials, error) {
	credentialsList, err := ReadCredentialsList()
	if err != nil {
		return nil, err
	}

	for _, c := range *credentialsList {
		if c.Active {
			return c, nil
		}
	}
	return nil, errors.Errorf("no current context available. please use the %q command", "auth set")
}

func GetCredentials(name string) (*Credentials, error) {
	credentialsList, err := ReadCredentialsList()
	if err != nil {
		return nil, err
	}

	for _, c := range *credentialsList {
		if c.Name == name {
			return c, nil
		}
	}
	return nil, errors.Errorf("couldn't find credentials for connection %q", name)
}

func SaveCredentials(credentials Credentials) error {
	credentialsList, err := ReadCredentialsList()
	if err != nil {
		// we get the parent of the file so that we can create the path if it doesn't exist.
		configParent := filepath.Dir(resolveConfigFilePath())
		if err := os.MkdirAll(configParent, 0700); err != nil {
			return err
		}
		credentialsList = &CredentialsList{}
		credentials.Active = true
	}

	(*credentialsList)[credentials.Name] = &credentials
	return SaveCredentialsList(credentialsList)
}

func SaveCredentialsList(credentialsList *CredentialsList) error {
	configPath := resolveConfigFilePath()

	marshaledCredentialsList, _ := json.MarshalIndent(credentialsList, "", "    ")

	if err := os.WriteFile(configPath, marshaledCredentialsList, 0600); err != nil {
		return errors.WithMessage(err, "cannot save the credentials")
	}

	return nil
}

func SetCurrent(name string) error {
	credentialsList, err := ReadCredentialsList()
	if err != nil {
		return err
	}

	found := false
	for _, c := range *credentialsList {
		if c.Name == name {
			found = true
			c.Active = true
		} else {
			c.Active = false
		}
	}

	if !found {
		return errors.Errorf("cannot find credentials for server %q", name)
	}

	return SaveCredentialsList(credentialsList)
}

func CleanCredentials() error {
	configFilePath := resolveConfigFilePath()

	if _, err := os.Stat(configFilePath); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	if err := os.Remove(configFilePath); err != nil {
		return err
	}
	return nil
}

func SetUser(newUser *user.User) {
	currentUser = newUser
}

// will read the scret from file, if there is one
func readSecretFromFile(file string, secret *string) error {
	if file != "" {
		b, err := os.ReadFile(file)
		if err != nil {
			return err
		}
		*secret = strings.TrimSpace(string(b))
	}

	return nil
}
