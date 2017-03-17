# Upgrade guide from 2.x to 3.x

## Render functions

```javascript
// v2.x
<Scrollbars
  renderScrollbarHorizontal={props => <div {...props/>}
  renderScrollbarVertical={props => <div {...props}/>}>
{/* */}
</Scrollbars>

// v3.x
<Scrollbars
  renderTrackHorizontal={props => <div {...props/>}
  renderTrackVertical={props => <div {...props}/>}>
{/* */}
</Scrollbars>
```

## onScroll handler

```javascript
// v2.x
<Scrollbars
  onScroll={(event, values) => {
      // do something with event
      // do something with values, animate
  }}>
{/* */}
</Scrollbars>

// v3.x
<Scrollbars
  onScroll={event => {
      // do something with event
  }}
  onScrollFrame={values => {
      // do something with values, animate
      // runs inside animation frame
  }}>
{/* */}
</Scrollbars>
```
