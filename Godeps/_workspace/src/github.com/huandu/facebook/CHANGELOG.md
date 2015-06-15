# Change Log #

## v1.5.2 ##

* `[FIX]` [#32](https://github.com/huandu/facebook/pull/32) BatchApi/Batch returns facebook error when access token is not valid.

## v1.5.1 ##

* `[FIX]` [#31](https://github.com/huandu/facebook/pull/31) When `/oauth/access_token` returns a query string instead of json, this package can correctly handle it.

## v1.5.0 ##

* `[NEW]` [#28](https://github.com/huandu/facebook/pull/28) Support debug mode introduced by facebook graph API v2.3.
* `[FIX]` Removed all test cases depending on facebook graph API v1.0.

## v1.4.1 ##

* `[NEW]` [#27](https://github.com/huandu/facebook/pull/27) Timestamp value in Graph API response can be decoded as a `time.Time` value now. Thanks, [@Lazyshot](https://github.com/Lazyshot).

## v1.4.0 ##

* `[FIX]` [#23](https://github.com/huandu/facebook/issues/24) Algorithm change: Camel case string to underscore string supports abbreviation

Fix for [#23](https://github.com/huandu/facebook/issues/24) could be a breaking change. Camel case string `HTTPServer` will be converted to `http_server` instead of `h_t_t_p_server`. See issue description for detail.

## v1.3.0 ##

* `[NEW]` [#22](https://github.com/huandu/facebook/issues/22) Add a new helper struct `BatchResult` to hold batch request responses.

## v1.2.0 ##

* `[NEW]` [#20](https://github.com/huandu/facebook/issues/20) Add Decode functionality for paging results. Thanks, [@cbroglie](https://github.com/cbroglie).
* `[FIX]` [#21](https://github.com/huandu/facebook/issues/21) `Session#Inspect` cannot return error if access token is invalid.

Fix for [#21](https://github.com/huandu/facebook/issues/21) will result a possible breaking change in `Session#Inspect`. It was return whole result returned by facebook inspect api. Now it only return its "data" sub-tree. As facebook puts everything including error message in "data" sub-tree, I believe it's reasonable to make this change.

## v1.1.0 ##

* `[FIX]` [#19](https://github.com/huandu/facebook/issues/19) Any valid int64 number larger than 2^53 or smaller than -2^53 can be correctly decoded without precision lost.

Fix for [#19](https://github.com/huandu/facebook/issues/19) will result a possible breaking change in `Result#Get` and `Result#GetField`. If a JSON field is a number, these two functions will return json.Number instead of float64.

The fix also introduces a side effect in `Result#Decode` and `Result#DecodeField`. A number field (`int*` and `float*`) can be decoded to a string. It was not allowed in previous version.

## v1.0.0 ##

Initial tag. Library is stable enough for all features mentioned in README.md.
