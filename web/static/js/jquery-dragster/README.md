Include [jquery.dragster.js](https://rawgithub.com/catmanjan/jquery-dragster/master/jquery.dragster.js) in page.

Works in IE.

```javascript
$('.element').dragster({
	enter: function (dragsterEvent, event) {
		$(this).addClass('hover');
	},
	leave: function (dragsterEvent, event) {
		$(this).removeClass('hover');
	},
	drop: function (dragsterEvent, event) {
		$(this).removeClass('hover');
	}
});
```