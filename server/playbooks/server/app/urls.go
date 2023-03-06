package app

import "fmt"

const (
	PlaybooksPath = "/playbooks/playbooks"
	RunsPath      = "/playbooks/runs"
)

// relative urls
func GetRunDetailsRelativeURL(playbookRunID string) string {
	return fmt.Sprintf("%s/%s", RunsPath, playbookRunID)
}

func GetPlaybookDetailsRelativeURL(playbookID string) string {
	return fmt.Sprintf("%s/%s", PlaybooksPath, playbookID)
}

// absolute urls
func getRunDetailsURL(siteURL string, playbookRunID string) string {
	return fmt.Sprintf("%s%s", siteURL, GetRunDetailsRelativeURL(playbookRunID))
}

func getRunRetrospectiveURL(siteURL string, playbookRunID string) string {
	return fmt.Sprintf("%s/retrospective", getRunDetailsURL(siteURL, playbookRunID))
}

func getPlaybooksURL(siteURL string) string {
	return fmt.Sprintf("%s%s", siteURL, PlaybooksPath)
}

func getPlaybooksNewURL(siteURL string) string {
	return fmt.Sprintf("%s/new", getPlaybooksURL(siteURL))
}

func getPlaybookDetailsURL(siteURL string, playbookID string) string {
	return fmt.Sprintf("%s%s", siteURL, GetPlaybookDetailsRelativeURL(playbookID))
}

func getChannelURL(siteURL string, teamName string, channelName string) string {
	return fmt.Sprintf("%s/%s/channels/%s",
		siteURL,
		teamName,
		channelName,
	)
}
