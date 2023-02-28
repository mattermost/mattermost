// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"flag"
	"os"
	"testing"

	"github.com/mattermost/mattermost-server/v6/channels/api4"
	"github.com/mattermost/mattermost-server/v6/channels/testlib"
	"github.com/mattermost/mattermost-server/v6/model"
)

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

type TestConfig struct {
	TestServiceSettings       TestServiceSettings
	TestTeamSettings          TestTeamSettings
	TestClientRequirements    TestClientRequirements
	TestMessageExportSettings TestMessageExportSettings
}

type TestMessageExportSettings struct {
	Enableexport            bool
	Exportformat            string
	TestGlobalRelaySettings TestGlobalRelaySettings
}

type TestGlobalRelaySettings struct {
	Customertype string
	Smtpusername string
	Smtppassword string
}

type TestServiceSettings struct {
	Siteurl               string
	Websocketurl          string
	Licensedfieldlocation string
}

type TestTeamSettings struct {
	Sitename       string
	Maxuserperteam int
}

type TestClientRequirements struct {
	Androidlatestversion string
	Androidminversion    string
	Desktoplatestversion string
}

type TestNewConfig struct {
	TestNewServiceSettings TestNewServiceSettings
	TestNewTeamSettings    TestNewTeamSettings
}

type TestNewServiceSettings struct {
	SiteUrl                  *string
	UseLetsEncrypt           *bool
	TLSStrictTransportMaxAge *int64
	AllowedThemes            []string
}

type TestNewTeamSettings struct {
	SiteName       *string
	MaxUserPerTeam *int
}

type TestPluginSettings struct {
	Enable                  *bool
	Directory               *string `restricted:"true"`
	Plugins                 map[string]map[string]any
	PluginStates            map[string]*model.PluginState
	SignaturePublicKeyFiles []string
}

func TestMain(m *testing.M) {
	// Command tests are run by re-invoking the test binary in question, so avoid creating
	// another container when we detect same.
	flag.Parse()
	if filter := flag.Lookup("test.run").Value.String(); filter == "ExecCommand" {
		status := m.Run()
		os.Exit(status)
		return
	}

	var options = testlib.HelperOptions{
		EnableStore:     true,
		EnableResources: true,
	}

	mainHelper = testlib.NewMainHelperWithOptions(&options)
	defer mainHelper.Close()
	api4.SetMainHelper(mainHelper)

	mainHelper.Main(m)
}
