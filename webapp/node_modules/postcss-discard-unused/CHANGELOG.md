# 2.2.2

* Removed a dependency on `flatten`.
* Performance tweaks; now performs a single AST pass instead of four.

# 2.2.1

* Now compiled with Babel 6.

# 2.2.0

* Added a new option to remove `@namespace` rules (thanks to @plesiecki).

# 2.1.0

* Added options to customise what the module discards (thanks to @TrySound).

# 2.0.0

* Upgraded to PostCSS 5.

# 1.0.3

* Improved performance by reducing the amount of AST iterations.
* Converted the codebase to ES6.

# 1.0.2

* Fixes an integration issue where the module would crash on `undefined`
  `rule.nodes`.

# 1.0.1

* Fixes an issue where multiple animations were not being recognized.

# 1.0.0

* Initial release.
