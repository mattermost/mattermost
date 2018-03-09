package api4

import "testing"

func TestSupportedTimezones(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()
	Client := th.Client

	supportedTimezonesFromConfig := th.App.Config().SupportedTimezones
	supportedTimezones, resp := Client.GetSupportedTimezone()

	CheckNoError(t, resp)
	for _, timezone := range supportedTimezones {
		found := false
		for _, configTimezone := range supportedTimezonesFromConfig {
			if timezone == configTimezone {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("failed to find timezone: %v", timezone)
		}
	}
}
