module github.com/mattermost/mattermost-server/v6

go 1.16

require (
	code.sajari.com/docconv v1.1.1-0.20210427001343-7b3472bc323a
	github.com/Masterminds/semver/v3 v3.1.1
	github.com/Masterminds/squirrel v1.5.0
	github.com/avct/uasurfer v0.0.0-20191028135549-26b5daa857f1
	github.com/aws/aws-sdk-go v1.38.67
	github.com/blang/semver v3.5.1+incompatible
	github.com/blevesearch/bleve v1.0.14
	github.com/cespare/xxhash/v2 v2.1.1
	github.com/dgrijalva/jwt-go v3.2.0+incompatible
	github.com/dgryski/dgoogauth v0.0.0-20190221195224-5a805980a5f3
	github.com/disintegration/imaging v1.6.2
	github.com/dyatlov/go-opengraph v0.0.0-20210112100619-dae8665a5b09
	github.com/francoispqt/gojay v1.2.13
	github.com/fsnotify/fsnotify v1.4.9
	github.com/getsentry/sentry-go v0.11.0
	github.com/go-sql-driver/mysql v1.6.0
	github.com/golang-migrate/migrate/v4 v4.14.1
	github.com/golang/freetype v0.0.0-20170609003504-e2365dfdc4a0
	github.com/gorilla/handlers v1.5.1
	github.com/gorilla/mux v1.8.0
	github.com/gorilla/schema v1.2.0
	github.com/gorilla/websocket v1.4.2
	github.com/h2non/go-is-svg v0.0.0-20160927212452-35e8c4b0612c
	github.com/hako/durafmt v0.0.0-20210608085754-5c1018a4e16b
	github.com/hashicorp/go-hclog v0.16.1
	github.com/hashicorp/go-plugin v1.4.2
	github.com/hashicorp/memberlist v0.2.4
	github.com/jaytaylor/html2text v0.0.0-20200412013138-3577fbdbcff7
	github.com/jmoiron/sqlx v1.3.4
	github.com/jonboulle/clockwork v0.2.2
	github.com/ledongthuc/pdf v0.0.0-20210621053716-e28cb8259002
	github.com/lib/pq v1.10.2
	github.com/mattermost/focalboard/server v0.0.0
	github.com/mattermost/go-i18n v1.11.0
	github.com/mattermost/gorp v1.6.2-0.20210714143452-8b50f5209a7f
	github.com/mattermost/gosaml2 v0.3.3
	github.com/mattermost/gziphandler v0.0.1
	github.com/mattermost/ldap v0.0.0-20201202150706-ee0e6284187d
	github.com/mattermost/logr/v2 v2.0.11
	github.com/mattermost/rsc v0.0.0-20160330161541-bbaefb05eaa0
	github.com/mholt/archiver/v3 v3.5.0
	github.com/minio/minio-go/v7 v7.0.11
	github.com/oov/psd v0.0.0-20210618170533-9fb823ddb631
	github.com/opentracing/opentracing-go v1.2.0
	github.com/pborman/uuid v1.2.1
	github.com/pkg/errors v0.9.1
	github.com/prometheus/client_golang v1.11.0
	github.com/prometheus/client_model v0.2.0
	github.com/reflog/dateconstraints v0.2.1
	github.com/rs/cors v1.7.0
	github.com/rudderlabs/analytics-go v3.3.1+incompatible
	github.com/russellhaering/goxmldsig v1.1.0
	github.com/rwcarlsen/goexif v0.0.0-20190401172101-9e8deecbddbd
	github.com/spf13/cobra v1.1.3
	github.com/splitio/go-client/v6 v6.1.0
	github.com/stretchr/testify v1.7.0
	github.com/throttled/throttled v2.2.5+incompatible
	github.com/tinylib/msgp v1.1.6
	github.com/tylerb/graceful v1.2.15
	github.com/uber/jaeger-client-go v2.29.1+incompatible
	github.com/uber/jaeger-lib v2.4.1+incompatible
	github.com/vmihailenco/msgpack/v5 v5.3.4
	github.com/wiggin77/merror v1.0.3
	github.com/xtgo/uuid v0.0.0-20140804021211-a0b114877d4c
	github.com/yuin/goldmark v1.3.8
	golang.org/x/crypto v0.0.0-20210616213533-5ff15b29337e
	golang.org/x/image v0.0.0-20210622092929-e6eecd499c2c
	golang.org/x/net v0.0.0-20210614182718-04defd469f4e
	golang.org/x/sync v0.0.0-20210220032951-036812b2e83c
	golang.org/x/text v0.3.6
	golang.org/x/tools v0.1.4
	gopkg.in/mail.v2 v2.3.1
	gopkg.in/olivere/elastic.v6 v6.2.35
	gopkg.in/yaml.v2 v2.4.0
	willnorris.com/go/imageproxy v0.10.0
)

replace github.com/mattermost/focalboard/server => ../focalboard/server

// Hack to prevent the willf/bitset module from being upgraded to 1.2.0.
// They changed the module path from github.com/willf/bitset to
// github.com/bits-and-blooms/bitset and a couple of dependent repos are yet
// to update their module paths.
exclude (
	github.com/RoaringBitmap/roaring v0.7.0
	github.com/RoaringBitmap/roaring v0.7.1
	github.com/willf/bitset v1.2.0
)
