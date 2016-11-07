# Contributing

Thanks for your interest in classNames. Issues, PRs and suggestions welcome :)

Before working on a PR, please consider the following:

* Speed is a serious concern for this package as it is likely to be called a
significant number of times in any project that uses it. As such, new features
will only be accepted if they improve (or at least do not negatively impact)
performance.
* To demonstrate performance differences please set up a
[JSPerf](http://jsperf.com) test and link to it from your issue / PR.
* Tests must be added for any change or new feature before it will be accepted.

A benchmark utilitiy is included so that changes may be tested against the
current published version. To run the benchmarks, `npm install` in the
`./benchmarks` directory then run `npm run benchmarks` in the package root.

Please be aware though that local benchmarks are just a smoke-signal; they will
run in the v8 version that your node/iojs uses, while classNames is _most_
often run across a wide variety of browsers and browser versions.
