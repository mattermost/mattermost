
v3.1.0 / 2019-09-20
===================

  * add consistent panic error message
  * Expose the Message interface Validate method
  * return error if a custom type is enqueued
  * Handle pointer types in Enqueue()
  * message: update maxMessageBytes to 32KB

v3.0.1 / 2018-10-02
===================

* Migrate from Circle V1 format to Circle V2
* Adds CLI for sending segment events
* Vendor packages back-go and uuid instead of using gitsubmodules


v3.0.0 / 2016-06-02
===================

 * 3.0 is a significant rewrite with multiple breaking changes.
 * [Quickstart](https://segment.com/docs/sources/server/go/quickstart/).
 * [Documentation](https://segment.com/docs/sources/server/go/).
 * [GoDocs](https://godoc.org/gopkg.in/segmentio/analytics-go.v3).
 * [What's New in v3](https://segment.com/docs/sources/server/go/#what-s-new-in-v3).


v2.1.0 / 2015-12-28
===================

 * Add ability to set custom timestamps for messages.
 * Add ability to set a custom `net/http` client.
 * Add ability to set a custom logger.
 * Fix edge case when client would try to upload no messages.
 * Properly upload in-flight messages when client is asked to shutdown.
 * Add ability to set `.integrations` field on messages.
 * Fix resource leak with interval ticker after shutdown.
 * Add retries and back-off when uploading messages.
 * Add ability to set  custom flush interval.

v2.0.0 / 2015-02-03
===================

 * rewrite with breaking API changes

v1.2.0 / 2014-09-03
==================

 * add public .Flush() method
 * rename .Stop() to .Close()

v1.1.0 / 2014-09-02
==================

 * add client.Stop() to flash/wait. Closes #7

v1.0.0 / 2014-08-26
==================

 * fix response close
 * change comments to be more go-like
 * change uuid libraries

0.1.2 / 2014-06-11
==================

 * add runnable example
 * fix: close body

0.1.1 / 2014-05-31
==================

 * refactor locking

0.1.0 / 2014-05-22
==================

 * replace Debug option with debug package

0.0.2 / 2014-05-20
==================

 * add .Start()
 * add mutexes
 * rename BufferSize to FlushAt and FlushInterval to FlushAfter
 * lower FlushInterval to 5 seconds
 * lower BufferSize to 20 to match other clients
