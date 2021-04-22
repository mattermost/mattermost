module github.com/mattermost/mattermost-server/v5

go 1.15

require (
	code.sajari.com/docconv v1.1.1-0.20200701232649-d9ea05fbd50a
	github.com/HdrHistogram/hdrhistogram-go v0.9.0 // indirect
	github.com/Masterminds/semver/v3 v3.1.1
	github.com/Masterminds/squirrel v1.5.0
	github.com/NYTimes/gziphandler v1.1.1
	github.com/PuerkitoBio/goquery v1.6.1 // indirect
	github.com/RoaringBitmap/roaring v0.5.5 // indirect
	github.com/advancedlogic/GoOse v0.0.0-20200830213114-1225d531e0ad // indirect
	github.com/andybalholm/brotli v1.0.1 // indirect
	github.com/araddon/dateparse v0.0.0-20210207001429-0eec95c9db7e // indirect
	github.com/armon/go-metrics v0.3.6 // indirect
	github.com/avct/uasurfer v0.0.0-20191028135549-26b5daa857f1
	github.com/aws/aws-sdk-go v1.38.2
	github.com/blang/semver v3.5.1+incompatible
	github.com/blevesearch/bleve v1.0.14
	github.com/cespare/xxhash/v2 v2.1.1
	github.com/corpix/uarand v0.1.1 // indirect
	github.com/dgrijalva/jwt-go v3.2.0+incompatible
	github.com/dgryski/dgoogauth v0.0.0-20190221195224-5a805980a5f3
	github.com/disintegration/imaging v1.6.2
	github.com/dyatlov/go-opengraph v0.0.0-20210112100619-dae8665a5b09
	github.com/fatih/color v1.10.0 // indirect
	github.com/fortytw2/leaktest v1.3.0 // indirect
	github.com/francoispqt/gojay v1.2.13
	github.com/fsnotify/fsnotify v1.4.9
	github.com/getsentry/sentry-go v0.10.0
	github.com/glycerine/go-unsnap-stream v0.0.0-20210130063903-47dfef350d96 // indirect
	github.com/go-asn1-ber/asn1-ber v1.5.3 // indirect
	github.com/go-redis/redis/v8 v8.7.1 // indirect
	github.com/go-resty/resty/v2 v2.5.0 // indirect
	github.com/go-sql-driver/mysql v1.5.0
	github.com/golang-migrate/migrate/v4 v4.14.1
	github.com/golang/freetype v0.0.0-20170609003504-e2365dfdc4a0
	github.com/golang/protobuf v1.5.1 // indirect
	github.com/golang/snappy v0.0.3 // indirect
	github.com/google/btree v1.0.1 // indirect
	github.com/google/uuid v1.2.0 // indirect
	github.com/gopherjs/gopherjs v0.0.0-20210202160940-bed99a852dfe // indirect
	github.com/gorilla/handlers v1.5.1
	github.com/gorilla/mux v1.8.0
	github.com/gorilla/schema v1.2.0
	github.com/gorilla/websocket v1.4.2
	github.com/gregjones/httpcache v0.0.0-20190611155906-901d90724c79 // indirect
	github.com/h2non/go-is-svg v0.0.0-20160927212452-35e8c4b0612c
	github.com/hako/durafmt v0.0.0-20210316092057-3a2c319c1acd
	github.com/hashicorp/errwrap v1.1.0 // indirect
	github.com/hashicorp/go-hclog v0.15.0
	github.com/hashicorp/go-immutable-radix v1.3.0 // indirect
	github.com/hashicorp/go-msgpack v1.1.5 // indirect
	github.com/hashicorp/go-multierror v1.1.1
	github.com/hashicorp/go-plugin v1.4.0
	github.com/hashicorp/go-sockaddr v1.0.2 // indirect
	github.com/hashicorp/golang-lru v0.5.4 // indirect
	github.com/hashicorp/memberlist v0.2.2
	github.com/hashicorp/yamux v0.0.0-20210316155119-a95892c5f864 // indirect
	github.com/icrowley/fake v0.0.0-20180203215853-4178557ae428
	github.com/jaytaylor/html2text v0.0.0-20200412013138-3577fbdbcff7
	github.com/jmoiron/sqlx v1.3.1
	github.com/jonboulle/clockwork v0.2.2
	github.com/klauspost/compress v1.11.12 // indirect
	github.com/klauspost/cpuid/v2 v2.0.5 // indirect
	github.com/klauspost/pgzip v1.2.5 // indirect
	github.com/kr/pretty v0.2.0 // indirect
	github.com/kr/text v0.2.0 // indirect
	github.com/ledongthuc/pdf v0.0.0-20200323191019-23c5852adbd2
	github.com/lib/pq v1.10.0
	github.com/mailru/easyjson v0.7.7 // indirect
	github.com/mattermost/go-i18n v1.11.0
	github.com/mattermost/gorp v1.6.2-0.20210419141818-0904a6a388d3
	github.com/mattermost/gosaml2 v0.3.3
	github.com/mattermost/ldap v0.0.0-20201202150706-ee0e6284187d
	github.com/mattermost/logr v1.0.13
	github.com/mattermost/rsc v0.0.0-20160330161541-bbaefb05eaa0
	github.com/mholt/archiver/v3 v3.5.0
	github.com/miekg/dns v1.1.41 // indirect
	github.com/minio/md5-simd v1.1.2 // indirect
	github.com/minio/minio-go/v7 v7.0.10
	github.com/minio/sha256-simd v1.0.0 // indirect
	github.com/mitchellh/go-testing-interface v1.14.1 // indirect
	github.com/muesli/smartcrop v0.3.0 // indirect
	github.com/oklog/run v1.1.0 // indirect
	github.com/olekukonko/tablewriter v0.0.5 // indirect
	github.com/olivere/elastic v6.2.35+incompatible // indirect
	github.com/oov/psd v0.0.0-20201203182240-dad9002861d9
	github.com/opentracing/opentracing-go v1.2.0
	github.com/otiai10/gosseract/v2 v2.3.1 // indirect
	github.com/pborman/uuid v1.2.1
	github.com/pelletier/go-toml v1.8.1 // indirect
	github.com/pierrec/lz4/v4 v4.1.4 // indirect
	github.com/pkg/errors v0.9.1
	github.com/prometheus/client_golang v1.10.0
	github.com/prometheus/client_model v0.2.0
	github.com/prometheus/common v0.20.0 // indirect
	github.com/reflog/dateconstraints v0.2.1
	github.com/rivo/uniseg v0.2.0 // indirect
	github.com/rs/cors v1.7.0
	github.com/rudderlabs/analytics-go v3.3.1+incompatible
	github.com/russellhaering/goxmldsig v1.1.0
	github.com/rwcarlsen/goexif v0.0.0-20190401172101-9e8deecbddbd
	github.com/segmentio/backo-go v0.0.0-20200129164019-23eae7c10bd3 // indirect
	github.com/sirupsen/logrus v1.8.1
	github.com/smartystreets/assertions v1.0.0 // indirect
	github.com/spf13/cobra v1.1.3
	github.com/splitio/go-client/v6 v6.0.2
	github.com/splitio/go-toolkit/v4 v4.1.0 // indirect
	github.com/stretchr/objx v0.3.0 // indirect
	github.com/stretchr/testify v1.7.0
	github.com/throttled/throttled v2.2.5+incompatible
	github.com/tidwall/gjson v1.7.1 // indirect
	github.com/tinylib/msgp v1.1.5
	github.com/tylerb/graceful v1.2.15
	github.com/uber/jaeger-client-go v2.25.0+incompatible
	github.com/uber/jaeger-lib v2.4.0+incompatible
	github.com/ulikunitz/xz v0.5.10 // indirect
	github.com/vmihailenco/msgpack/v5 v5.3.0
	github.com/wiggin77/merror v1.0.3
	github.com/wiggin77/srslog v1.0.1
	github.com/willf/bitset v1.1.11 // indirect
	github.com/xtgo/uuid v0.0.0-20140804021211-a0b114877d4c
	go.opentelemetry.io/otel v0.19.0 // indirect
	go.uber.org/multierr v1.6.0 // indirect
	go.uber.org/zap v1.16.0
	golang.org/x/crypto v0.0.0-20210322153248-0c34fe9e7dc2
	golang.org/x/image v0.0.0-20210220032944-ac19c3e999fb
	golang.org/x/mod v0.4.2 // indirect
	golang.org/x/net v0.0.0-20210316092652-d523dce5a7f4
	golang.org/x/sync v0.0.0-20210220032951-036812b2e83c
	golang.org/x/sys v0.0.0-20210320140829-1e4c9ba3b0c4 // indirect
	golang.org/x/text v0.3.5
	golang.org/x/tools v0.1.0
	google.golang.org/genproto v0.0.0-20210322173543-5f0e89347f5a // indirect
	google.golang.org/grpc v1.36.0 // indirect
	gopkg.in/alexcesaro/quotedprintable.v3 v3.0.0-20150716171945-2caba252f4dc // indirect
	gopkg.in/ini.v1 v1.62.0 // indirect
	gopkg.in/mail.v2 v2.3.1
	gopkg.in/natefinch/lumberjack.v2 v2.0.0
	gopkg.in/olivere/elastic.v6 v6.2.35
	gopkg.in/yaml.v2 v2.4.0
	gopkg.in/yaml.v3 v3.0.0-20210107192922-496545a6307b // indirect
	willnorris.com/go/imageproxy v0.10.0
)

replace github.com/NYTimes/gziphandler v1.1.1 => github.com/agnivade/gziphandler v1.1.2-0.20200815170021-7481835cb745

replace github.com/dyatlov/go-opengraph => github.com/agnivade/go-opengraph v0.0.0-20201221052033-34e69ee2a627
