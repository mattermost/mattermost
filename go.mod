module github.com/mattermost/mattermost-server

go 1.12

require (
	github.com/Masterminds/squirrel v1.1.0
	github.com/NYTimes/gziphandler v1.1.1
	github.com/avct/uasurfer v0.0.0-20190308134847-43c6f9a90eeb
	github.com/blang/semver v3.5.1+incompatible
	github.com/bmizerany/assert v0.0.0-20160611221934-b7ed37b82869 // indirect
	github.com/corpix/uarand v0.0.0 // indirect
	github.com/dgryski/dgoogauth v0.0.0-20190221195224-5a805980a5f3
	github.com/disintegration/imaging v1.6.0
	github.com/dyatlov/go-opengraph v0.0.0-20180429202543-816b6608b3c8
	github.com/fortytw2/leaktest v1.3.0 // indirect
	github.com/fsnotify/fsnotify v1.4.7
	github.com/go-gorp/gorp v2.0.0+incompatible // indirect
	github.com/go-ini/ini v1.42.0 // indirect
	github.com/go-ldap/ldap v3.0.2+incompatible
	github.com/go-redis/redis v6.15.2+incompatible
	github.com/go-sql-driver/mysql v1.4.1
	github.com/golang/freetype v0.0.0-20170609003504-e2365dfdc4a0
	github.com/google/uuid v1.1.1 // indirect
	github.com/gopherjs/gopherjs v0.0.0-20190309154008-847fc94819f9 // indirect
	github.com/gorilla/handlers v1.4.0
	github.com/gorilla/mux v1.7.0
	github.com/gorilla/schema v1.1.0
	github.com/gorilla/websocket v1.4.0
	github.com/hako/durafmt v0.0.0-20180520121703-7b7ae1e72ead
	github.com/hashicorp/go-hclog v0.8.0
	github.com/hashicorp/go-plugin v1.0.0
	github.com/hashicorp/go-sockaddr v1.0.2 // indirect
	github.com/hashicorp/go-uuid v1.0.1 // indirect
	github.com/hashicorp/memberlist v0.1.4-0.20190312092157-a8f83c6403e0
	github.com/hashicorp/yamux v0.0.0-20181012175058-2f1d1f20f75d // indirect
	github.com/icrowley/fake v0.0.0-20180203215853-4178557ae428
	github.com/inconshreveable/mousetrap v1.0.0 // indirect
	github.com/jaytaylor/html2text v0.0.0-20190311042500-a93a6c6ea053
	github.com/jehiah/go-strftime v0.0.0-20171201141054-1d33003b3869 // indirect
	github.com/jmoiron/sqlx v1.2.0
	github.com/konsorten/go-windows-terminal-sequences v1.0.2 // indirect
	github.com/lib/pq v1.0.0
	github.com/mailru/easyjson v0.0.0-20190312143242-1de009706dbe // indirect
	github.com/mattermost/gorp v2.0.1-0.20190301154413-3b31e9a39d05+incompatible
	github.com/mattermost/rsc v0.0.0-20160330161541-bbaefb05eaa0
	github.com/mattermost/viper v1.0.4
	github.com/mattn/go-runewidth v0.0.4 // indirect
	github.com/mattn/go-sqlite3 v1.10.0
	github.com/miekg/dns v1.1.6 // indirect
	github.com/minio/minio-go v6.0.14+incompatible
	github.com/mitchellh/go-homedir v1.1.0 // indirect
	github.com/mitchellh/go-testing-interface v1.0.0 // indirect
	github.com/nicksnyder/go-i18n v1.10.0
	github.com/olekukonko/tablewriter v0.0.1 // indirect
	github.com/onsi/ginkgo v1.8.0 // indirect
	github.com/onsi/gomega v1.5.0 // indirect
	github.com/pascaldekloe/goe v0.1.0 // indirect
	github.com/pborman/uuid v1.2.0
	github.com/pkg/errors v0.8.1
	github.com/prometheus/client_golang v0.9.3-0.20190127221311-3c4408c8b829
	github.com/prometheus/client_model v0.0.0-20190129233127-fd36f4220a90 // indirect
	github.com/prometheus/procfs v0.0.0-20190322151404-55ae3d9d5573 // indirect
	github.com/rs/cors v1.6.0
	github.com/rwcarlsen/goexif v0.0.0-20190318171057-76e3344f7516
	github.com/segmentio/analytics-go v2.0.1-0.20160426181448-2d840d861c32+incompatible
	github.com/segmentio/backo-go v0.0.0-20160424052352-204274ad699c // indirect
	github.com/sirupsen/logrus v1.4.0
	github.com/smartystreets/assertions v0.0.0-20190215210624-980c5ac6f3ac // indirect
	github.com/smartystreets/goconvey v0.0.0-20190306220146-200a235640ff // indirect
	github.com/spf13/afero v1.2.2 // indirect
	github.com/spf13/cobra v0.0.3
	github.com/spf13/jwalterweatherman v1.1.0 // indirect
	github.com/ssor/bom v0.0.0-20170718123548-6386211fdfcf // indirect
	github.com/stretchr/testify v1.3.0
	github.com/throttled/throttled v2.2.4+incompatible
	github.com/tylerb/graceful v1.2.15
	github.com/xtgo/uuid v0.0.0-20140804021211-a0b114877d4c // indirect
	github.com/ziutek/mymysql v1.5.4 // indirect
	go.uber.org/atomic v1.3.2 // indirect
	go.uber.org/multierr v1.1.0 // indirect
	go.uber.org/zap v1.9.1
	golang.org/x/crypto v0.0.0-20190325154230-a5d413f7728c
	golang.org/x/image v0.0.0-20190321063152-3fc05d484e9f
	golang.org/x/net v0.0.0-20190326090315-15845e8f865b
	golang.org/x/text v0.3.1-0.20180807135948-17ff2d5776d2
	gopkg.in/alexcesaro/quotedprintable.v3 v3.0.0-20150716171945-2caba252f4dc // indirect
	gopkg.in/asn1-ber.v1 v1.0.0-20181015200546-f715ec2f112d // indirect
	gopkg.in/ini.v1 v1.42.0 // indirect
	gopkg.in/mail.v2 v2.3.1
	gopkg.in/natefinch/lumberjack.v2 v2.0.0
	gopkg.in/olivere/elastic.v5 v5.0.79
	gopkg.in/yaml.v2 v2.2.2
	willnorris.com/go/imageproxy v0.8.1-0.20190326225038-cf54b2cf2c9e
)

// Workaround for https://github.com/golang/go/issues/30831 and fallout.
replace github.com/golang/lint => github.com/golang/lint v0.0.0-20190227174305-8f45f776aaf1
