## [v2.1.0]

- Deprecate usage of `<base href>` as an automatic substitute for `basename`
  in `useBasename`. They have subtly different semantics ([#94])

[v2.1.0]: https://github.com/mjackson/history/compare/v2.0.2...v2.1.0
[#94]: https://github.com/mjackson/history/issues/94

## [v2.0.2]
> Apr 14, 2016

- **Bugfix:** Fix usage of `hasOwnProperty` (thanks @taion)
- **Bugfix:** Fix handling of `<base>` without `href` ([#262] thanks @taion)
- **Bugfix:** Fix security error when frontend URL !== backend URL ([#267] thanks @slorber)

[v2.0.2]: https://github.com/mjackson/history/compare/v2.0.1...v2.0.2
[#262]: https://github.com/mjackson/history/pull/262
[#267]: https://github.com/mjackson/history/pull/267

## [v2.0.1]
> Mar 2, 2016

- **Bugfix:** Fix stack size growth with every `listenBefore` listener ([#225] thanks @threepointone, @taion)
- Remove docs from npm package

[v2.0.1]: https://github.com/mjackson/history/compare/v2.0.0...v2.0.1
[#225]: https://github.com/mjackson/history/issues/225

## [v2.0.0]
> Feb 4, 2016

- **Bugfix:** Fix search base logic with an empty query ([#221])
- **Bugfix:** Fail gracefully when Safari 5 security settings prevent access to window.sessionStorage ([#223])

[v2.0.0]: https://github.com/mjackson/history/compare/v2.0.0-rc3...v2.0.0
[#221]: https://github.com/mjackson/history/issues/221
[#223]: https://github.com/mjackson/history/pull/223

## [v2.0.0-rc3]
> Feb 3, 2016

- **Bugfix:** Don't convert same-path `PUSH` to `REPLACE` when `location.state` changes ([#179])
- **Bugfix:** Re-enable browser history on Chrome iOS ([#208])
- **Bugfix:** Properly support location descriptors in `history.createLocation` ([#200])

[v2.0.0-rc3]: https://github.com/mjackson/history/compare/v2.0.0-rc2...v2.0.0-rc3
[#179]: https://github.com/mjackson/history/pull/179
[#208]: https://github.com/mjackson/history/pull/208
[#200]: https://github.com/mjackson/history/pull/200

## [v2.0.0-rc2]
> Jan 9, 2016

- Add back deprecation warnings

[v2.0.0-rc2]: https://github.com/mjackson/history/compare/v2.0.0-rc1...v2.0.0-rc2

## [v2.0.0-rc1]
> Jan 2, 2016

- **Bugfix:** Don't create empty entries in session storage ([#177])

[v2.0.0-rc1]: https://github.com/mjackson/history/compare/v1.17.0...v2.0.0-rc1
[#177]: https://github.com/mjackson/history/pull/177

## [v1.17.0]
> Dec 19, 2015

- **Bugfix:** Don't throw in memory history when out of history entries ([#170])
- **Bugfix:** Fix the deprecation warnings on `createPath` and `createHref` ([#189])

[v1.17.0]: https://github.com/mjackson/history/compare/v1.16.0...v1.17.0
[#170]: https://github.com/mjackson/history/pull/170
[#189]: https://github.com/mjackson/history/pull/189

## [v1.16.0]
> Dec 10, 2015

- **Bugfix:** Silence all warnings that were introduced since 1.13 (see [mjackson/react-router#2682])
- **Deprecation:** Deprecate the `createLocation` method in the top-level exports
- **Deprecation:** Deprecate the `state` arg to `history.createLocation`

[v1.16.0]: https://github.com/mjackson/history/compare/v1.15.0...v1.16.0
[mjackson/react-router#2682]: https://github.com/mjackson/react-router/issues/2682

## [v1.15.0]
> Dec 7, 2015

- **Feature:** Accept location descriptors in `createPath` and `createHref` ([#173])
- **Deprecation:** Deprecate the `query` arg to `createPath` and `createHref` in favor of using location descriptor objects ([#173])

[v1.15.0]: https://github.com/mjackson/history/compare/v1.14.0...v1.15.0
[#173]: https://github.com/mjackson/history/pull/173

## [v1.14.0]
> Dec 6, 2015

- **Feature:** Accept objects in `history.push` and `history.replace` ([#141])
- **Deprecation:** Deprecate `history.pushState` and `history.replaceState` in favor of passing objects to `history.push` and `history.replace` ([#168])
- **Bugfix:** Disable browser history on Chrome iOS ([#146])
- **Bugfix:** Do not convert same-path PUSH to REPLACE if the hash has changed ([#167])
- Add ES2015 module build ([#152])
- Use query-string module instead of qs to save on bytes ([#121])

[v1.14.0]: https://github.com/mjackson/history/compare/v1.13.1...v1.14.0
[#121]: https://github.com/mjackson/history/issues/121
[#141]: https://github.com/mjackson/history/pull/141
[#146]: https://github.com/mjackson/history/pull/146
[#152]: https://github.com/mjackson/history/pull/152
[#167]: https://github.com/mjackson/history/pull/167
[#168]: https://github.com/mjackson/history/pull/168

## [v1.13.1]
> Nov 13, 2015

- Fail gracefully when Safari security settings prevent access to window.sessionStorage
- Pushing the currently active path will result in a replace to not create additional browser history entries ([#43])
- Strip the protocol and domain from `<base href>` ([#139])

[v1.13.1]: https://github.com/mjackson/history/compare/v1.13.0...v1.13.1
[#43]: https://github.com/mjackson/history/pull/43
[#139]: https://github.com/mjackson/history/pull/139

## [v1.13.0]
> Oct 28, 2015

- `useBasename` transparently handles trailing slashes ([#108])
- `useBasename` automatically uses the value of `<base href>` when no
  `basename` option is provided ([#94])

[v1.13.0]: https://github.com/mjackson/history/compare/v1.12.6...v1.13.0
[#108]: https://github.com/mjackson/history/pull/108
[#94]: https://github.com/mjackson/history/issues/94

## [v1.12.6]
> Oct 25, 2015

- Add `forceRefresh` option to `createBrowserHistory` that forces
  full page refreshes even when the browser supports pushState ([#95])

[v1.12.6]: https://github.com/mjackson/history/compare/v1.12.5...v1.12.6
[#95]: https://github.com/mjackson/history/issues/95

## [v1.12.5]
> Oct 11, 2015

- Un-deprecate top-level createLocation method
- Add ability to use `{ pathname, search, hash }` object anywhere
  a path can be used
- Fix `useQueries` handling of hashes ([#93])

[v1.12.5]: https://github.com/mjackson/history/compare/v1.12.4...v1.12.5
[#93]: https://github.com/mjackson/history/issues/93

## [v1.12.4]
> Oct 9, 2015

- Fix npm postinstall hook on Windows ([#62])

[v1.12.4]: https://github.com/mjackson/history/compare/v1.12.3...v1.12.4
[#62]: https://github.com/mjackson/history/issues/62

## [v1.12.3]
> Oct 7, 2015

- Fix listenBefore hooks not being called unless a listen hook was also registered ([#71])
- Add a warning when we cannot save state in Safari private mode ([#42])

[v1.12.3]: https://github.com/mjackson/history/compare/v1.12.2...v1.12.3
[#71]: https://github.com/mjackson/history/issues/71
[#42]: https://github.com/mjackson/history/issues/42

## [v1.12.2]
> Oct 6, 2015

- Fix hash support (see [comments in #51][#51-comments])

[v1.12.2]: https://github.com/mjackson/history/compare/v1.12.1...v1.12.2
[#51-comments]: https://github.com/mjackson/history/pull/51#issuecomment-143189672

## [v1.12.1]
> Oct 5, 2015

- Give `location` objects a `key` by default
- Deprecate `history.setState`

[v1.12.1]: https://github.com/mjackson/history/compare/v1.12.0...v1.12.1

## [v1.12.0]
> Oct 4, 2015

- Add `history.createLocation` instance method. This allows history enhancers such as `useQueries` to modify `location` objects when creating them directly
- Deprecate `createLocation` method on top-level exports

[v1.12.0]: https://github.com/mjackson/history/compare/v1.11.1...v1.12.0

## [v1.11.1]
> Sep 26, 2015

- Fix `location.basename` when location matches exactly ([#68])
- Allow transitions to be interrupted by another

[v1.11.1]: https://github.com/mjackson/history/compare/v1.11.0...v1.11.1
[#68]: https://github.com/mjackson/history/issues/68

## [v1.11.0]
> Sep 24, 2015

- Add `useBasename` history enhancer
- Add `history.listenBefore`
- Add `history.listenBeforeUnload` to `useBeforeUnload` history enhancer
- Deprecate (un)registerTransitionHook
- Deprecate (un)registerBeforeUnloadHook
- Fix installing directly from git repo

[v1.11.0]: https://github.com/mjackson/history/compare/v1.10.2...v1.11.0
