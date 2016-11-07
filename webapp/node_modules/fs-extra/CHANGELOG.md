0.26.7 / 2016-03-16
-------------------
- fixed `copy()` if source and dest are the same. [#230][#230]

0.26.6 / 2016-03-15
-------------------
- fixed if `emptyDir()` does not have a callback: [#229][#229]

0.26.5 / 2016-01-27
-------------------
- `copy()` with two arguments (w/o callback) was broken. See: [#215][#215]

0.26.4 / 2016-01-05
-------------------
- `copySync()` made `preserveTimestamps` default consistent with `copy()` which is `false`. See: [#208][#208]

0.26.3 / 2015-12-17
-------------------
- fixed `copy()` hangup in copying blockDevice / characterDevice / `/dev/null`. See: [#193][#193]

0.26.2 / 2015-11-02
-------------------
- fixed `outputJson{Sync}()` spacing adherence to `fs.spaces`

0.26.1 / 2015-11-02
-------------------
- fixed `copySync()` when `clogger=true` and the destination is read only. See: [#190][#190]

0.26.0 / 2015-10-25
-------------------
- extracted the `walk()` function into its own module [`klaw`](https://github.com/jprichardson/node-klaw).

0.25.0 / 2015-10-24
-------------------
- now has a file walker `walk()`

0.24.0 / 2015-08-28
-------------------
- removed alias `delete()` and `deleteSync()`. See: [#171][#171]

0.23.1 / 2015-08-07
-------------------
- Better handling of errors for `move()` when moving across devices. [#170][#170]
- `ensureSymlink()` and `ensureLink()` should not throw errors if link exists. [#169][#169]

0.23.0 / 2015-08-06
-------------------
- added `ensureLink{Sync}()` and `ensureSymlink{Sync}()`. See: [#165][#165]

0.22.1 / 2015-07-09
-------------------
- Prevent calling `hasMillisResSync()` on module load. See: [#149][#149].
Fixes regression that was introduced in `0.21.0`.

0.22.0 / 2015-07-09
-------------------
- preserve permissions / ownership in `copy()`. See: [#54][#54]

0.21.0 / 2015-07-04
-------------------
- add option to preserve timestamps in `copy()` and `copySync()`. See: [#141][#141]
- updated `graceful-fs@3.x` to `4.x`. This brings in features from `amazing-graceful-fs` (much cleaner code / less hacks)

0.20.1 / 2015-06-23
-------------------
- fixed regression caused by latest jsonfile update: See: https://github.com/jprichardson/node-jsonfile/issues/26

0.20.0 / 2015-06-19
-------------------
- removed `jsonfile` aliases with `File` in the name, they weren't documented and probably weren't in use e.g.
this package had both `fs.readJsonFile` and `fs.readJson` that were aliases to each other, now use `fs.readJson`.
- preliminary walker created. Intentionally not documented. If you use it, it will almost certainly change and break your code.
- started moving tests inline
- upgraded to `jsonfile@2.1.0`, can now pass JSON revivers/replacers to `readJson()`, `writeJson()`, `outputJson()`

0.19.0 / 2015-06-08
-------------------
- `fs.copy()` had support for Node v0.8, dropped support

0.18.4 / 2015-05-22
-------------------
- fixed license field according to this: [#136][#136] and https://github.com/npm/npm/releases/tag/v2.10.0

0.18.3 / 2015-05-08
-------------------
- bugfix: handle `EEXIST` when clobbering on some Linux systems. [#134][#134]

0.18.2 / 2015-04-17
-------------------
- bugfix: allow `F_OK` ([#120][#120])

0.18.1 / 2015-04-15
-------------------
- improved windows support for `move()` a bit. https://github.com/jprichardson/node-fs-extra/commit/92838980f25dc2ee4ec46b43ee14d3c4a1d30c1b
- fixed a lot of tests for Windows (appveyor)

0.18.0 / 2015-03-31
-------------------
- added `emptyDir()` and `emptyDirSync()`

0.17.0 / 2015-03-28
-------------------
- `copySync` added `clobber` option (before always would clobber, now if `clobber` is `false` it throws an error if the destination exists).
**Only works with files at the moment.**
- `createOutputStream()` added. See: [#118][#118]

0.16.5 / 2015-03-08
-------------------
- fixed `fs.move` when `clobber` is `true` and destination is a directory, it should clobber. [#114][#114]

0.16.4 / 2015-03-01
-------------------
- `fs.mkdirs` fix infinite loop on Windows. See: See https://github.com/substack/node-mkdirp/pull/74 and https://github.com/substack/node-mkdirp/issues/66

0.16.3 / 2015-01-28
-------------------
- reverted https://github.com/jprichardson/node-fs-extra/commit/1ee77c8a805eba5b99382a2591ff99667847c9c9


0.16.2 / 2015-01-28
-------------------
- fixed `fs.copy` for Node v0.8 (support is temporary and will be removed in the near future)

0.16.1 / 2015-01-28
-------------------
- if `setImmediate` is not available, fall back to `process.nextTick`

0.16.0 / 2015-01-28
-------------------
- bugfix `fs.move()` into itself. Closes #104
- bugfix `fs.move()` moving directory across device. Closes #108
- added coveralls support
- bugfix: nasty multiple callback `fs.copy()` bug. Closes #98
- misc fs.copy code cleanups

0.15.0 / 2015-01-21
-------------------
- dropped `ncp`, imported code in
- because of previous, now supports `io.js`
- `graceful-fs` is now a dependency

0.14.0 / 2015-01-05
-------------------
- changed `copy`/`copySync` from `fs.copy(src, dest, [filters], callback)` to `fs.copy(src, dest, [options], callback)` [#100][#100]
- removed mockfs tests for mkdirp (this may be temporary, but was getting in the way of other tests)

0.13.0 / 2014-12-10
-------------------
- removed `touch` and `touchSync` methods (they didn't handle permissions like UNIX touch)
- updated `"ncp": "^0.6.0"` to `"ncp": "^1.0.1"`
- imported `mkdirp` => `minimist` and `mkdirp` are no longer dependences, should now appease people who wanted `mkdirp` to be `--use_strict` safe. See [#59]([#59][#59])

0.12.0 / 2014-09-22
-------------------
- copy symlinks in `copySync()` [#85][#85]

0.11.1 / 2014-09-02
-------------------
- bugfix `copySync()` preserve file permissions [#80][#80]

0.11.0 / 2014-08-11
-------------------
- upgraded `"ncp": "^0.5.1"` to `"ncp": "^0.6.0"`
- upgrade `jsonfile": "^1.2.0"` to `jsonfile": "^2.0.0"` => on write, json files now have `\n` at end. Also adds `options.throws` to `readJsonSync()`
see https://github.com/jprichardson/node-jsonfile#readfilesyncfilename-options for more details.

0.10.0 / 2014-06-29
------------------
* bugfix: upgaded `"jsonfile": "~1.1.0"` to `"jsonfile": "^1.2.0"`, bumped minor because of `jsonfile` dep change
from `~` to `^`. #67

0.9.1 / 2014-05-22
------------------
* removed Node.js `0.8.x` support, `0.9.0` was published moments ago and should have been done there

0.9.0 / 2014-05-22
------------------
* upgraded `ncp` from `~0.4.2` to `^0.5.1`, #58
* upgraded `rimraf` from `~2.2.6` to `^2.2.8`
* upgraded `mkdirp` from `0.3.x` to `^0.5.0`
* added methods `ensureFile()`, `ensureFileSync()`
* added methods `ensureDir()`, `ensureDirSync()` #31
* added `move()` method. From: https://github.com/andrewrk/node-mv


0.8.1 / 2013-10-24
------------------
* copy failed to return an error to the callback if a file doesn't exist (ulikoehler #38, #39)

0.8.0 / 2013-10-14
------------------
* `filter` implemented on `copy()` and `copySync()`. (Srirangan / #36)

0.7.1 / 2013-10-12
------------------
* `copySync()` implemented (Srirangan / #33)
* updated to the latest `jsonfile` version `1.1.0` which gives `options` params for the JSON methods. Closes #32

0.7.0 / 2013-10-07
------------------
* update readme conventions
* `copy()` now works if destination directory does not exist. Closes #29

0.6.4 / 2013-09-05
------------------
* changed `homepage` field in package.json to remove NPM warning

0.6.3 / 2013-06-28
------------------
* changed JSON spacing default from `4` to `2` to follow Node conventions
* updated `jsonfile` dep
* updated `rimraf` dep

0.6.2 / 2013-06-28
------------------
* added .npmignore, #25

0.6.1 / 2013-05-14
------------------
* modified for `strict` mode, closes #24
* added `outputJson()/outputJsonSync()`, closes #23

0.6.0 / 2013-03-18
------------------
* removed node 0.6 support
* added node 0.10 support
* upgraded to latest `ncp` and `rimraf`.
* optional `graceful-fs` support. Closes #17


0.5.0 / 2013-02-03
------------------
* Removed `readTextFile`.
* Renamed `readJSONFile` to `readJSON` and `readJson`, same with write.
* Restructured documentation a bit. Added roadmap.

0.4.0 / 2013-01-28
------------------
* Set default spaces in `jsonfile` from 4 to 2.
* Updated `testutil` deps for tests.
* Renamed `touch()` to `createFile()`
* Added `outputFile()` and `outputFileSync()`
* Changed creation of testing diretories so the /tmp dir is not littered.
* Added `readTextFile()` and `readTextFileSync()`.

0.3.2 / 2012-11-01
------------------
* Added `touch()` and `touchSync()` methods.

0.3.1 / 2012-10-11
------------------
* Fixed some stray globals.

0.3.0 / 2012-10-09
------------------
* Removed all CoffeeScript from tests.
* Renamed `mkdir` to `mkdirs`/`mkdirp`.

0.2.1 / 2012-09-11
------------------
* Updated `rimraf` dep.

0.2.0 / 2012-09-10
------------------
* Rewrote module into JavaScript. (Must still rewrite tests into JavaScript)
* Added all methods of [jsonfile][https://github.com/jprichardson/node-jsonfile]
* Added Travis-CI.

0.1.3 / 2012-08-13
------------------
* Added method `readJSONFile`.

0.1.2 / 2012-06-15
------------------
* Bug fix: `deleteSync()` didn't exist.
* Verified Node v0.8 compatibility.

0.1.1 / 2012-06-15
------------------
* Fixed bug in `remove()`/`delete()` that wouldn't execute the function if a callback wasn't passed.

0.1.0 / 2012-05-31
------------------
* Renamed `copyFile()` to `copy()`. `copy()` can now copy directories (recursively) too.
* Renamed `rmrf()` to `remove()`.
* `remove()` aliased with `delete()`.
* Added `mkdirp` capabilities. Named: `mkdir()`. Hides Node.js native `mkdir()`.
* Instead of exporting the native `fs` module with new functions, I now copy over the native methods to a new object and export that instead.

0.0.4 / 2012-03-14
------------------
* Removed CoffeeScript dependency

0.0.3 / 2012-01-11
------------------
* Added methods rmrf and rmrfSync
* Moved tests from Jasmine to Mocha

<!--- fse.copy throws error when only src and dest provided [bug, documentation, feature-copy] -->
[#215]: https://github.com/jprichardson/node-fs-extra/pull/215
<!--- Fixing copySync anchor tag -->
[#214]: https://github.com/jprichardson/node-fs-extra/pull/214
<!--- Merge extfs with this repo -->
[#213]: https://github.com/jprichardson/node-fs-extra/issues/213
<!--- Update year to 2016 in README.md and LICENSE -->
[#212]: https://github.com/jprichardson/node-fs-extra/pull/212
<!--- Not copying all files -->
[#211]: https://github.com/jprichardson/node-fs-extra/issues/211
<!--- copy/copySync behave differently when copying a symbolic file [bug, documentation, feature-copy] -->
[#210]: https://github.com/jprichardson/node-fs-extra/issues/210
<!--- In Windows invalid directory name causes infinite loop in ensureDir(). [bug] -->
[#209]: https://github.com/jprichardson/node-fs-extra/issues/209
<!--- fix options.preserveTimestamps to false in copy-sync by default [feature-copy] -->
[#208]: https://github.com/jprichardson/node-fs-extra/pull/208
<!--- Add `compare` suite of functions -->
[#207]: https://github.com/jprichardson/node-fs-extra/issues/207
<!--- outputFileSync -->
[#206]: https://github.com/jprichardson/node-fs-extra/issues/206
<!--- fix documents about copy/copySync [documentation, feature-copy] -->
[#205]: https://github.com/jprichardson/node-fs-extra/issues/205
<!--- allow copy of block and character device files -->
[#204]: https://github.com/jprichardson/node-fs-extra/pull/204
<!--- copy method's argument options couldn't be undefined [bug, feature-copy] -->
[#203]: https://github.com/jprichardson/node-fs-extra/issues/203
<!--- why there is not a walkSync method? -->
[#202]: https://github.com/jprichardson/node-fs-extra/issues/202
<!--- clobber for directories [feature-copy, future] -->
[#201]: https://github.com/jprichardson/node-fs-extra/issues/201
<!--- 'copySync' doesn't work in sync -->
[#200]: https://github.com/jprichardson/node-fs-extra/issues/200
<!--- fs.copySync fails if user does not own file [bug, feature-copy] -->
[#199]: https://github.com/jprichardson/node-fs-extra/issues/199
<!--- handle copying between identical files [feature-copy] -->
[#198]: https://github.com/jprichardson/node-fs-extra/issues/198
<!--- Missing documentation for `outputFile` `options` 3rd parameter [documentation] -->
[#197]: https://github.com/jprichardson/node-fs-extra/issues/197
<!--- copy filter: async function and/or function called with `fs.stat` result [future] -->
[#196]: https://github.com/jprichardson/node-fs-extra/issues/196
<!--- How to override with outputFile? -->
[#195]: https://github.com/jprichardson/node-fs-extra/issues/195
<!--- allow ensureFile(Sync) to provide data to be written to created file -->
[#194]: https://github.com/jprichardson/node-fs-extra/pull/194
<!--- `fs.copy` fails silently if source file is /dev/null [bug, feature-copy] -->
[#193]: https://github.com/jprichardson/node-fs-extra/issues/193
<!--- Remove fs.createOutputStream() -->
[#192]: https://github.com/jprichardson/node-fs-extra/issues/192
<!--- How to copy symlinks to target as normal folders [feature-copy] -->
[#191]: https://github.com/jprichardson/node-fs-extra/issues/191
<!--- copySync to overwrite destination file if readonly and clobber true -->
[#190]: https://github.com/jprichardson/node-fs-extra/pull/190
<!--- move.test fix to support CRLF on Windows -->
[#189]: https://github.com/jprichardson/node-fs-extra/pull/189
<!--- move.test failing on windows platform -->
[#188]: https://github.com/jprichardson/node-fs-extra/issues/188
<!--- Not filter each file, stops on first false -->
[#187]: https://github.com/jprichardson/node-fs-extra/issues/187
<!--- Do you need a .size() function in this module? [future] -->
[#186]: https://github.com/jprichardson/node-fs-extra/issues/186
<!--- Doesn't work on NodeJS v4.x -->
[#185]: https://github.com/jprichardson/node-fs-extra/issues/185
<!--- CLI equivalent for fs-extra -->
[#184]: https://github.com/jprichardson/node-fs-extra/issues/184
<!--- with clobber true, copy and copySync behave differently if destination file is read only [bug, feature-copy] -->
[#183]: https://github.com/jprichardson/node-fs-extra/issues/183
<!--- ensureDir(dir, callback) second callback parameter not specified -->
[#182]: https://github.com/jprichardson/node-fs-extra/issues/182
<!--- Add ability to remove file securely [enhancement, wont-fix] -->
[#181]: https://github.com/jprichardson/node-fs-extra/issues/181
<!--- Filter option doesn't work the same way in copy and copySync [bug, feature-copy] -->
[#180]: https://github.com/jprichardson/node-fs-extra/issues/180
<!--- Include opendir -->
[#179]: https://github.com/jprichardson/node-fs-extra/issues/179
<!--- ENOTEMPTY is thrown on removeSync  -->
[#178]: https://github.com/jprichardson/node-fs-extra/issues/178
<!--- fix `remove()` wildcards (introduced by rimraf) [feature-remove] -->
[#177]: https://github.com/jprichardson/node-fs-extra/issues/177
<!--- createOutputStream doesn't emit 'end' event -->
[#176]: https://github.com/jprichardson/node-fs-extra/issues/176
<!--- [Feature Request].moveSync support [feature-move, future] -->
[#175]: https://github.com/jprichardson/node-fs-extra/issues/175
<!--- Fix copy formatting and document options.filter -->
[#174]: https://github.com/jprichardson/node-fs-extra/pull/174
<!--- Feature Request: writeJson should mkdirs -->
[#173]: https://github.com/jprichardson/node-fs-extra/issues/173
<!--- rename `clobber` flags to `overwrite` -->
[#172]: https://github.com/jprichardson/node-fs-extra/issues/172
<!--- remove unnecessary aliases -->
[#171]: https://github.com/jprichardson/node-fs-extra/issues/171
<!--- More robust handling of errors moving across virtual drives -->
[#170]: https://github.com/jprichardson/node-fs-extra/pull/170
<!--- suppress ensureLink & ensureSymlink dest exists error -->
[#169]: https://github.com/jprichardson/node-fs-extra/pull/169
<!--- suppress ensurelink dest exists error -->
[#168]: https://github.com/jprichardson/node-fs-extra/pull/168
<!--- Adds basic (string, buffer) support for ensureFile content [future] -->
[#167]: https://github.com/jprichardson/node-fs-extra/pull/167
<!--- Adds basic (string, buffer) support for ensureFile content -->
[#166]: https://github.com/jprichardson/node-fs-extra/pull/166
<!--- ensure for link & symlink -->
[#165]: https://github.com/jprichardson/node-fs-extra/pull/165
<!--- Feature Request: ensureFile to take optional argument for file content -->
[#164]: https://github.com/jprichardson/node-fs-extra/issues/164
<!--- ouputJson not formatted out of the box [bug] -->
[#163]: https://github.com/jprichardson/node-fs-extra/issues/163
<!--- ensure symlink & link -->
[#162]: https://github.com/jprichardson/node-fs-extra/pull/162
<!--- ensure symlink & link -->
[#161]: https://github.com/jprichardson/node-fs-extra/pull/161
<!--- ensure symlink & link -->
[#160]: https://github.com/jprichardson/node-fs-extra/pull/160
<!--- ensure symlink & link -->
[#159]: https://github.com/jprichardson/node-fs-extra/pull/159
<!--- Feature Request: ensureLink and ensureSymlink methods -->
[#158]: https://github.com/jprichardson/node-fs-extra/issues/158
<!--- writeJson isn't formatted -->
[#157]: https://github.com/jprichardson/node-fs-extra/issues/157
<!--- Promise.promisifyAll doesn't work for some methods -->
[#156]: https://github.com/jprichardson/node-fs-extra/issues/156
<!--- Readme -->
[#155]: https://github.com/jprichardson/node-fs-extra/issues/155
<!--- /tmp/millis-test-sync -->
[#154]: https://github.com/jprichardson/node-fs-extra/issues/154
<!--- Make preserveTimes also work on read-only files. Closes #152 -->
[#153]: https://github.com/jprichardson/node-fs-extra/pull/153
<!--- fs.copy fails for read-only files with preserveTimestamp=true [feature-copy] -->
[#152]: https://github.com/jprichardson/node-fs-extra/issues/152
<!--- TOC does not work correctly on npm [documentation] -->
[#151]: https://github.com/jprichardson/node-fs-extra/issues/151
<!--- Remove test file fixtures, create with code. -->
[#150]: https://github.com/jprichardson/node-fs-extra/issues/150
<!--- /tmp/millis-test-sync -->
[#149]: https://github.com/jprichardson/node-fs-extra/issues/149
<!--- split out `Sync` methods in documentation -->
[#148]: https://github.com/jprichardson/node-fs-extra/issues/148
<!--- Adding rmdirIfEmpty -->
[#147]: https://github.com/jprichardson/node-fs-extra/issues/147
<!--- ensure test.js works -->
[#146]: https://github.com/jprichardson/node-fs-extra/pull/146
<!--- Add `fs.exists` and `fs.existsSync` if it doesn't exist. -->
[#145]: https://github.com/jprichardson/node-fs-extra/issues/145
<!--- tests failing -->
[#144]: https://github.com/jprichardson/node-fs-extra/issues/144
<!--- update graceful-fs -->
[#143]: https://github.com/jprichardson/node-fs-extra/issues/143
<!--- PrependFile Feature -->
[#142]: https://github.com/jprichardson/node-fs-extra/issues/142
<!--- Add option to preserve timestamps -->
[#141]: https://github.com/jprichardson/node-fs-extra/pull/141
<!--- Json file reading fails with 'utf8' -->
[#140]: https://github.com/jprichardson/node-fs-extra/issues/140
<!--- Preserve file timestamp on copy. Closes #138 -->
[#139]: https://github.com/jprichardson/node-fs-extra/pull/139
<!--- Preserve timestamps on copying files -->
[#138]: https://github.com/jprichardson/node-fs-extra/issues/138
<!--- outputFile/outputJson: Unexpected end of input -->
[#137]: https://github.com/jprichardson/node-fs-extra/issues/137
<!--- Update license attribute -->
[#136]: https://github.com/jprichardson/node-fs-extra/pull/136
<!--- emptyDir throws Error if no callback is provided -->
[#135]: https://github.com/jprichardson/node-fs-extra/issues/135
<!--- Handle EEXIST error when clobbering dir -->
[#134]: https://github.com/jprichardson/node-fs-extra/pull/134
<!--- Travis runs with `sudo: false` -->
[#133]: https://github.com/jprichardson/node-fs-extra/pull/133
<!--- isDirectory method -->
[#132]: https://github.com/jprichardson/node-fs-extra/pull/132
<!--- copySync is not working iojs 1.8.4 on linux [feature-copy] -->
[#131]: https://github.com/jprichardson/node-fs-extra/issues/131
<!--- Please review additional features. -->
[#130]: https://github.com/jprichardson/node-fs-extra/pull/130
<!--- can you review this feature? -->
[#129]: https://github.com/jprichardson/node-fs-extra/pull/129
<!--- fsExtra.move(filepath, newPath) broken; -->
[#128]: https://github.com/jprichardson/node-fs-extra/issues/128
<!--- consider using fs.access to remove deprecated warnings for fs.exists -->
[#127]: https://github.com/jprichardson/node-fs-extra/issues/127
<!---  TypeError: Object #<Object> has no method 'access' -->
[#126]: https://github.com/jprichardson/node-fs-extra/issues/126
<!--- Question: What do the *Sync function do different from non-sync -->
[#125]: https://github.com/jprichardson/node-fs-extra/issues/125
<!--- move with clobber option 'ENOTEMPTY' -->
[#124]: https://github.com/jprichardson/node-fs-extra/issues/124
<!--- Only copy the content of a directory -->
[#123]: https://github.com/jprichardson/node-fs-extra/issues/123
<!--- Update section links in README to match current section ids. -->
[#122]: https://github.com/jprichardson/node-fs-extra/pull/122
<!--- emptyDir is undefined -->
[#121]: https://github.com/jprichardson/node-fs-extra/issues/121
<!--- usage bug caused by shallow cloning methods of 'graceful-fs' -->
[#120]: https://github.com/jprichardson/node-fs-extra/issues/120
<!--- mkdirs and ensureDir never invoke callback and consume CPU indefinitely if provided a path with invalid characters on Windows -->
[#119]: https://github.com/jprichardson/node-fs-extra/issues/119
<!--- createOutputStream -->
[#118]: https://github.com/jprichardson/node-fs-extra/pull/118
<!--- Fixed issue with slash separated paths on windows -->
[#117]: https://github.com/jprichardson/node-fs-extra/pull/117
<!--- copySync can only copy directories not files [documentation, feature-copy] -->
[#116]: https://github.com/jprichardson/node-fs-extra/issues/116
<!--- .Copy & .CopySync [feature-copy] -->
[#115]: https://github.com/jprichardson/node-fs-extra/issues/115
<!--- Fails to move (rename) directory to non-empty directory even with clobber: true -->
[#114]: https://github.com/jprichardson/node-fs-extra/issues/114
<!--- fs.copy seems to callback early if the destination file already exists -->
[#113]: https://github.com/jprichardson/node-fs-extra/issues/113
<!--- Copying a file into an existing directory -->
[#112]: https://github.com/jprichardson/node-fs-extra/pull/112
<!--- Moving a file into an existing directory  -->
[#111]: https://github.com/jprichardson/node-fs-extra/pull/111
<!--- Moving a file into an existing directory -->
[#110]: https://github.com/jprichardson/node-fs-extra/pull/110
<!--- fs.move across windows drives fails -->
[#109]: https://github.com/jprichardson/node-fs-extra/issues/109
<!--- fse.move directories across multiple devices doesn't work -->
[#108]: https://github.com/jprichardson/node-fs-extra/issues/108
<!--- Check if dest path is an existing dir and copy or move source in it -->
[#107]: https://github.com/jprichardson/node-fs-extra/pull/107
<!--- fse.copySync crashes while copying across devices D: [feature-copy] -->
[#106]: https://github.com/jprichardson/node-fs-extra/issues/106
<!--- fs.copy hangs on iojs -->
[#105]: https://github.com/jprichardson/node-fs-extra/issues/105
<!--- fse.move deletes folders [bug] -->
[#104]: https://github.com/jprichardson/node-fs-extra/issues/104
<!--- Error: EMFILE with copy -->
[#103]: https://github.com/jprichardson/node-fs-extra/issues/103
<!--- touch / touchSync was removed ? -->
[#102]: https://github.com/jprichardson/node-fs-extra/issues/102
<!--- fs-extra promisified -->
[#101]: https://github.com/jprichardson/node-fs-extra/issues/101
<!--- copy: options object or filter to pass to ncp -->
[#100]: https://github.com/jprichardson/node-fs-extra/pull/100
<!--- ensureDir() modes [future] -->
[#99]: https://github.com/jprichardson/node-fs-extra/issues/99
<!--- fs.copy() incorrect async behavior [bug] -->
[#98]: https://github.com/jprichardson/node-fs-extra/issues/98
<!--- use path.join; fix copySync bug -->
[#97]: https://github.com/jprichardson/node-fs-extra/pull/97
<!--- destFolderExists in copySync is always undefined. -->
[#96]: https://github.com/jprichardson/node-fs-extra/issues/96
<!--- Using graceful-ncp instead of ncp -->
[#95]: https://github.com/jprichardson/node-fs-extra/pull/95
<!--- Error: EEXIST, file already exists '../mkdirp/bin/cmd.js' on fs.copySync() [enhancement, feature-copy] -->
[#94]: https://github.com/jprichardson/node-fs-extra/issues/94
<!--- Confusing error if drive not mounted [enhancement] -->
[#93]: https://github.com/jprichardson/node-fs-extra/issues/93
<!--- Problems with Bluebird -->
[#92]: https://github.com/jprichardson/node-fs-extra/issues/92
<!--- fs.copySync('/test', '/haha') is different with 'cp -r /test /haha' [enhancement] -->
[#91]: https://github.com/jprichardson/node-fs-extra/issues/91
<!--- Folder creation and file copy is Happening in 64 bit machine but not in 32 bit machine -->
[#90]: https://github.com/jprichardson/node-fs-extra/issues/90
<!--- Error: EEXIST using fs-extra's fs.copy to copy a directory on Windows -->
[#89]: https://github.com/jprichardson/node-fs-extra/issues/89
<!--- Stacking those libraries -->
[#88]: https://github.com/jprichardson/node-fs-extra/issues/88
<!--- createWriteStream + outputFile = ? -->
[#87]: https://github.com/jprichardson/node-fs-extra/issues/87
<!--- no moveSync? -->
[#86]: https://github.com/jprichardson/node-fs-extra/issues/86
<!--- Copy symlinks in copySync -->
[#85]: https://github.com/jprichardson/node-fs-extra/pull/85
<!--- Push latest version to npm ? -->
[#84]: https://github.com/jprichardson/node-fs-extra/issues/84
<!--- Prevent copying a directory into itself [feature-copy] -->
[#83]: https://github.com/jprichardson/node-fs-extra/issues/83
<!--- README updates for move -->
[#82]: https://github.com/jprichardson/node-fs-extra/pull/82
<!--- fd leak after fs.move -->
[#81]: https://github.com/jprichardson/node-fs-extra/issues/81
<!--- Preserve file mode in copySync -->
[#80]: https://github.com/jprichardson/node-fs-extra/pull/80
<!--- fs.copy only .html file empty -->
[#79]: https://github.com/jprichardson/node-fs-extra/issues/79
<!--- copySync was not applying filters to directories -->
[#78]: https://github.com/jprichardson/node-fs-extra/pull/78
<!--- Create README reference to bluebird -->
[#77]: https://github.com/jprichardson/node-fs-extra/issues/77
<!--- Create README reference to typescript -->
[#76]: https://github.com/jprichardson/node-fs-extra/issues/76
<!--- add glob as a dep? [question] -->
[#75]: https://github.com/jprichardson/node-fs-extra/issues/75
<!--- including new emptydir module -->
[#74]: https://github.com/jprichardson/node-fs-extra/pull/74
<!--- add dependency status in readme -->
[#73]: https://github.com/jprichardson/node-fs-extra/pull/73
<!--- Use svg instead of png to get better image quality -->
[#72]: https://github.com/jprichardson/node-fs-extra/pull/72
<!--- fse.copy not working on Windows 7 x64 OS, but, copySync does work -->
[#71]: https://github.com/jprichardson/node-fs-extra/issues/71
<!--- Not filter each file, stops on first false [bug] -->
[#70]: https://github.com/jprichardson/node-fs-extra/issues/70
<!--- How to check if folder exist and read the folder name -->
[#69]: https://github.com/jprichardson/node-fs-extra/issues/69
<!--- consider flag to readJsonSync (throw false) [enhancement] -->
[#68]: https://github.com/jprichardson/node-fs-extra/issues/68
<!--- docs for readJson incorrectly states that is accepts options -->
[#67]: https://github.com/jprichardson/node-fs-extra/issues/67
<!--- ENAMETOOLONG -->
[#66]: https://github.com/jprichardson/node-fs-extra/issues/66
<!--- exclude filter in fs.copy -->
[#65]: https://github.com/jprichardson/node-fs-extra/issues/65
<!--- Announce: mfs - monitor your fs-extra calls -->
[#64]: https://github.com/jprichardson/node-fs-extra/issues/64
<!--- Walk -->
[#63]: https://github.com/jprichardson/node-fs-extra/issues/63
<!--- npm install fs-extra doesn't work -->
[#62]: https://github.com/jprichardson/node-fs-extra/issues/62
<!--- No longer supports node 0.8 due to use of `^` in package.json dependencies -->
[#61]: https://github.com/jprichardson/node-fs-extra/issues/61
<!--- chmod & chown for mkdirs -->
[#60]: https://github.com/jprichardson/node-fs-extra/issues/60
<!--- Consider including mkdirp and making fs-extra "--use_strict" safe [question] -->
[#59]: https://github.com/jprichardson/node-fs-extra/issues/59
<!--- Stack trace not included in fs.copy error -->
[#58]: https://github.com/jprichardson/node-fs-extra/issues/58
<!--- Possible to include wildcards in delete? -->
[#57]: https://github.com/jprichardson/node-fs-extra/issues/57
<!--- Crash when have no access to write to destination file in copy  -->
[#56]: https://github.com/jprichardson/node-fs-extra/issues/56
<!--- Is it possible to have any console output similar to Grunt copy module? -->
[#55]: https://github.com/jprichardson/node-fs-extra/issues/55
<!--- `copy` does not preserve file ownership and permissons -->
[#54]: https://github.com/jprichardson/node-fs-extra/issues/54
<!--- outputFile() - ability to write data in appending mode -->
[#53]: https://github.com/jprichardson/node-fs-extra/issues/53
<!--- This fixes (what I think) is a bug in copySync -->
[#52]: https://github.com/jprichardson/node-fs-extra/pull/52
<!--- Add a Bitdeli Badge to README -->
[#51]: https://github.com/jprichardson/node-fs-extra/pull/51
<!--- Replace mechanism in createFile -->
[#50]: https://github.com/jprichardson/node-fs-extra/issues/50
<!--- update rimraf to v2.2.6 -->
[#49]: https://github.com/jprichardson/node-fs-extra/pull/49
<!--- fs.copy issue [bug] -->
[#48]: https://github.com/jprichardson/node-fs-extra/issues/48
<!--- Bug in copy - callback called on readStream "close" - Fixed in ncp 0.5.0 -->
[#47]: https://github.com/jprichardson/node-fs-extra/issues/47
<!--- update copyright year -->
[#46]: https://github.com/jprichardson/node-fs-extra/pull/46
<!--- Added note about fse.outputFile() being the one that overwrites -->
[#45]: https://github.com/jprichardson/node-fs-extra/pull/45
<!--- Proposal: Stream support -->
[#44]: https://github.com/jprichardson/node-fs-extra/pull/44
<!--- Better error reporting  -->
[#43]: https://github.com/jprichardson/node-fs-extra/issues/43
<!--- Performance issue? -->
[#42]: https://github.com/jprichardson/node-fs-extra/issues/42
<!--- There does seem to be a synchronous version now -->
[#41]: https://github.com/jprichardson/node-fs-extra/pull/41
<!--- fs.copy throw unexplained error ENOENT, utime  -->
[#40]: https://github.com/jprichardson/node-fs-extra/issues/40
<!--- Added regression test for copy() return callback on error -->
[#39]: https://github.com/jprichardson/node-fs-extra/pull/39
<!--- Return err in copy() fstat cb, because stat could be undefined or null -->
[#38]: https://github.com/jprichardson/node-fs-extra/pull/38
<!--- Maybe include a line reader? [enhancement, question] -->
[#37]: https://github.com/jprichardson/node-fs-extra/issues/37
<!--- `filter` parameter `fs.copy` and `fs.copySync` -->
[#36]: https://github.com/jprichardson/node-fs-extra/pull/36
<!--- `filter` parameter `fs.copy` and `fs.copySync`  -->
[#35]: https://github.com/jprichardson/node-fs-extra/pull/35
<!--- update docs to include options for JSON methods [enhancement] -->
[#34]: https://github.com/jprichardson/node-fs-extra/issues/34
<!--- fs_extra.copySync -->
[#33]: https://github.com/jprichardson/node-fs-extra/pull/33
<!--- update to latest jsonfile [enhancement] -->
[#32]: https://github.com/jprichardson/node-fs-extra/issues/32
<!--- Add ensure methods [enhancement] -->
[#31]: https://github.com/jprichardson/node-fs-extra/issues/31
<!--- update package.json optional dep `graceful-fs` -->
[#30]: https://github.com/jprichardson/node-fs-extra/issues/30
<!--- Copy failing if dest directory doesn't exist. Is this intended? -->
[#29]: https://github.com/jprichardson/node-fs-extra/issues/29
<!--- homepage field must be a string url. Deleted. -->
[#28]: https://github.com/jprichardson/node-fs-extra/issues/28
<!--- Update Readme -->
[#27]: https://github.com/jprichardson/node-fs-extra/issues/27
<!--- Add readdir recursive method. [enhancement] -->
[#26]: https://github.com/jprichardson/node-fs-extra/issues/26
<!--- adding an `.npmignore` file -->
[#25]: https://github.com/jprichardson/node-fs-extra/pull/25
<!--- [bug] cannot run in strict mode [bug] -->
[#24]: https://github.com/jprichardson/node-fs-extra/issues/24
<!--- `writeJSON()` should create parent directories -->
[#23]: https://github.com/jprichardson/node-fs-extra/issues/23
<!--- Add a limit option to mkdirs() -->
[#22]: https://github.com/jprichardson/node-fs-extra/pull/22
<!--- touch() in 0.10.0 -->
[#21]: https://github.com/jprichardson/node-fs-extra/issues/21
<!--- fs.remove yields callback before directory is really deleted -->
[#20]: https://github.com/jprichardson/node-fs-extra/issues/20
<!--- fs.copy err is empty array -->
[#19]: https://github.com/jprichardson/node-fs-extra/issues/19
<!--- Exposed copyFile Function -->
[#18]: https://github.com/jprichardson/node-fs-extra/pull/18
<!--- Use `require("graceful-fs")` if found instead of `require("fs")` -->
[#17]: https://github.com/jprichardson/node-fs-extra/issues/17
<!--- Update README.md -->
[#16]: https://github.com/jprichardson/node-fs-extra/pull/16
<!--- Implement cp -r but sync aka copySync. [enhancement] -->
[#15]: https://github.com/jprichardson/node-fs-extra/issues/15
<!--- fs.mkdirSync is broken in 0.3.1 -->
[#14]: https://github.com/jprichardson/node-fs-extra/issues/14
<!--- Thoughts on including a directory tree / file watcher? [enhancement, question] -->
[#13]: https://github.com/jprichardson/node-fs-extra/issues/13
<!--- copyFile & copyFileSync are global -->
[#12]: https://github.com/jprichardson/node-fs-extra/issues/12
<!--- Thoughts on including a file walker? [enhancement, question] -->
[#11]: https://github.com/jprichardson/node-fs-extra/issues/11
<!--- move / moveFile API [enhancement] -->
[#10]: https://github.com/jprichardson/node-fs-extra/issues/10
<!--- don't import normal fs stuff into fs-extra -->
[#9]: https://github.com/jprichardson/node-fs-extra/issues/9
<!--- Update rimraf to latest version -->
[#8]: https://github.com/jprichardson/node-fs-extra/pull/8
<!--- Remove CoffeeScript development dependency -->
[#6]: https://github.com/jprichardson/node-fs-extra/issues/6
<!--- comments on naming -->
[#5]: https://github.com/jprichardson/node-fs-extra/issues/5
<!--- version bump to 0.2 -->
[#4]: https://github.com/jprichardson/node-fs-extra/issues/4
<!--- Hi! I fixed some code for you! -->
[#3]: https://github.com/jprichardson/node-fs-extra/pull/3
<!--- Merge with fs.extra and mkdirp -->
[#2]: https://github.com/jprichardson/node-fs-extra/issues/2
<!--- file-extra npm !exist -->
[#1]: https://github.com/jprichardson/node-fs-extra/issues/1
