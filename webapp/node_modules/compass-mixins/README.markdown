[![Build Status](https://travis-ci.org/Igosuki/compass-mixins.svg?branch=master)](https://travis-ci.org/Igosuki/compass-mixins)

# Compass SASS Stylesheets

This is a repository to pull SASS style sheets on Bower, and enjoy the compass mixins by using libsass for faster compilation. This project makes minimal modifications to the original stylesheets from the [original repository](https://github.com/Compass/compass/tree/stable/core/stylesheets), intented to improve libsass compatibility and not change output.

## Compass Ruby Functions

This project includes reasonably similar implementations of some of the Ruby functions that Compass provides as Sass extensions. These are used in some Compass mixins, such as `@include background()`.

To make those functions available to your compass mixins, you'll want to either `@import "compass";` or `@import "compass/functions"'` before the specific compass scss files you import.

## Contributors
Guillaume Balaine Igosuki@github
Michael Heillein michaek@github

## License
Copyright (c) 2008-2009 Christopher M. Eppstein<br>
All Rights Reserved.<br>
Released under a [slightly modified MIT License](https://github.com/Compass/compass/blob/stable/LICENSE.markdown).

