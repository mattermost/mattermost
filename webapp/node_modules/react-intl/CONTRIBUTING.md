Contributing
============

Pull requests are very welcome, but should be within the scope of the project, and follow the repository's code conventions. Before submitting a pull request, it's always good to file an issue, so we can discuss the details of the PR.

## Reporting a Bug

1. Ensure you've replicated the issue against master.  There is a chance the issue may have already been fixed.

2. Search for any similar issues (both opened and closed).  There is a chance someone may have reported it already.

3. Provide a demo of the bug isolated in a jsfiddle/jsbin.  Sometimes this is not a possibility, in which case provide a detailed description along with any code snippets that would help in triaging the issue.  If we cannot reproduce it, we will close it.

4. The best way to demonstrate a bug is to build a failing test.  This is not required, however, it will generally speed up the development process.

## Submitting a pull request

1. At Yahoo, we have a single [Yahoo Open Source Contributor License Agreement](https://yahoocla.herokuapp.com/) that we ask contributors to electronically sign before merging in their Pull Requests. Here's the CLA's human-readable summary:

> You are saying that you have the right to give us this code, which is either your own code, or code that your company allows you to publish. You want to give us this code. We may decide to use this code. You are not going to sue people who use this code, because, after all, you are giving it to an open source project! And if you include code that you didn't write, you'll tell us about it by including the open source license to such code in your contribution so we'll know about it. You are not promising that this code works well, or that you will support it, and we're OK with that.

2. [Fork][fork] the repository.

3. Ensure that all tests are passing prior to submitting.

4. If you are adding new functionality, or fixing a bug, provide test coverage.

5. Follow syntax guidelines detailed below.

6. Push the changes to your fork and submit a pull request.  If this resolves any issues, please mark in the body `resolve #ID` within the body of your pull request.  This allows for github to automatically close the related issue once the pull request is merged.

7. Last step, [submit the pull request][pr]!

[pr]: https://github.com/yahoo/react-intl/compare/
[fork]: https://github.com/yahoo/react-intl/fork/
