---
title: "Navigation"
heading: "Navigation"
description: "Explains how the Desktop App does navigation wrt. Mattermost"
date: 2023-01-24T00:00:00-05:00
weight: 2
aliases:
  - /contribute/desktop/architecture/navigation
---

The Desktop App exercises relatively strict control over the user's ability to navigate through the web. This is done for a few reasons:
- **Security:** Since we expose certain Electron (and therefore NodeJS) APIs to the front-end application, we want to be in control of what scripts are run in the front-end. We make a concerted effort to lock down the exposed APIs to only what is necessary; however, to avoid any privacy or security breaches, it's best to avoid allowing the user to navigate to any page that isn't explicitly trusted.
- **User Experience:** Our application is ONLY designed to work with the Mattermost Web App and thus allowing the user to navigate to other places that are not the Web App is not a supported use case, and could create some undesirable effects.

![Navigation diagram](navigation-diagram.png)

### Internal navigation
  
The Mattermost Web App is self-contained, with the majority of links provided by `react-router` and thus most navigation is handled by that module. However, in the Desktop App, we have a major feature that allows users to navigate between distinct tabs bound to the same server. There are two ways that this style of navigation happens in the Web App:
- A user clicks on a link provided by the `react-router` `Link` component
- The application calls `browserHistory.push` directly within the Web App based on the user action
Both of these methods will make use of the `browserHistory` module within the Web App.

When one of the above methods is used, normally the Web App would update the browser's URL and change the state of the page. In the Desktop App, we instead send the arguments of the call to `browserHistory.push` up to the Electron Main Process. The information is received at the method `WindowManager.handleBrowserHistoryPush`, where we perform the following actions:
- **Clean the path name by removing any part of the server's subpath pathname.** 
    - When the arguments are sent up to the Desktop App, it includes the subpath of the server hosting it. 
    - As an example, if the server URL is `http://server-1.com/mattermost`, any path that is received will start with `/mattermost` and we will need to remove that component. The same would be true for any other path following the origin `http://server-1.com`.
- **Retrieve the view matching the path name**
    - After removing the leading subpath (if applicable), we check to see if a portion of the path matches one of the other tabs, signally that we will need to switch to that tab.
    - For server `http://server-1.com/mattermost`, if the pathname is `/mattermost/boards/board1`, we would get the *Boards* view matching the server.
- **Display the correct view and send the cleaned path to its renderer process**
    - We then explicitly display the new view if it's not currently in focus. If it's closed, we open it and load the corresponding URL with the provided path.
    - *Exception*: If we're redirecting to the root of the application and the user is not logged in, it will generate an unnecessary refresh. In this case, we do not send the path name down.

### External navigation

For the cases where a user wants to navigate away from the Web App to an external site, we generally want to direct the user outside of the Desktop App and have them open their default web browser and use the external site in that application.

In order to achieve this, we need to explicitly handle every other link and method of navigation that is available to an Electron renderer process. Fortunately, Electron provides a few listeners that help us with that:
- [**will-navigate**](https://www.electronjs.org/docs/latest/api/web-contents#event-will-navigate) is an event that fires when the URL is changed for a given renderer process. Attaching a listener for this event allows us to prevent the navigation if desired.
    - NOTE: The event will not fire for in-page navigations or updating `window.location.hash`.
- [**did-start-navigation**](https://www.electronjs.org/docs/latest/api/web-contents#event-did-start-navigation) is another renderer process event that will fire once the page has started navigating. We can use this event to perform any actions when a certain URL is visited.
- [**new-window**](https://www.electronjs.org/docs/latest/breaking-changes#removed-webcontents-new-window-event) is an event that will fire when the user tries to open a new window or tab. This commonly will fire when the user clicks on a link marked `target=_blank`. We attach this listener using the `setWindowOpenHandler` and will allow us to `allow` or `deny` the opening as we desire.

In our application, we define all of these listeners in the `webContentEvents` module, and we attach them whenever a new [webContents](https://www.electronjs.org/docs/latest/api/web-contents) object is create to make sure that all renderer processes are correctly secured and set up correctly.

#### New window handling
Our new window handler will *deny* the opening of a new Electron window if any of the following cases are true:
- **Malformed URL:** Depending on the case, it will outright ignore it (if the URL could not be parsed), or it will open the user's default browser if it is somehow invalid in another way.
- **Untrusted Protocol:** If the URL does not match an allowed protocol (allowed protocols include `http`, `https`, and any other protocol that was explicitly allowed by the user). 
    - In this case, it will ask the user whether the protocol should be allowed, and if so will open the URL in the user's default application that corresponds to that protocol.
- **Unknown Site:** If the URL does not match the root of a configured server, it will always try to open the link in the user's default browser.
    - If the URL DOES match the root of a configured server, we still will deny the window opening for a few cases:
        - If the URL matches the public files route (`/api/v4/public/files/*`)
        - If the URL matches the image proxy route (`/api/v4/image/*`)
        - If the URL matches the help route (`/help/*`)
    - For these cases, we will open the link in the user's browser.
- **Deep Link Case**: If the URL doesn't match any of the above routes, but is still a valid configured server, we will generally treat is as the deep link cause, and will instead attempt to show the correct tab as well as navigate to the corresponding URL within the app.

There are two cases where we do allow the application to open a new window:
- If the URL matches the `devtools:` protocol, so that we can open the Chrome Developer Tools.
- If the URL is a valid configured server URL that corresponds to the plugins route (`/plugins/*`). In these cases we allow a single popup per tab to be opened for certain plugins to do things like OAuth (e.g. GitHub or JIRA).

Any other case will be automatically denied for security reasons.

#### Links within the same window
By default, the Mattermost Web App marks any link external to its application as `target=_blank`, so that the application doesn't try to open it in the same window. Any other links should therefore be internal to the application.

We *deny* any sort of in-window navigation with the following exceptions: if the link is a `mailto:` link (which always opens the default mail program), OR if we are in the custom login flow.

#### Custom login flow
In order to facilitate logging into to the app using an external provider (e.g. Okta) in the same way that one would in the browser, we add an exception to the navigation flow that bypasses the `will-navigate` check.

When a user clicks on a login link that redirects them to a matching URL scheme (listed [here](https://github.com/mattermost/desktop/blob/master/src/common/utils/constants.ts#L48)), we will activate the custom login flow. The URL *MUST* still be internal to the application before we activate this flow, or any URL matching this pattern would allow the app to circumvent the navigation protection.

While the current window is in the custom login flow, all links that emit the `will-navigate` event will be allowed. Anything that opens a new window will still be restricted based on the rules for new windows. We leave the custom login flow once the app has navigated back to an URL internal to the application