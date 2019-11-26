module pluginapi

go 1.13

require (
	github.com/mattermost/mattermost-server/v5 v5.99.99
	github.com/pkg/errors v0.8.1
	github.com/sirupsen/logrus v1.4.2
	github.com/stretchr/testify v1.4.0
)

replace github.com/mattermost/mattermost-server/v5 => github.com/lieut-data/mattermost-server/v5 v5.99.99
