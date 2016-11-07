How to use adapter with W3C tests
---------------------------------

If you want to test that the adapter works with the W3C tests, execute
the following (where TESTDIR is the root of the web-platform-tests repo):

- (cd $TESTDIR; git checkout master; git checkout -b some-unused-branch-name)
- cat adapter.js > $TESTDIR/common/vendor-prefix.js
- Run the tests according to $TESTDIR/README.md

WebRTC-specific tests are found in "mediacapture-streams" and "webrtc".
With the adapter installed, the tests should run *without* vendor prefixes.

Note: Not all of the W3C tests are updated to be spec-conformant.
