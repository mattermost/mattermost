# 2.3.1

* Performance tweaks: now performs one AST pass instead of three.

# 2.3.0

* Adds support for a custom encoder function (thanks to @rauchg).

# 2.2.2

* Now compiled with babel 6.

# 2.2.1

* Updates postcss-value-parser to version 3 (thanks to @TrySound).

# 2.2.0

* Added options for customising what the module reduces (thanks to @TrySound).
* Replaced regex number test with postcss-value-parser unit method.

# 2.1.0

* Replaced reduce-function-call with postcss-value-parser (thanks to @TrySound).

# 2.0.0

* Upgraded to PostCSS 5.

# 1.0.3

* Improved performance by iterating the AST less times.

# 1.0.2

* Fixes an issue where multiple, comma separated animations with insufficient
  whitespace were not being renamed.

# 1.0.1

* Documentation/metadata tweaks for plugin guidelines compatibility.

# 1.0.0

* Initial release.
