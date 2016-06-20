# Examples

This directory contains examples for all the throttlers implemented by the throttled package, as well as an example of a custom limiter.

* custom/ : implements a custom limiter that allows requests to path /a on even seconds, and on path /b on odd seconds.
* interval-many/ : implements a common interval throttler to control two different handlers, one for path /a and another for path /b, so that requests to any one of the handlers go through at the specified interval.
* interval-vary/ : implements an interval throttler that varies by path, so that requests to each different path goes through at the specified interval.
* interval/ : implements an interval throttler so that any request goes through at the specified interval, regardless of path or any other criteria.
* memstats/ : implements a memory-usage throttler that limits access based on current memory statistics.
* rate-limit/ : implements a rate-limiter throttler that varies by path, so that the number of requests allowed are counted based on the requested path.

Each example app supports a number of command-line flags. Run the example with the -h flag to display usage and defaults.
