# 2.1.1

* Fixes an issue where all positive indices before a negative index were
  transformed (thanks to @niccai).

# 2.1.0

* Now aborts early when encountering negative indices, making the transform
  safer overall.

# 2.0.1

* Improved performance of the module by sorting/deduplicating values in one pass
  instead of per-value (thanks to @pgilad).

# 2.0.0

* Upgraded to PostCSS 5.

# 1.1.3

* Improved performance by iterating the AST in a single pass and caching nodes for the second iteration.

# 1.1.2

* Documentation/metadata tweaks for plugin guidelines compatibility.

# 1.1.1

* Corrected dependency tree when installing from npm.

# 1.1.0

* Now uses the PostCSS `4.1` plugin API.

# 1.0.1

* Adds a JSHint config, code tidied up.

# 1.0.0

* Initial release.
