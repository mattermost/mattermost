module github.com/mattermost/mattermost/server/public

go 1.19

require (
	github.com/blang/semver v3.5.1+incompatible
	github.com/blang/semver/v4 v4.0.0
	github.com/dyatlov/go-opengraph/opengraph v0.0.0-20220524092352-606d7b1e5f8a
	github.com/francoispqt/gojay v1.2.13
	github.com/go-sql-driver/mysql v1.7.1
	github.com/golang/mock v1.6.0
	github.com/gorilla/mux v1.8.0
	github.com/gorilla/websocket v1.5.0
	github.com/graph-gophers/graphql-go v1.5.1-0.20230110080634-edea822f558a
	github.com/hashicorp/go-hclog v1.5.0
	github.com/hashicorp/go-plugin v1.4.10
	github.com/lib/pq v1.10.9
	github.com/mattermost/go-i18n v1.11.1-0.20211013152124-5c415071e404
	github.com/mattermost/ldap v0.0.0-20201202150706-ee0e6284187d
	github.com/mattermost/logr/v2 v2.0.16
	github.com/mattermost/mattermost/server/v8 v8.0.0-00010101000000-000000000000
	github.com/nicksnyder/go-i18n/v2 v2.0.3
	github.com/pborman/uuid v1.2.1
	github.com/pkg/errors v0.9.1
	github.com/rudderlabs/analytics-go v3.3.3+incompatible
	github.com/sirupsen/logrus v1.9.3
	github.com/stretchr/testify v1.8.4
	github.com/tinylib/msgp v1.1.8
	github.com/vmihailenco/msgpack/v5 v5.3.5
	golang.org/x/crypto v0.10.0
	golang.org/x/oauth2 v0.7.0
	golang.org/x/text v0.10.0
	golang.org/x/tools v0.10.0
	gopkg.in/yaml.v2 v2.4.0
)

//replace github.com/mattermost/mattermost/server/v8 => ../

require (
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/dustin/go-humanize v1.0.1 // indirect
	github.com/fatih/color v1.15.0 // indirect
	github.com/go-asn1-ber/asn1-ber v1.5.4 // indirect
	github.com/golang-migrate/migrate/v4 v4.16.2 // indirect
	github.com/golang/protobuf v1.5.3 // indirect
	github.com/google/uuid v1.3.0 // indirect
	github.com/hashicorp/yamux v0.1.1 // indirect
	github.com/jmoiron/sqlx v1.3.5 // indirect
	github.com/json-iterator/go v1.1.12 // indirect
	github.com/kballard/go-shellquote v0.0.0-20180428030007-95032a82bc51 // indirect
	github.com/klauspost/compress v1.16.6 // indirect
	github.com/klauspost/cpuid/v2 v2.2.5 // indirect
	github.com/kr/pretty v0.3.0 // indirect
	github.com/lann/builder v0.0.0-20180802200727-47ae307949d0 // indirect
	github.com/lann/ps v0.0.0-20150810152359-62de8c46ede0 // indirect
	github.com/mattermost/morph v1.0.5-0.20230511171014-e76e25978d56 // indirect
	github.com/mattermost/squirrel v0.2.0 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.19 // indirect
	github.com/minio/md5-simd v1.1.2 // indirect
	github.com/minio/minio-go/v7 v7.0.59 // indirect
	github.com/minio/sha256-simd v1.0.1 // indirect
	github.com/mitchellh/go-testing-interface v1.14.1 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/modern-go/reflect2 v1.0.2 // indirect
	github.com/oklog/run v1.1.0 // indirect
	github.com/pelletier/go-toml v1.9.5 // indirect
	github.com/philhofer/fwd v1.1.2 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/remyoudompheng/bigfft v0.0.0-20230129092748-24d4a6f8daec // indirect
	github.com/rs/xid v1.5.0 // indirect
	github.com/segmentio/backo-go v1.0.1 // indirect
	github.com/stretchr/objx v0.5.0 // indirect
	github.com/tidwall/gjson v1.14.4 // indirect
	github.com/tidwall/match v1.1.1 // indirect
	github.com/tidwall/pretty v1.2.1 // indirect
	github.com/vmihailenco/tagparser/v2 v2.0.0 // indirect
	github.com/wiggin77/merror v1.0.5 // indirect
	github.com/wiggin77/srslog v1.0.1 // indirect
	github.com/xtgo/uuid v0.0.0-20140804021211-a0b114877d4c // indirect
	github.com/yuin/goldmark v1.5.4 // indirect
	golang.org/x/mod v0.11.0 // indirect
	golang.org/x/net v0.11.0 // indirect
	golang.org/x/sync v0.3.0 // indirect
	golang.org/x/sys v0.9.0 // indirect
	google.golang.org/appengine v1.6.7 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20230629202037-9506855d4529 // indirect
	google.golang.org/grpc v1.56.1 // indirect
	google.golang.org/protobuf v1.31.0 // indirect
	gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c // indirect
	gopkg.in/ini.v1 v1.67.0 // indirect
	gopkg.in/natefinch/lumberjack.v2 v2.2.1 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	lukechampine.com/uint128 v1.3.0 // indirect
	modernc.org/cc/v3 v3.41.0 // indirect
	modernc.org/ccgo/v3 v3.16.14 // indirect
	modernc.org/libc v1.24.1 // indirect
	modernc.org/mathutil v1.6.0 // indirect
	modernc.org/memory v1.6.0 // indirect
	modernc.org/opt v0.1.3 // indirect
	modernc.org/sqlite v1.23.1 // indirect
	modernc.org/strutil v1.1.3 // indirect
	modernc.org/token v1.1.0 // indirect
)

// Hack to prevent the willf/bitset module from being upgraded to 1.2.0.
// They changed the module path from github.com/willf/bitset to
// github.com/bits-and-blooms/bitset and a couple of dependent repos are yet
// to update their module paths.
exclude (
	github.com/RoaringBitmap/roaring v0.7.0
	github.com/RoaringBitmap/roaring v0.7.1
	github.com/dyatlov/go-opengraph v0.0.0-20210112100619-dae8665a5b09
	github.com/willf/bitset v1.2.0
)
