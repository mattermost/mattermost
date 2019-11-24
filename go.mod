module pluginapi

go 1.13

require (
	github.com/go-ldap/ldap v3.0.3+incompatible // indirect
	github.com/go-redis/redis v6.15.6+incompatible // indirect
	github.com/hashicorp/go-hclog v0.10.0 // indirect
	github.com/mattermost/mattermost-server v5.11.1+incompatible // indirect
	github.com/mattermost/mattermost-server/v5 v5.99.99
	github.com/pkg/errors v0.8.1
	github.com/sirupsen/logrus v1.4.2
	github.com/stretchr/testify v1.4.0
	go.uber.org/zap v1.13.0 // indirect
	golang.org/x/crypto v0.0.0-20191119213627-4f8c1d86b1ba // indirect
	gopkg.in/yaml.v2 v2.2.7 // indirect
)

replace github.com/mattermost/mattermost-server/v5 => github.com/lieut-data/mattermost-server/v5 v5.99.99
