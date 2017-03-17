# Changes

## Breaking Changes

Major API changes to Component props, SingleValue and Value have been merged

The component is now "controlled", which means you have to pass value as a prop and always handle the `onChange` event. See https://facebook.github.io/react/docs/forms.html#controlled-components

Using values that aren't in the `options` array is still supported, but they have to be full options (previous versions would expand strings into `{ label: string, value: string }`)

Options & Value components get their label as their Children

new `simpleValue` prop for when you want to deal with values as strings or numbers (legacy behaviour, defaults to false). onChange no longer receives an array of expanded values as the second argument.

`onOptionLabelClick` -> `onValueClick`

Multiple values are now submitted in multiple form fields, which results in an array of values in the form data. To use the old method of submitting a single string of all values joined with the delimiter option, use the `joinValues` prop.

## New Select.Async Component

`loadingPlaceholder` prop
`cacheAsyncResults` -> `cache` (new external cache support) - defaults to true

## Fixes & Other Changes

new `ignoreAccents` prop (on by default), thanks [Guilherme Guerchmann](https://github.com/Agamennon)
new `escapeClearsValue` prop (on by default)
bug where the filter wouldn't be reset after blur
complex option values are much better supported now, won't throw duplicate key errors and will serialize to the input correctly

## Notes

`undefined` default props are no longer declared
