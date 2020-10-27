# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project will adhere to [Semantic Versioning](http://semver.org/spec/v2.0.0.html) starting v1.0.0.

## Unreleased

### Changed

### Added

### Fixed

## [0.0.3] - 2020-07-06

[0.0.3]: https://github.com/dgraph-io/ristretto/compare/v0.0.2..v0.0.3

### Changed

### Added

### Fixed

- z: use MemHashString and xxhash.Sum64String ([#153][])
- Check conflict key before updating expiration map. ([#154][])
- Fix race condition in Cache.Clear ([#133][])
- Improve handling of updated items ([#168][])
- Fix droppedSets count while updating the item ([#171][])

## [0.0.2] - 2020-02-24

[0.0.2]: https://github.com/dgraph-io/ristretto/compare/v0.0.1..v0.0.2

### Added

- Sets with TTL. ([#122][])

### Fixed

- Fix the way metrics are handled for deletions. ([#111][])
- Support nil `*Cache` values in `Clear` and `Close`. ([#119][]) 
- Delete item immediately. ([#113][])
- Remove key from policy after TTL eviction. ([#130][])

[#111]: https://github.com/dgraph-io/ristretto/issues/111
[#113]: https://github.com/dgraph-io/ristretto/issues/113
[#119]: https://github.com/dgraph-io/ristretto/issues/119
[#122]: https://github.com/dgraph-io/ristretto/issues/122
[#130]: https://github.com/dgraph-io/ristretto/issues/130

## 0.0.1

First release. Basic cache functionality based on a LFU policy.
