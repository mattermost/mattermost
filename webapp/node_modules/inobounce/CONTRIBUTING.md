# iNoBounce
> Stop your iOS webapp from bouncing around when scrolling

## Before reporting an issue

:warning: Before you report and issue with iNoBounce, check the demo page and see if you can reproduce the problem there: http://blog.lazd.net/iNoBounce/

### If you can reproduce the problem on the demo page

Report an issue and include the information below.

### If you cannot reproduce the problem

Please first check your application for code such as:

```js
document.body.addEventListener('touchmove', function(event) {
  event.preventDefault();
  // or return false;
});
```

```js
document.body.addEventListener('touchstart', function(event) {
  event.preventDefault();
  // or return false;
});
```

If you can't find anything, please [create a Fiddle](http://jsfiddle.net/) that reproduces the issue and include a link to it along with all of the information below.


## Reporting issues

Any reported issue must include the following information:

##### 1. Specific steps you took to reproduce the problem

> Steps:

> 1. Scroll to the top of a div with `overflow: auto; width: 10000px;`

> 2. Try to scroll right

##### 2. The behavior you expected

> Expected:

> It should not stop scrolling left/right when at the top of a scrollable div"

##### 3. The behavior you observed (**do not** simply write "not working")

> Observed:

> You can scroll down, but you can't scroll left or right

##### 4. The make and model of the device the problem was observed on

> Device:

> iPhone 6, iOS 8.1.3

##### 5. Additional information

* List any touch-specific frameworks your page is using that might be conflicting
* Whether the problem happens on every device/OS version, or a specific model/version
* Hints, suspicicions, and gut feelings
* Any workarounds you found

> Notes:

> I'm also using Sencha Touch on the page.

> This doesn't seem to happen on my other phone running iOS 7.

## Contributing

You contributions are welcome! Please follow the guidelines below

### 1. File an issue

An issue must exist before you start working on a fix or a feature.

First, [search the issues](https://github.com/lazd/iNoBounce/issues) to see if one has already been filed for what you're about to work on.

If not, [file an issue](https://github.com/lazd/iNoBounce/issues/new) with the following information.

For bugs:

* Steps to reproduce
* Expected behavior
* Observed behavior
* Device/OS version
* Additional information such as workarounds
* A Fiddle or code sample that reproduces the issue 

For features:

* The feature
* Why
* Code samples showing the proposed API
* Notes on any impact you forsee the feature having

### 2. Fork the repo

[Fork iNoBounce](https://github.com/lazd/iNoBounce/fork) to your Github account and clone it to your local machine.

Be sure to add an upstream remote:

```
git remote add upstream git@github.com:lazd/iNoBounce.git
```

### 3. Create a branch

Create a branch from the lastest master named `issue/#`, where # is the issue number you're going to work on:

```
git checkout master
git pull upstream master
git checkout -b issue/10
```

### 4. Write some consistent, maintainable, and tested code

Install dependencies and start developing:

```
npm install
npm run watch
```

The test suite will run automatically each time you save a file.

Be sure to match the existing coding style as well as comment all that clever code you wrote as a result of a stoke of pure genius. Others may not understand your beautiful, elegant solution.

Include tests for everything you change, and test edge cases!

* If you fix a bug, include a test that proves you fixed it.
* If you added a feature, include a test that makes sure the feature works.

### 5. Make atomic commits that reference the issue

It's helpful if you make individual commits for atomic pieces of your contribution. This helps write a living history of the repository in the form of commit messages, and makes it much easier ot understand why specific changes were made.

For instance, if you're working on a bug that affects two parts of the project, it may useful to have two commits for each part. Didn't make atomic commits? Don't sweat it, your contribution is still welcome!

Your commit message should contain the issue number it closes or fixes.

If the commit is only part of the solution:

```
Don't assume overflow values, related to #10
```

For commits that fix bugs:

```
Specifically check for overflow-y, fixes #10
```

For commits that implement features:

```
Support rubberbanding when scrolled to the top or bottom, closes #10
```

### 6. Squash out the nonsense

Don't include commits with messages like `Fix typo, oops!`, please squash them into previous commits to reduce history pollution.

### 7. Push and send a pull request

Push your branch to your fork:

```
git push -u origin issue/10
```

Then, [send a pull request](https://github.com/lazd/iNoBounce/compare) against the `master` branch of lazd/iNoBounce.

