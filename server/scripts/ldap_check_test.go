// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package scripts_test

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	extraCommandMarker = "extra_command_ran"
	bindPassword       = "ldap-bind-pw-7c3e91aa"
	dashLeadingToken   = "-not-an-ldapsearch-flag"
)

type ldapSettings struct {
	LdapServer         string `json:"LdapServer"`
	LdapPort           string `json:"LdapPort"`
	ConnectionSecurity string `json:"ConnectionSecurity"`
	BindUsername       string `json:"BindUsername"`
	BindPassword       string `json:"BindPassword"`
	BaseDN             string `json:"BaseDN"`
	UserFilter         string `json:"UserFilter"`
	EmailAttribute     string `json:"EmailAttribute"`
	UsernameAttribute  string `json:"UsernameAttribute"`
	IdAttribute        string `json:"IdAttribute"`
	GroupFilter        string `json:"GroupFilter"`
	GroupIdAttribute   string `json:"GroupIdAttribute"`
}

type ldapCheckResult struct {
	stdout          string
	stderr          string
	argv            []string
	invoked         bool
	extraCommandRan bool
}

func defaultLDAPSettings() ldapSettings {
	return ldapSettings{
		LdapServer:         "ldap.example.com",
		LdapPort:           "389",
		ConnectionSecurity: "",
		BindUsername:       "cn=admin,dc=example,dc=com",
		BindPassword:       bindPassword,
		BaseDN:             "dc=example,dc=com",
		UserFilter:         "(objectClass=user)",
		EmailAttribute:     "mail",
		UsernameAttribute:  "sAMAccountName",
		IdAttribute:        "uid",
		GroupFilter:        "(objectClass=group)",
		GroupIdAttribute:   "cn",
	}
}

func ldapCheckScriptPath(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	require.True(t, ok)
	return filepath.Join(filepath.Dir(file), "ldap-check.sh")
}

func argsBeforeDoubleDash(argv []string) []string {
	for i, arg := range argv {
		if arg == "--" {
			return argv[:i]
		}
	}
	return argv
}

func runLdapCheck(t *testing.T, settings ldapSettings, args []string) ldapCheckResult {
	t.Helper()

	_, err := exec.LookPath("jq")
	require.NoError(t, err, "jq must be on PATH")

	workdir := t.TempDir()
	binDir := filepath.Join(workdir, "bin")
	require.NoError(t, os.Mkdir(binDir, 0o755))

	argvFile := filepath.Join(workdir, "ldapsearch.argv")
	stub := "#!/bin/bash\nprintf '%s\\0' \"$@\" > \"${LDAPCHECK_ARGV_FILE}\"\nexit 0\n"
	require.NoError(t, os.WriteFile(filepath.Join(binDir, "ldapsearch"), []byte(stub), 0o755))

	cfg, err := json.Marshal(struct {
		LdapSettings ldapSettings `json:"LdapSettings"`
	}{LdapSettings: settings})
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(workdir, "config.json"), cfg, 0o644))

	cmd := exec.Command("bash", append([]string{ldapCheckScriptPath(t)}, args...)...)
	cmd.Dir = workdir
	cmd.Env = withEnv(os.Environ(), map[string]string{
		"PATH":                binDir + string(os.PathListSeparator) + os.Getenv("PATH"),
		"LDAPCHECK_ARGV_FILE": argvFile,
	})
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	_ = cmd.Run()

	result := ldapCheckResult{
		stdout:          stdout.String(),
		stderr:          stderr.String(),
		extraCommandRan: fileExists(filepath.Join(workdir, extraCommandMarker)),
	}
	if raw, readErr := os.ReadFile(argvFile); readErr == nil {
		result.invoked = true
		result.argv = splitNUL(raw)
	}
	return result
}

func withEnv(env []string, overrides map[string]string) []string {
	out := make([]string, 0, len(env)+len(overrides))
	replaced := make(map[string]bool, len(overrides))
	for _, entry := range env {
		key, _, found := strings.Cut(entry, "=")
		if found {
			if value, ok := overrides[key]; ok {
				out = append(out, key+"="+value)
				replaced[key] = true
				continue
			}
		}
		out = append(out, entry)
	}
	for key, value := range overrides {
		if !replaced[key] {
			out = append(out, key+"="+value)
		}
	}
	return out
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func splitNUL(raw []byte) []string {
	raw = bytes.TrimRight(raw, "\x00")
	if len(raw) == 0 {
		return nil
	}
	parts := bytes.Split(raw, []byte{0})
	out := make([]string, len(parts))
	for i, part := range parts {
		out[i] = string(part)
	}
	return out
}

func TestLdapCheckInvokesLdapsearch(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		args       []string
		wantFilter string
		wantAttrs  []string
	}{
		{
			name:       "user_mode",
			args:       []string{"-u", "john"},
			wantFilter: "(&(uid=john)(objectClass=user))",
			wantAttrs:  []string{"uid", "sAMAccountName", "mail"},
		},
		{
			name:       "group_mode",
			args:       []string{"-g", "admin-staff"},
			wantFilter: "(&(cn=admin-staff)(objectClass=group))",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := runLdapCheck(t, defaultLDAPSettings(), tc.args)
			require.True(t, got.invoked, "ldapsearch should be invoked")
			require.Contains(t, got.argv, tc.wantFilter)
			for _, attr := range tc.wantAttrs {
				require.Contains(t, got.argv, attr)
			}
		})
	}
}

func TestLdapCheckTreatsConfigValuesAsData(t *testing.T) {
	t.Parallel()

	idAttributeWithPunctuation := "uid;touch " + extraCommandMarker + ";echo"
	usernameAttributeWithPunctuation := "sAMAccountName;touch " + extraCommandMarker + ";echo"
	emailAttributeWithPunctuation := "mail;touch " + extraCommandMarker + ";echo"
	groupIdAttributeWithPunctuation := "cn;touch " + extraCommandMarker + ";echo"
	dollarParenValue := "$(touch " + extraCommandMarker + ")"
	baseDNWithQuotes := `dc=example,dc=com";touch ` + extraCommandMarker + `;echo "`
	bindUsernameWithQuotes := `cn=admin,dc=example,dc=com";touch ` + extraCommandMarker + `;echo "`
	bindUsernameWithUnicodeQuote := "cn=admin\u201c;touch " + extraCommandMarker
	ldapServerDollarParen := "ldap.example.com" + dollarParenValue
	bindPasswordWithNewline := bindPassword + "\ntouch " + extraCommandMarker

	cases := []struct {
		name                    string
		args                    []string
		mutate                  func(*ldapSettings)
		forbidExtraCommand      bool
		forbidPasswordStdout    bool
		forbidPasswordArgv      bool
		forbidDashLeadingOption bool
		wantArgs                []string
		wantPrinted             string
	}{
		{
			name: "basedn_characters",
			args: []string{"-u", "john"},
			mutate: func(s *ldapSettings) {
				s.BaseDN = baseDNWithQuotes
			},
			forbidExtraCommand: true,
		},
		{
			name: "bind_username_characters",
			args: []string{"-u", "john"},
			mutate: func(s *ldapSettings) {
				s.BindUsername = bindUsernameWithQuotes
			},
			forbidExtraCommand: true,
		},
		{
			name: "user_filter_characters",
			args: []string{"-u", "john"},
			mutate: func(s *ldapSettings) {
				s.UserFilter = "`touch " + extraCommandMarker + "`"
			},
			forbidExtraCommand: true,
		},
		{
			name: "attribute_names",
			args: []string{"-u", "john"},
			mutate: func(s *ldapSettings) {
				s.IdAttribute = idAttributeWithPunctuation
			},
			forbidExtraCommand: true,
			wantArgs:           []string{idAttributeWithPunctuation},
		},
		{
			name: "username_and_email_attribute_names",
			args: []string{"-u", "john"},
			mutate: func(s *ldapSettings) {
				s.UsernameAttribute = usernameAttributeWithPunctuation
				s.EmailAttribute = emailAttributeWithPunctuation
			},
			forbidExtraCommand: true,
			wantArgs:           []string{usernameAttributeWithPunctuation, emailAttributeWithPunctuation},
		},
		{
			name: "user_filter_dollar_characters",
			args: []string{"-u", "john"},
			mutate: func(s *ldapSettings) {
				s.UserFilter = dollarParenValue
			},
			forbidExtraCommand: true,
		},
		{
			name: "group_config_values",
			args: []string{"-g", "admin-staff"},
			mutate: func(s *ldapSettings) {
				s.GroupFilter = dollarParenValue
				s.GroupIdAttribute = groupIdAttributeWithPunctuation
			},
			forbidExtraCommand: true,
			wantArgs: []string{
				"(&(" + groupIdAttributeWithPunctuation + "=admin-staff)" + dollarParenValue + ")",
			},
		},
		{
			name: "starttls_config_values",
			args: []string{"-u", "john"},
			mutate: func(s *ldapSettings) {
				s.ConnectionSecurity = "STARTTLS"
				s.BaseDN = baseDNWithQuotes
			},
			forbidExtraCommand: true,
			wantArgs:           []string{"-ZZ", baseDNWithQuotes},
			wantPrinted:        "-ZZ",
		},
		{
			name: "tls_config_values",
			args: []string{"-u", "john"},
			mutate: func(s *ldapSettings) {
				s.ConnectionSecurity = "TLS"
				s.BaseDN = baseDNWithQuotes
			},
			forbidExtraCommand: true,
			wantArgs:           []string{"ldaps://ldap.example.com:389", baseDNWithQuotes},
			wantPrinted:        "ldaps://ldap.example.com:389",
		},
		{
			name: "bind_password_multiline",
			args: []string{"-u", "john"},
			mutate: func(s *ldapSettings) {
				s.BindPassword = bindPasswordWithNewline
			},
			forbidExtraCommand:   true,
			forbidPasswordStdout: true,
			forbidPasswordArgv:   true,
			wantArgs:             []string{"-y"},
		},
		{
			name: "bind_username_unicode_characters",
			args: []string{"-u", "john"},
			mutate: func(s *ldapSettings) {
				s.BindUsername = bindUsernameWithUnicodeQuote
			},
			forbidExtraCommand: true,
			wantArgs:           []string{bindUsernameWithUnicodeQuote},
		},
		{
			name: "ldap_uri_characters",
			args: []string{"-u", "john"},
			mutate: func(s *ldapSettings) {
				s.LdapServer = ldapServerDollarParen
			},
			forbidExtraCommand: true,
			wantArgs:           []string{"ldap://" + ldapServerDollarParen + ":389"},
		},
		{
			name:                 "bind_password_stdout",
			args:                 []string{"-u", "john"},
			forbidPasswordStdout: true,
		},
		{
			name:               "bind_password_argv",
			args:               []string{"-u", "john"},
			forbidPasswordArgv: true,
		},
		{
			name: "dash_leading_filter",
			args: []string{"-u", "john"},
			mutate: func(s *ldapSettings) {
				s.IdAttribute = dashLeadingToken
			},
			forbidDashLeadingOption: true,
		},
		{
			name: "dash_leading_attribute",
			args: []string{"-u", "john"},
			mutate: func(s *ldapSettings) {
				s.UsernameAttribute = dashLeadingToken
			},
			forbidDashLeadingOption: true,
			wantArgs:                []string{dashLeadingToken},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			settings := defaultLDAPSettings()
			if tc.mutate != nil {
				tc.mutate(&settings)
			}
			got := runLdapCheck(t, settings, tc.args)

			if tc.forbidExtraCommand || len(tc.wantArgs) > 0 || tc.wantPrinted != "" {
				require.True(t, got.invoked, "ldapsearch should be invoked")
			}
			if tc.forbidExtraCommand {
				assert.False(t, got.extraCommandRan, "configured values should not create %s", extraCommandMarker)
			}
			if tc.forbidPasswordStdout {
				combined := got.stdout + got.stderr
				assert.NotContains(t, combined, bindPassword, "bind password should not appear on stdout or stderr")
			}
			if tc.forbidPasswordArgv {
				assert.NotContains(t, got.argv, bindPassword, "bind password should not appear in the ldapsearch argument list")
			}
			if tc.forbidDashLeadingOption {
				require.True(t, got.invoked, "ldapsearch should be invoked")
				assert.NotContains(t, argsBeforeDoubleDash(got.argv), dashLeadingToken, "a dash-leading value should be passed as a filter or attribute argument, not as an ldapsearch option")
			}
			for _, arg := range tc.wantArgs {
				assert.Contains(t, got.argv, arg, "configured values should be passed as ldapsearch arguments")
			}
			if tc.wantPrinted != "" {
				assert.Contains(t, got.stdout, tc.wantPrinted, "printed command should include the executed ldapsearch arguments")
			}
		})
	}
}
