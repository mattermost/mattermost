Changes by Version
==================

2.2.0 (2019-09-23)
------------------

- Upgrade Prometheus client to 1.1 and go-kit to 0.9 (#78) -- Yuri Shkuro


2.1.1 (2019-09-06)
------------------

- Remove go modules support (#76) -- Yuri Shkuro


2.1.0 (2019-09-05)
------------------

- Add support for go modules (#75) -- Yuri Shkuro
- Fix typo in metrics Init method docs (#72) -- Sergei Zimakov
- Remove GO15VENDOREXPERIMENT variable (#71) -- Takuya N
- Ensure Gopkg.lock files remain in sync with Gopkg.yaml (#69) -- Prithvi Raj


2.0.0 (2018-12-17)
------------------

Breaking changes:
- Add first class support for Histograms and change factory args to structs (#63) <Gary Brown>
- Add metric description to factory API (#61) <Gary Brown>
- Remove metrics/go-kit/prometheus as metrics/prometheus now available (#58) <Gary Brown>
- Add `_total` suffix for counters reported to prometheus (#54) <Gary Brown>
- LocalBackend / Test factory moved to metrics/metricstest/ package (#46) <Patrick Ohly>,
- Change AssertCounterMetrics/AssertGaugeMetrics to be functions on the test factory (#51) <Yuri Shkuro>


1.5.0 (2018-05-11)
------------------

- Change default metrics namespace separator from colon to underscore (#43) <Juraci Paixão Kröhling>
- Use an interface to be compatible with Prometheus 0.9.x (#42) <Pavel Nikolov>


1.4.0 (2018-03-05)
------------------

- Reimplement expvar metrics to be tolerant of duplicates (#40)


1.3.1 (2018-01-12)
-------------------

- Add Gopkg.toml to allow using the lib with `dep`


1.3.0 (2018-01-08)
------------------

- Move rate limiter from client to jaeger-lib [#35](https://github.com/jaegertracing/jaeger-lib/pull/35)


1.2.1 (2017-11-14)
------------------

- *breaking* Change prometheus.New() to accept options instead of fixed arguments


1.2.0 (2017-11-12)
------------------

- Support Prometheus metrics directly [#29](https://github.com/jaegertracing/jaeger-lib/pull/29).


1.1.0 (2017-09-10)
------------------

- Re-releasing the project under Apache 2.0 license.


1.0.0 (2017-08-22)
------------------

- First semver release.
