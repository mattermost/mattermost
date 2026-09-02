# dynamic_virtualized_list

A virtualized list that supports **dynamically-sized, unmeasured items** — rows whose
heights are not known ahead of time and are measured as they render. It is the rendering
engine behind Mattermost's long, variable-height message lists.

## Origin

This package was built from a fork of an alpha version of [`react-window`](https://github.com/bvaughn/react-window),
but took a substantially different approach — using relative rather than absolute positioning to render items whose sizes aren't known ahead of time.

## Files

| File | Purpose |
| --- | --- |
| `list_item.tsx` | Wrapper around each rendered row that reports its measured size back to the list. |
| `list_item_size_observer.ts` | Tracks rendered item sizes so the list can position rows without pre-measuring them. |
