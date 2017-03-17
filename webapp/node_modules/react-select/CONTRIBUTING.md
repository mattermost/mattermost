# Contributing

Thanks for your interest in React-Select. All forms of contribution are
welcome, from issue reports to PRs and documentation / write-ups.

* We use node.js v4 for development and testing. Due to incompatibilities with
JSDOM and older versions of node.js, you'll need to use node 4 to run the
tests.  If you can't install node v4 as your "default" node installation, you
could try using [nvm](https://github.com/creationix/nvm) to install multiple
versions concurrently.
* If you're upgrading your node.js 0.x environment, it's sometimes necessary
to remove the node_modules directory under react-select, and run npm install
again, in order to ensure all the correct dependencies for the new version
of node.js (as a minimum, you'll need to remove the `jsdom` module, and
reinstall that).

Before you open a PR:

* If you're planning to add or change a major feature in a PR, please ensure
the change is aligned with the project roadmap by opening an issue first,
especially if you're going to spend a lot of time on it.
* In development, run `npm start` to build (+watch) the project source, and run
the [development server](http://localhost:8000).
* Please ensure all the examples work correctly after your change. If you're
adding a major new use-case, add a new example demonstrating its use.
* Please **do not** commit the build files. Make sure **only** your changes to
`/src/`, `/less/` and `/examples/src` are included in your PR.
* Be careful to follow the code style of the project. Run `npm run lint` after
your changes and ensure you do not introduce any new errors or warnings.

* Ensure that your effort is aligned with the project's roadmap by talking to
the maintainers, especially if you are going to spend a lot of time on it.
* Make sure there's an issue open for any work you take on and intend to submit
as a pull request - it helps core members review your concept and direction
early and is a good way to discuss what you're planning to do.
* If you open an issue and are interested in working on a fix, please let us
know. We'll help you get started, rather than adding it to the queue.
* Make sure you do not add regressions by running `npm test`.
* Where possible, include tests with your changes, either that demonstrates the
bug, or tests the new functionality. If you're not sure how to test your
changes, feel free to ping @bruderstein
* Run `npm run cover` to check that the coverage hasn't dropped, and look at the
report (under the generated `coverage` directory) to check that your changes are
covered
* Please [follow our established coding conventions](https://github.com/keystonejs/keystone/wiki/Coding-Standards)
(with regards to formatting, etc)
* You can also run `npm run lint` and `npm run style` - our linter is a WIP
but please ensure there are not more violations than before your changes.
* All new features and changes need documentation. We have three translations,
please read our [Documentation Guidelines](https://github.com/keystonejs/keystone/wiki/Documentation-Translation-Guidelines).

* _Make sure you revert your build before submitting a PR_ to reduce the chance
of conflicts. `gulp build-scripts` is run after PRs are merged and before any
releases are made.
