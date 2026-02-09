# Post List Scroll Compensation

## Status: Needs Work - scrolling is janky when content height changes

The post list uses a `DynamicVirtualizedList` with a singleton `ResizeObserver` to track post height changes and adjust scroll position. This is critical for smooth UX when images load, encrypted files decrypt, or any post content changes height dynamically.

## Architecture

### Key Files

| File | Role |
|------|------|
| `webapp/channels/src/components/dynamic_virtualized_list/list_item_size_observer.ts` | Singleton ResizeObserver managing all list items |
| `webapp/channels/src/components/dynamic_virtualized_list/list_item.tsx` | Per-item wrapper, observes its DOM element for size changes |
| `webapp/channels/src/components/dynamic_virtualized_list/index.jsx` | Main list component with `_handleNewMeasurements` scroll correction (lines 462-536) |
| `webapp/channels/src/components/size_aware_image.tsx` | Image component that triggers `onImageLoaded` after load |

### Flow

```
1. Each post row is wrapped in a ListItem component
2. ListItem registers its DOM element with the singleton ResizeObserver
3. Content height changes (image load, encrypted file decrypt, embed expand, etc.)
4. ResizeObserver fires callback
5. ListItem receives debounced (200ms) height change notification
6. Calls onHeightChange(itemId, newHeight, forceScrollCorrection)
7. DynamicVirtualizedList._handleNewMeasurements adjusts scroll
```

### Scroll Correction Logic

In `_handleNewMeasurements` (index.jsx:462-536):

```
delta = newSize - oldSize

If user was at bottom:
  -> scrollToItem(0, 'end') to stay at bottom

If item is above visible area (forceScrollCorrection or _keepScrollPosition):
  -> scrollOffset += delta (shift scroll to compensate)
  -> Applied via _correctScroll() after batching all corrections
```

### What Triggers Height Changes

| Trigger | How It Works |
|---------|-------------|
| Image loading | `SizeAwareImage.handleLoad` (size_aware_image.tsx:157-172) fires after `<img onLoad>`. ResizeObserver auto-detects the height change. |
| Encrypted file decryption | File transitions from small FileAttachment placeholder to full-size image. Large height delta. |
| Container width change | `forceScrollCorrection=true` flag set in list_item.tsx:61 |
| Embed expand/collapse | Toggle visibility changes post height |
| Code block expand | Collapsed code blocks expanding |

## Known Issues

### Janky Scrolling
The 200ms debounce on height change callbacks causes visible jank. Content visibly shifts before scroll catches up.

### Encrypted File Transitions
When an encrypted file decrypts and the component switches from a FileAttachment (~6.4rem tall) to a full-size image in SingleImageView or MultiImageView, the height delta is large and abrupt. This causes a noticeable jump.

### Batch Decryption
Multiple encrypted files in one post cause multiple sequential height changes, each triggering a separate scroll adjustment. This compounds the jank.

## Potential Improvements

- **Reduce debounce time** for smoother compensation (200ms is quite long)
- **Pre-allocate placeholder height** closer to expected image size for encrypted files
- **CSS transitions** on container height for smoother visual changes
- **Batch corrections** - accumulate multiple height deltas into a single scroll adjustment
- **requestAnimationFrame** for scroll corrections instead of setState (avoids render cycle delay)
- **Predictive sizing** - if we know an encrypted file is an image, allocate a reasonable placeholder height before decryption completes
