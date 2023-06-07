// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"sort"
	"strings"
	"syscall"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"golang.org/x/term"

	"github.com/mattermost/mattermost-server/server/public/model"

	"github.com/mattermost/mattermost-server/server/v8/cmd/mmctl/printer"
)

var AuthCmd = &cobra.Command{
	Use:   "auth",
	Short: "Manages the credentials of the remote Mattermost instances",
}

var LoginCmd = &cobra.Command{
	Use:   "login [instance url] --name [server name] --username [username] --password-file [password-file]",
	Short: "Login into an instance",
	Long:  "Login into an instance and store credentials",
	Example: `  auth login https://mattermost.example.com
  auth login https://mattermost.example.com --name local-server --username sysadmin --password-file mysupersecret.txt
  auth login https://mattermost.example.com --name local-server --username sysadmin --password-file mysupersecret.txt --mfa-token 123456
  auth login https://mattermost.example.com --name local-server --access-token myaccesstoken`,
	Args: cobra.ExactArgs(1),
	RunE: loginCmdF,
}

var CurrentCmd = &cobra.Command{
	Use:     "current",
	Short:   "Show current user credentials",
	Long:    "Show the currently stored user credentials",
	Example: `  auth current`,
	RunE:    currentCmdF,
}

var SetCmd = &cobra.Command{
	Use:     "set [server name]",
	Short:   "Set the credentials to use",
	Long:    "Set an credentials to use in the following commands",
	Example: `  auth set local-server`,
	Args:    cobra.ExactArgs(1),
	RunE:    setCmdF,
}

var ListCmd = &cobra.Command{
	Use:     "list",
	Short:   "Lists the credentials",
	Long:    "Print a list of the registered credentials",
	Example: `  auth list`,
	RunE:    listCmdF,
}

var RenewCmd = &cobra.Command{
	Use:     "renew",
	Short:   "Renews a set of credentials",
	Long:    "Renews the credentials for a given server",
	Example: `  auth renew local-server`,
	Args:    cobra.ExactArgs(1),
	RunE:    renewCmdF,
}

var DeleteCmd = &cobra.Command{
	Use:     "delete [server name]",
	Short:   "Delete an credentials",
	Long:    "Delete an credentials by its name",
	Example: `  auth delete local-server`,
	Args:    cobra.ExactArgs(1),
	RunE:    deleteCmdF,
}

var CleanCmd = &cobra.Command{
	Use:     "clean",
	Short:   "Clean all credentials",
	Long:    "Clean the currently stored credentials",
	Example: `  auth clean`,
	RunE:    cleanCmdF,
}

func init() {
	LoginCmd.Flags().StringP("name", "n", "", "Name for the credentials")
	LoginCmd.Flags().StringP("username", "u", "", "Username for the credentials")
	LoginCmd.Flags().StringP("access-token", "a", "", "Access token to use instead of username/password")
	_ = LoginCmd.Flags().MarkHidden("access-token")
	LoginCmd.Flags().StringP("access-token-file", "t", "", "Access token file to be read to use instead of username/password")
	LoginCmd.Flags().StringP("mfa-token", "m", "", "MFA token for the credentials")
	LoginCmd.Flags().StringP("password", "p", "", "Password for the credentials")
	_ = LoginCmd.Flags().MarkHidden("password")
	LoginCmd.Flags().StringP("password-file", "f", "", "Password file to be read for the credentials")
	LoginCmd.Flags().Bool("no-activate", false, "If present, it won't activate the credentials after login")

	RenewCmd.Flags().StringP("password", "p", "", "Password for the credentials")
	_ = RenewCmd.Flags().MarkHidden("password")
	RenewCmd.Flags().StringP("password-file", "f", "", "Password file to be read for the credentials")
	RenewCmd.Flags().StringP("access-token", "a", "", "Access token to use instead of username/password")
	_ = RenewCmd.Flags().MarkHidden("access-token")
	RenewCmd.Flags().StringP("access-token-file", "t", "", "Access token file to be read to use instead of username/password")
	RenewCmd.Flags().StringP("mfa-token", "m", "", "MFA token for the credentials")

	AuthCmd.AddCommand(
		LoginCmd,
		CurrentCmd,
		SetCmd,
		ListCmd,
		RenewCmd,
		DeleteCmd,
		CleanCmd,
	)

	RootCmd.AddCommand(AuthCmd)
}

func loginCmdF(cmd *cobra.Command, args []string) error {
	name, err := cmd.Flags().GetString("name")
	if err != nil {
		return err
	}
	username, err := cmd.Flags().GetString("username")
	if err != nil {
		return err
	}
	password, err := cmd.Flags().GetString("password")
	if err != nil {
		return err
	}
	passwordFile, _ := cmd.Flags().GetString("password-file")
	if password != "" && passwordFile != "" {
		return errors.New("cannot use two passwords at the same time")
	}
	if fErr := readSecretFromFile(passwordFile, &password); fErr != nil {
		return fmt.Errorf("could not read the password: %w", fErr)
	}

	accessToken, err := cmd.Flags().GetString("access-token")
	if err != nil {
		return err
	}
	accessTokenFile, _ := cmd.Flags().GetString("access-token-file")
	if accessToken != "" && accessTokenFile != "" {
		return errors.New("cannot use two access tokens at the same time")
	}
	if fErr := readSecretFromFile(accessTokenFile, &accessToken); fErr != nil {
		return fmt.Errorf("could not read the access-token: %w", fErr)
	}

	mfaToken, err := cmd.Flags().GetString("mfa-token")
	if err != nil {
		return err
	}

	allowInsecureSHA1 := viper.GetBool("insecure-sha1-intermediate")
	allowInsecureTLS := viper.GetBool("insecure-tls-version")

	url := strings.TrimRight(args[0], "/")
	method := MethodPassword

	ctx := context.TODO()

	if name == "" {
		reader := bufio.NewReader(os.Stdin)
		fmt.Printf("Connection name: ")
		name, err = reader.ReadString('\n')
		if err != nil {
			return err
		}
		name = strings.TrimSpace(name)
	}

	if accessToken != "" && username != "" {
		return errors.New("you must use --access-token or --username, but not both")
	}

	if accessToken == "" && username == "" {
		reader := bufio.NewReader(os.Stdin)
		fmt.Printf("Username: ")
		username, err = reader.ReadString('\n')
		if err != nil {
			return err
		}
		username = strings.TrimSpace(username)
	}

	if username != "" && password == "" {
		fmt.Printf("Password: ")
		stdinPassword, err := getPasswordFromStdin()
		if err != nil {
			return errors.WithMessage(err, "couldn't read password")
		}
		password = stdinPassword
	}

	if username != "" {
		var c *model.Client4
		var err error
		if mfaToken != "" {
			c, _, err = InitClientWithMFA(ctx, username, password, mfaToken, url, allowInsecureSHA1, allowInsecureTLS)
			method = MethodMFA
		} else {
			c, _, err = InitClientWithUsernameAndPassword(ctx, username, password, url, allowInsecureSHA1, allowInsecureTLS)
		}
		if err != nil {
			return fmt.Errorf("could not initiate client: %w", err)
		}
		accessToken = c.AuthToken
	} else {
		username = "Personal Access Token"
		method = MethodToken
		credentials := Credentials{
			InstanceURL: url,
			AuthToken:   accessToken,
		}
		if _, _, err := InitClientWithCredentials(ctx, &credentials, allowInsecureSHA1, allowInsecureTLS); err != nil {
			return fmt.Errorf("could not initiate client: %w", err)
		}
	}

	credentials := Credentials{
		Name:        name,
		InstanceURL: url,
		Username:    username,
		AuthToken:   accessToken,
		AuthMethod:  method,
	}

	if err := SaveCredentials(credentials); err != nil {
		return err
	}

	noActivate, _ := cmd.Flags().GetBool("no-activate")
	if !noActivate {
		if err := SetCurrent(name); err != nil {
			return err
		}
	}

	printer.Print(fmt.Sprintf("\n  credentials for %q: \"%s@%s\" stored\n", name, username, url))
	return nil
}

func getPasswordFromStdin() (string, error) {
	// syscall.Stdin is of type int in all architectures but in
	// windows, so we have to cast it to ensure cross compatibility
	//nolint:unconvert
	bytePassword, err := term.ReadPassword(int(syscall.Stdin))
	fmt.Println("")
	if err != nil {
		return "", err
	}
	return string(bytePassword), nil
}

func currentCmdF(cmd *cobra.Command, args []string) error {
	credentials, err := GetCurrentCredentials()
	if err != nil {
		return err
	}

	printer.Print(fmt.Sprintf("\n  found credentials for %q: \"%s@%s\"\n", credentials.Name, credentials.Username, credentials.InstanceURL))
	return nil
}

func setCmdF(cmd *cobra.Command, args []string) error {
	if err := SetCurrent(args[0]); err != nil {
		return err
	}

	printer.Print(fmt.Sprintf("Credentials for server %q set as active", args[0]))

	return nil
}

func listCmdF(cmd *cobra.Command, args []string) error {
	credentialsList, err := ReadCredentialsList()
	if err != nil {
		return err
	}

	if len(*credentialsList) == 0 {
		return errors.New("there are no registered credentials, maybe you need to use login first")
	}

	serverNames := []string{}
	var maxNameLen, maxUsernameLen, maxInstanceURLLen int
	for _, c := range *credentialsList {
		serverNames = append(serverNames, c.Name)
		if maxNameLen <= len(c.Name) {
			maxNameLen = len(c.Name)
		}
		if maxUsernameLen <= len(c.Username) {
			maxUsernameLen = len(c.Username)
		}
		if maxInstanceURLLen <= len(c.InstanceURL) {
			maxInstanceURLLen = len(c.InstanceURL)
		}
	}
	sort.Slice(serverNames, func(i, j int) bool {
		return serverNames[i] < serverNames[j]
	})

	printer.Print(fmt.Sprintf("\n    | Active | %*s | %*s | %*s |", maxNameLen, "Name", maxUsernameLen, "Username", maxInstanceURLLen, "InstanceURL"))
	printer.Print(fmt.Sprintf("    |%s|%s|%s|%s|", strings.Repeat("-", 8), strings.Repeat("-", maxNameLen+2), strings.Repeat("-", maxUsernameLen+2), strings.Repeat("-", maxInstanceURLLen+2)))
	for _, name := range serverNames {
		c := (*credentialsList)[name]
		if c.Active {
			printer.Print(fmt.Sprintf("    |      * | %*s | %*s | %*s |", maxNameLen, c.Name, maxUsernameLen, c.Username, maxInstanceURLLen, c.InstanceURL))
		} else {
			printer.Print(fmt.Sprintf("    |        | %*s | %*s | %*s |", maxNameLen, c.Name, maxUsernameLen, c.Username, maxInstanceURLLen, c.InstanceURL))
		}
	}
	printer.Print("")
	return nil
}

func renewCmdF(cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)
	password, _ := cmd.Flags().GetString("password")
	passwordFile, _ := cmd.Flags().GetString("password-file")
	if password != "" && passwordFile != "" {
		return errors.New("cannot use two passwords at the same time")
	}
	if fErr := readSecretFromFile(passwordFile, &password); fErr != nil {
		return fmt.Errorf("could not read the password: %w", fErr)
	}

	accessToken, _ := cmd.Flags().GetString("access-token")
	accessTokenFile, _ := cmd.Flags().GetString("access-token-file")
	if accessToken != "" && accessTokenFile != "" {
		return errors.New("cannot use two access tokens at the same time")
	}
	if fErr := readSecretFromFile(accessTokenFile, &accessToken); fErr != nil {
		return fmt.Errorf("could not read the access-token: %w", fErr)
	}

	mfaToken, _ := cmd.Flags().GetString("mfa-token")
	allowInsecureSHA1 := viper.GetBool("insecure-sha1-intermediate")
	allowInsecureTLS := viper.GetBool("insecure-tls-version")

	credentials, err := GetCredentials(args[0])
	if err != nil {
		return err
	}

	ctx := context.TODO()

	if (credentials.AuthMethod == MethodPassword || credentials.AuthMethod == MethodMFA) && password == "" {
		if password == "" {
			fmt.Printf("Password: ")
			stdinPassword, err := getPasswordFromStdin()
			if err != nil {
				return errors.WithMessage(err, "couldn't read password")
			}
			password = stdinPassword
		}
	}

	switch credentials.AuthMethod {
	case MethodPassword:
		c, _, err := InitClientWithUsernameAndPassword(ctx, credentials.Username, password, credentials.InstanceURL, allowInsecureSHA1, allowInsecureTLS)
		if err != nil {
			return err
		}

		credentials.AuthToken = c.AuthToken

	case MethodToken:
		if accessToken == "" {
			return errors.New("requires the --access-token parameter to be set")
		}

		credentials.AuthToken = accessToken
		if _, _, err := InitClientWithCredentials(ctx, credentials, allowInsecureSHA1, allowInsecureTLS); err != nil {
			return err
		}

	case MethodMFA:
		if mfaToken == "" {
			return errors.New("requires the --mfa-token parameter to be set")
		}

		c, _, err := InitClientWithMFA(ctx, credentials.Username, password, mfaToken, credentials.InstanceURL, allowInsecureSHA1, allowInsecureTLS)
		if err != nil {
			return err
		}
		credentials.AuthToken = c.AuthToken

	default:
		return errors.Errorf("invalid auth method %q", credentials.AuthMethod)
	}

	if err := SaveCredentials(*credentials); err != nil {
		return err
	}

	printer.PrintT("Credentials for server \"{{.Name}}\" successfully renewed", credentials)

	return nil
}

func deleteCmdF(cmd *cobra.Command, args []string) error {
	credentialsList, err := ReadCredentialsList()
	if err != nil {
		return err
	}

	name := args[0]
	credentials := (*credentialsList)[name]
	if credentials == nil {
		return errors.Errorf("cannot find credentials for server name %q", name)
	}

	delete(*credentialsList, name)
	return SaveCredentialsList(credentialsList)
}

func cleanCmdF(cmd *cobra.Command, args []string) error {
	if err := CleanCredentials(); err != nil {
		return err
	}
	return nil
}
