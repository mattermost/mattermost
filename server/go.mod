module github.com/mattermost/mattermost/server/v8

go 1.21

toolchain go1.21.8

require (
	code.sajari.com/docconv/v2 v2.0.0-pre.4
	github.com/Masterminds/semver/v3 v3.2.1
	github.com/avct/uasurfer v0.0.0-20191028135549-26b5daa857f1
	github.com/aws/aws-sdk-go v1.50.27
	github.com/blang/semver/v4 v4.0.0
	github.com/blevesearch/bleve/v2 v2.3.10
	github.com/cespare/xxhash/v2 v2.2.0
	github.com/dgryski/dgoogauth v0.0.0-20190221195224-5a805980a5f3
	github.com/disintegration/imaging v1.6.2
	github.com/dyatlov/go-opengraph/opengraph v0.0.0-20220524092352-606d7b1e5f8a
	github.com/elastic/go-elasticsearch/v8 v8.4.0-alpha.1.0.20230719162115-b74bbf87c923
	github.com/fatih/color v1.16.0
	github.com/fsnotify/fsnotify v1.7.0
	github.com/getsentry/sentry-go v0.27.0
	github.com/go-sql-driver/mysql v1.7.1
	github.com/golang-jwt/jwt/v5 v5.2.0
	github.com/golang-migrate/migrate/v4 v4.17.0
	github.com/golang/freetype v0.0.0-20170609003504-e2365dfdc4a0
	github.com/golang/mock v1.6.0
	github.com/gorilla/handlers v1.5.2
	github.com/gorilla/mux v1.8.1
	github.com/gorilla/schema v1.2.1
	github.com/gorilla/websocket v1.5.1
	github.com/h2non/go-is-svg v0.0.0-20160927212452-35e8c4b0612c
	github.com/hako/durafmt v0.0.0-20210608085754-5c1018a4e16b
	github.com/hashicorp/go-multierror v1.1.1
	github.com/hashicorp/memberlist v0.5.0
	github.com/icrowley/fake v0.0.0-20221112152111-d7b7e2276db2
	github.com/isacikgoz/prompt v0.1.0
	github.com/jaytaylor/html2text v0.0.0-20230321000545-74c2419ad056
	github.com/jmoiron/sqlx v1.3.5
	github.com/klauspost/compress v1.17.7
	github.com/ledongthuc/pdf v0.0.0-20240201131950-da5b75280b06
	github.com/lib/pq v1.10.9
	github.com/mattermost/go-i18n v1.11.1-0.20211013152124-5c415071e404
	github.com/mattermost/gosaml2 v0.8.0
	github.com/mattermost/ldap v0.0.0-20231116144001-0f480c025956
	github.com/mattermost/logr/v2 v2.0.21
	github.com/mattermost/mattermost/server/public v0.1.4
	github.com/mattermost/morph v1.1.0
	github.com/mattermost/rsc v0.0.0-20160330161541-bbaefb05eaa0
	github.com/mattermost/squirrel v0.4.0
	github.com/mholt/archiver/v3 v3.5.1
	github.com/microcosm-cc/bluemonday v1.0.26
	github.com/minio/minio-go/v7 v7.0.67
	github.com/oov/psd v0.0.0-20220121172623-5db5eafcecbb
	github.com/opentracing/opentracing-go v1.2.0
	github.com/pkg/errors v0.9.1
	github.com/prometheus/client_golang v1.19.0
	github.com/prometheus/client_model v0.6.0
	github.com/reflog/dateconstraints v0.2.1
	github.com/rs/cors v1.10.1
	github.com/rudderlabs/analytics-go v3.3.3+incompatible
	github.com/rwcarlsen/goexif v0.0.0-20190401172101-9e8deecbddbd
	github.com/sirupsen/logrus v1.9.3
	github.com/spf13/cobra v1.8.0
	github.com/spf13/viper v1.18.2
	github.com/splitio/go-client/v6 v6.5.2
	github.com/stretchr/testify v1.8.4
	github.com/throttled/throttled v2.2.5+incompatible
	github.com/tinylib/msgp v1.1.9
	github.com/tylerb/graceful v1.2.15
	github.com/uber/jaeger-client-go v2.30.0+incompatible
	github.com/uber/jaeger-lib v2.4.1+incompatible
	github.com/vmihailenco/msgpack/v5 v5.4.1
	github.com/wiggin77/merror v1.0.5
	github.com/xtgo/uuid v0.0.0-20140804021211-a0b114877d4c
	github.com/yuin/goldmark v1.7.4
	golang.org/x/crypto v0.33.0
	golang.org/x/image v0.15.0
	golang.org/x/net v0.35.0
	golang.org/x/sync v0.11.0
	golang.org/x/term v0.29.0
	golang.org/x/tools v0.21.1-0.20240508182429-e35e4ccd0d2d
	gopkg.in/mail.v2 v2.3.1
	gopkg.in/yaml.v2 v2.4.0
)

require (
	github.com/HdrHistogram/hdrhistogram-go v1.1.2 // indirect
	github.com/JalfResi/justext v0.0.0-20221106200834-be571e3e3052 // indirect
	github.com/PuerkitoBio/goquery v1.9.0 // indirect
	github.com/RoaringBitmap/roaring v1.9.0 // indirect
	github.com/advancedlogic/GoOse v0.0.0-20231203033844-ae6b36caf275 // indirect
	github.com/andybalholm/brotli v1.1.0 // indirect
	github.com/andybalholm/cascadia v1.3.2 // indirect
	github.com/araddon/dateparse v0.0.0-20210429162001-6b43995a97de // indirect
	github.com/armon/go-metrics v0.4.1 // indirect
	github.com/aymerick/douceur v0.2.0 // indirect
	github.com/beevik/etree v1.3.0 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/bits-and-blooms/bitset v1.13.0 // indirect
	github.com/bits-and-blooms/bloom/v3 v3.6.0 // indirect
	github.com/blevesearch/bleve_index_api v1.1.6 // indirect
	github.com/blevesearch/geo v0.1.20 // indirect
	github.com/blevesearch/go-porterstemmer v1.0.3 // indirect
	github.com/blevesearch/gtreap v0.1.1 // indirect
	github.com/blevesearch/mmap-go v1.0.4 // indirect
	github.com/blevesearch/scorch_segment_api/v2 v2.2.8 // indirect
	github.com/blevesearch/segment v0.9.1 // indirect
	github.com/blevesearch/snowballstem v0.9.0 // indirect
	github.com/blevesearch/upsidedown_store_api v1.0.2 // indirect
	github.com/blevesearch/vellum v1.0.10 // indirect
	github.com/blevesearch/zapx/v11 v11.3.10 // indirect
	github.com/blevesearch/zapx/v12 v12.3.10 // indirect
	github.com/blevesearch/zapx/v13 v13.3.10 // indirect
	github.com/blevesearch/zapx/v14 v14.3.10 // indirect
	github.com/blevesearch/zapx/v15 v15.3.13 // indirect
	github.com/corpix/uarand v0.2.0 // indirect
	github.com/cpuguy83/go-md2man/v2 v2.0.3 // indirect
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/dsnet/compress v0.0.2-0.20210315054119-f66993602bf5 // indirect
	github.com/dustin/go-humanize v1.0.1 // indirect
	github.com/elastic/elastic-transport-go/v8 v8.0.0-20230329154755-1a3c63de0db6 // indirect
	github.com/fatih/set v0.2.1 // indirect
	github.com/felixge/httpsnoop v1.0.4 // indirect
	github.com/francoispqt/gojay v1.2.13 // indirect
	github.com/gigawattio/window v0.0.0-20180317192513-0f5467e35573 // indirect
	github.com/go-asn1-ber/asn1-ber v1.5.5 // indirect
	github.com/go-resty/resty/v2 v2.11.0 // indirect
	github.com/golang/geo v0.0.0-20230421003525-6adc56603217 // indirect
	github.com/golang/protobuf v1.5.3 // indirect
	github.com/golang/snappy v0.0.4 // indirect
	github.com/gomodule/redigo v2.0.0+incompatible // indirect
	github.com/google/btree v1.1.2 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/gopherjs/gopherjs v1.17.2 // indirect
	github.com/gorilla/css v1.0.1 // indirect
	github.com/hashicorp/errwrap v1.1.0 // indirect
	github.com/hashicorp/go-hclog v1.6.2 // indirect
	github.com/hashicorp/go-immutable-radix v1.3.1 // indirect
	github.com/hashicorp/go-msgpack v1.1.5 // indirect
	github.com/hashicorp/go-plugin v1.6.0 // indirect
	github.com/hashicorp/go-sockaddr v1.0.6 // indirect
	github.com/hashicorp/golang-lru v1.0.2 // indirect
	github.com/hashicorp/golang-lru/v2 v2.0.7 // indirect
	github.com/hashicorp/hcl v1.0.0 // indirect
	github.com/hashicorp/yamux v0.1.1 // indirect
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/isacikgoz/fuzzy v0.2.0 // indirect
	github.com/jmespath/go-jmespath v0.4.0 // indirect
	github.com/jonboulle/clockwork v0.4.0 // indirect
	github.com/json-iterator/go v1.1.12 // indirect
	github.com/klauspost/cpuid/v2 v2.2.7 // indirect
	github.com/klauspost/pgzip v1.2.6 // indirect
	github.com/lann/builder v0.0.0-20180802200727-47ae307949d0 // indirect
	github.com/lann/ps v0.0.0-20150810152359-62de8c46ede0 // indirect
	github.com/levigross/exp-html v0.0.0-20120902181939-8df60c69a8f5 // indirect
	github.com/magiconair/properties v1.8.7 // indirect
	github.com/mattermost/xml-roundtrip-validator v0.1.0 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/mattn/go-runewidth v0.0.15 // indirect
	github.com/mattn/go-sqlite3 v2.0.3+incompatible // indirect
	github.com/miekg/dns v1.1.58 // indirect
	github.com/minio/md5-simd v1.1.2 // indirect
	github.com/minio/sha256-simd v1.0.1 // indirect
	github.com/mitchellh/go-testing-interface v1.14.1 // indirect
	github.com/mitchellh/mapstructure v1.5.0 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/modern-go/reflect2 v1.0.2 // indirect
	github.com/mschoch/smat v0.2.0 // indirect
	github.com/ncruces/go-strftime v0.1.9 // indirect
	github.com/nwaples/rardecode v1.1.3 // indirect
	github.com/oklog/run v1.1.0 // indirect
	github.com/olekukonko/tablewriter v0.0.5 // indirect
	github.com/otiai10/gosseract/v2 v2.4.1 // indirect
	github.com/pborman/uuid v1.2.1 // indirect
	github.com/pelletier/go-toml v1.9.5 // indirect
	github.com/pelletier/go-toml/v2 v2.1.1 // indirect
	github.com/philhofer/fwd v1.1.2 // indirect
	github.com/pierrec/lz4/v4 v4.1.21 // indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/prometheus/common v0.48.0 // indirect
	github.com/prometheus/procfs v0.12.0 // indirect
	github.com/redis/go-redis/v9 v9.5.1 // indirect
	github.com/remyoudompheng/bigfft v0.0.0-20230129092748-24d4a6f8daec // indirect
	github.com/richardlehane/mscfb v1.0.4 // indirect
	github.com/richardlehane/msoleps v1.0.3 // indirect
	github.com/rivo/uniseg v0.4.7 // indirect
	github.com/rs/xid v1.5.0 // indirect
	github.com/russellhaering/goxmldsig v1.4.0 // indirect
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	github.com/sagikazarmark/locafero v0.4.0 // indirect
	github.com/sagikazarmark/slog-shim v0.1.0 // indirect
	github.com/sean-/seed v0.0.0-20170313163322-e2103e2c3529 // indirect
	github.com/segmentio/backo-go v1.0.1 // indirect
	github.com/sourcegraph/conc v0.3.0 // indirect
	github.com/spf13/afero v1.11.0 // indirect
	github.com/spf13/cast v1.6.0 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	github.com/splitio/go-split-commons/v5 v5.2.1 // indirect
	github.com/splitio/go-toolkit/v5 v5.4.0 // indirect
	github.com/ssor/bom v0.0.0-20170718123548-6386211fdfcf // indirect
	github.com/stretchr/objx v0.5.1 // indirect
	github.com/subosito/gotenv v1.6.0 // indirect
	github.com/tidwall/gjson v1.17.1 // indirect
	github.com/tidwall/match v1.1.1 // indirect
	github.com/tidwall/pretty v1.2.1 // indirect
	github.com/ulikunitz/xz v0.5.11 // indirect
	github.com/vmihailenco/tagparser/v2 v2.0.0 // indirect
	github.com/wiggin77/srslog v1.0.1 // indirect
	github.com/xi2/xz v0.0.0-20171230120015-48954b6210f8 // indirect
	go.etcd.io/bbolt v1.3.9 // indirect
	go.uber.org/atomic v1.11.0 // indirect
	go.uber.org/multierr v1.11.0 // indirect
	golang.org/x/exp v0.0.0-20240222234643-814bf88cf225 // indirect
	golang.org/x/mod v0.17.0 // indirect
	golang.org/x/sys v0.30.0 // indirect
	golang.org/x/text v0.22.0 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20240227224415-6ceb2ff114de // indirect
	google.golang.org/grpc v1.62.0 // indirect
	google.golang.org/protobuf v1.32.0 // indirect
	gopkg.in/alexcesaro/quotedprintable.v3 v3.0.0-20150716171945-2caba252f4dc // indirect
	gopkg.in/ini.v1 v1.67.0 // indirect
	gopkg.in/natefinch/lumberjack.v2 v2.2.1 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	modernc.org/gc/v3 v3.0.0-20240107210532-573471604cb6 // indirect
	modernc.org/libc v1.41.0 // indirect
	modernc.org/mathutil v1.6.0 // indirect
	modernc.org/memory v1.7.2 // indirect
	modernc.org/sqlite v1.29.2 // indirect
	modernc.org/strutil v1.2.0 // indirect
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
