# 2.1.7

* Replaced the `has-own` module with `has`.

# 2.1.6

* Fixes an issue where the module would discard at-rules that were defined in
  `@media` & `@supports` rules as well as the root. As this is legal to do in
  CSS, the module now checks to see if the candidate rule has the same parent
  as the cached rule. If it does, the rules are merged.

# 2.1.5

* Now compiled with babel 6.

# 2.1.4

* Fixed a range error which happened when duplicated at rules were found
  in the stylesheet.

# 2.1.3

* Fixed an infinite loop regression in the last patch.

# 2.1.2

* Fixes a bug where sometimes values would be substituted by JS code.

# 2.1.1

* Updates postcss-value-parser to version 3 (thanks to @TrySound).

# 2.1.0

* Replaced css-list with postcss-value-parser, reduced AST iterations from 4
  to 1 for increased performance.

# 2.0.0

* Upgraded to PostCSS 5.

# 1.0.2

* Minor boost in performance with reduced stringify passes.

# 1.0.1

* Fixes an issue where duplicated keyframes with the same name would cause
  an infinite loop.

# 1.0.0

* Initial release.
