---
title: "External views"
sidebar_position: 4
---

To provide access to different servers, we create a series of `BrowserView` objects that directly render on top of the Main Window and load the Mattermost Web App directly from the server they correspond to. We wrap these `BrowserView` objects into a `MattermostView` that manages the loading of the view and handles events such as navigation and notifications.

These views are also contained within and managed by the `viewManager` class. The class is responsible for adding and removing the views from the Main Window when the user needs them and handling IPC calls from the renderer processes and passing them to the child objects.