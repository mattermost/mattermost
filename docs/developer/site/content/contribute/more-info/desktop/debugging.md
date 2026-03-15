---
title: "Debug the desktop app"
heading: "Debug the desktop app"
description: "The electron app itself can be inspected using the developer tools, available from the View menu of Safari."
date: 2019-01-22T00:00:00-05:00
weight: 3
aliases:
  - /contribute/desktop/debugging
---

## Debug the main process

The simplest way to debug the main process is to simply insert logging statements wherever needed and have the application output logs of whatever is necessary.

For already built applications (or bugs that only appear in the packaged version of the application), you can view the Logs by going to Help > Show Logs in the 3-dot menu, which will open a file manager window showing the location of the log file.

If you'd like to make use of better debugging tools, you can use the Chrome Dev Tools or the debugger in VSCode by following the steps here: https://www.electronjs.org/docs/latest/tutorial/debugging-main-process

## Debug the renderer process

The renderer processes are controller by Chrome instances, so each of them will have their own Developer Tools instance.

You can access these instances by going to the **View > Developer Tools** menu (under the 3-dot menu on Windows/Linux, and in the top bar on macOS) and selecting:
- **Developer Tools for Application Wrapper** for anything involving the top bar.
- **Developer Tools for Current Tab** for anything involving the Mattermost view or the preload script.
    {{<note "Note:">}} For this one, make sure you're currently on the tab where you want to load the Developer Tools. You can have instances open for tabs you aren't currently viewing, but to open them in the first place requires it to be opened.
    {{</note>}}
- **Developer Tools for Call Widget** if you are using Mattermost Calls and the calls widget is currently open.

There are other `BrowserViews` that are governed seperately from the main application wrapper, including:
- Dropdown Menu
    - You can open this one by adding a line in the `main/teamDropdownView.ts` file. In the constructor, at the end, add:
        ```js
        this.view.webContents.openDevTools({mode: 'detach'});
        ```
- Modals
    - You can open these by setting an environment variable when running the Desktop App called `MM_DEBUG_MODALS`.
        ```
        // macOS/Linux
        export MM_DEBUG_MODALS=1

        // Windows PowerShell
        $env:MM_DEBUG_MODALS = 1
        ```
- URL View
    - You can open this one by adding a line in the `main/viewManager.ts` file. In the function `showURLView`, at the end, add:
        ```js
        urlView.webContents.openDevTools({mode: 'detach'});
        ```
        {{<note "Note:">}} This view is ephemeral and based on whether a link is hovered with the mouse, so it might be best to use some logging instead here.
        {{</note>}}

## Debug the Mattermost Server/webapp

Some issues are only reproducible on the Desktop App, though the code that is causing the issue may not live in the Desktop App.

Here are some ways of determining whether this is true:
- Does the issue reproduce on the browser? Specifically Chrome?
- Does the issue surround a piece of code on the server/webapp that only applies to the Desktop App? You can check this by seeing if there is a call to `isDesktopApp` in the webapp.

If you have determined that the issue doesn't apply to the Desktop App code base directly, you can file a ticket in the appropriate repository, such as the {{< newtabref href="https://github.com/mattermost/mattermost" title="server and web app" >}} repository.

If you are having trouble determining where the issue lies, feel free to post in the {{< newtabref href="https://community.mattermost.com/core/channels/desktop-app" title="Developers: Desktop App" >}} on Mattermost Community, or you can file a ticket in the {{< newtabref href="https://github.com/mattermost/mattermost" title="server and web app" >}} repository and it will be triaged and transferred to the appropriate location.

