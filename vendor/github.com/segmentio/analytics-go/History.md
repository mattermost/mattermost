
v2.1.1 / 2016-04-26
===================

 * Fix blocking the goroutine when Close is the first call.
 * Fix blocking the goroutine when the message queue fills up.

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
