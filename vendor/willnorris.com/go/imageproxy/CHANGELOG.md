# Changelog

This file contains all notable changes to
[imageproxy](https://github.com/willnorris/imageproxy).  The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
 - updated docker image to use go1.12 compiler and build imageproxy as a go module.

### Removed
 - removed deprecated `whitelist` flag and `Proxy.Whitelist` struct field. Use
   `allowHosts` and `Proxy.AllowHosts` instead.

## [0.8.0] (2019-03-21)

### Added
 - added support for restricting proxied URLs [based on Content-Type
   headers](https://github.com/willnorris/imageproxy#allowed-content-type-list)
   ([#141](https://github.com/willnorris/imageproxy/pull/141),
   [ccbrown](https://github.com/ccbrown))
 - added ability to [deny requests](https://github.com/willnorris/imageproxy#allowed-and-denied-hosts-list)
   for certain remote hosts
   ([#85](https://github.com/willnorris/imageproxy/pull/85),
   [geriljaSA](https://github.com/geriljaSA))
 - added `userAgent` flag to specify a custom user agent when fetching images
   ([#83](https://github.com/willnorris/imageproxy/pull/83),
   [huguesalary](https://github.com/huguesalary))
 - added support for [s3 compatible](https://github.com/willnorris/imageproxy#cache)
   storage providers
   ([#147](https://github.com/willnorris/imageproxy/pull/147),
   [ruledio](https://github.com/ruledio))
 - log URL when image transform fails for easier debugging
   ([#149](https://github.com/willnorris/imageproxy/pull/149),
   [daohoangson](https://github.com/daohoangson))
 - added support for building imageproxy as a [go module](https://golang.org/wiki/Modules).
   A future version will remove vendored dependencies, at which point building
   as a module will be the only supported method of building imageproxy.

### Changed
 - when a remote URL is denied, return a generic error message that does not specify exactly why it failed
   ([7e19b5c](https://github.com/willnorris/imageproxy/commit/7e19b5c))

### Deprecated
 - `whitelist` flag and `Proxy.Whitelist` struct field renamed to `allowHosts`
   and `Proxy.AllowHosts`.  Old values are still supported, but will be removed
   in a future release.

### Fixed
 - fixed tcp_mem resource leak on 304 responses
   ([#153](https://github.com/willnorris/imageproxy/pull/153),
   [Micr0mega](https://github.com/Micr0mega))

## Older Versions

Additional changelog entries for older versions to be written as time permits.
Contributions are welcome.

[Unreleased]: https://github.com/willnorris/imageproxy/compare/v0.8.0...HEAD
[0.8.0]: https://github.com/willnorris/imageproxy/compare/v0.7.0...v0.8.0
