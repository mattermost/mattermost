---
title: "End-to-End (E2E) cheatsheets"
date: 2020-12-11T00:00:00
weight: 7
description: "This page describes custom commands and useful functions for End-to-End (E2E) testing with the Mattermost web application."
aliases:
  - contribute/webapp/e2e-cheatsheets/
  - contribute/more-info/webapp/e2e-cheatsheet/basic-code-structure/
  - contribute/more-info/webapp/e2e-cheatsheet/channel-menu/
  - contribute/more-info/webapp/e2e-cheatsheet/product-menu/
  - contribute/more-info/webapp/e2e-cheatsheet/settings-modal/
---

This page compiles all Cypress custom commands based on specific sections of the web app, as well as other general examples. The examples provided showcase the best and conventions on how to write great automated test scripts.
We encourage everyone to read this information, ask questions if something is not clear, and challenge the mentioned practices so that we can continuously refine and improve.

If you need to add more custom commands, add them to `/e2e-tests/cypress/tests/support`, and check out the {{<newtabref href="https://docs.cypress.io/api/cypress-api/custom-commands.html" title="Cypress custom commands">}} documentation. For ease of use, in-code documentation functionality, and making custom commands more discoverable, add type definitions. See this example of a {{<newtabref href="https://github.com/mattermost/mattermost/blob/master/e2e-tests/cypress/tests/support/api/user.d.ts" title="declaration file" >}} for reference on how to include and make type definitions.
_____
### General Queries with the Testing Library

The {{< newtabref href="https://testing-library.com/" title="Testing Library" >}} is used through the package `@testing-library/cypress`, and it provides simple and complete custom Cypress commands and utilities that encourage such good testing practices. To decide on the queries from the Testing Library you should be using while writing Cypress tests, check out this {{< newtabref href="https://testing-library.com/docs/guide-which-query/" title="article" >}} to learn more. For instance, you can select something with test ID using: `cy.findByTestId`. 

If you need more help, check out the {{< newtabref href="https://testing-playground.com/" title="online Testing Playground" >}}—no install required, always up-to-date, and it teaches you the exact Testing-Library queries you should be using as you click through the DOM. And if you’d rather stay in a VSCode editor, check out the {{< newtabref href="https://marketplace.visualstudio.com/items?itemName=aganglada.vscode-testing-playground" title="VS Code Testing Playground" >}} extension, which brings the same interactive query suggestions and best-practice guidance right into your IDE.

The following is a short summary of the recommended order of priority for queries:

#### :white_check_mark: Queries Accessible to Everyone
These reflect the experience of visual/mouse users as well as those that use assistive technology. Examples include: `cy.findByRole`, `cy.findByLabelText`, `cy.findByPlaceholderText`, `cy.findByText`, and `cy.findByDisplayValue`.

#### :white_check_mark: Semantic Queries
These use HTML5 and ARIA–compliant selectors. Note that the user experience of interacting with these attributes varies greatly across browsers and assistive technology. Some examples include: `cy.findByAltText` and `cy.findByTitle`.

#### :warning: Base Queries
These are considered part of implementation details and are discouraged to be used. You will still find base queries in the codebase but they will be replaced soon. Therefore, please refrain from reusing the existing base query patterns. However, you may want to use them only to limit the scope of selection. Examples include: `cy.get('#elementId')` and `cy.get('.class-name')`. Below is an acceptable use case of base queries:

```javascript
// limit the scope but chained with recommended query
cy.get('#elementId').should('be.visible').findByRole('button', {name: 'Save'}).click();

// limit the scope then use the recommended queries within the scope
cy.get('.class-name').should('be.visible').within(() => {
    cy.findByRole('input', {name: 'Position'}).type('Software Developer');
    cy.findByRole('button', {name: 'Save'}).click();
});
```

#### :white_check_mark: Query Variants

Note that `cy.findBy*` are shown but other variants are `cy.findAllBy*`, `cy.queryBy*`, and `cy.queryAllBy*`. See the {{< newtabref href="https://testing-library.com/docs/dom-testing-library/api-queries" title="Queries" >}} section from `testing-library`.

#### :x: Off-limits Queries
Please do not use any `Xpath` selectors such as the descendant selector. Do not use the `ul > li` and order selectors either, like `ul > li:nth-child(2)`. If an element can only be queried with this approach, then you may modify the application codebase, improve it, and make it "accessible to everyone".
_____
### Settings Modal
![settings modal image](../../../../img/e2e/settings-modal.png)

#### Opening the settings modal
The function `cy.uiOpenSettingsModal(section)` opens the settings modal when viewing a channel. `section` is of the 
< <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type">string</a> > type. Possible values for `section` are: `'Notifications'`, `'Display'`, `'Sidebar'`, and `'Advanced'`.

  * **Open 'Settings' modal and view the default 'General Settings'**: `cy.uiOpenSettingsModal();`
  * **Open the Settings modal and view a specific section (like the 'Advanced' section)**: `cy.uiOpenSettingsModal('Advanced');`
  * **Open the Settings modal, view a specific section, and change a setting**: 
    ```javascript
    // # Open 'Advanced' section of 'Settings' modal
    cy.uiOpenSettingsModal('Advanced').within(() => {
      // # Open 'Enable Join/Leave Messages' and turn it off
      cy.findByRole('heading', {name: 'Enable Join/Leave Messages'}).click();
      cy.findByRole('radio', {name: 'Off'}).click();
      // # Save and close the modal
      cy.uiSave();
      cy.uiClose();
    });
    ```

#### Selecting a section's button within a modal
Use the function `cy.findByRoleExtended('button', {name})`. `name` is of the < <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type">string</a> > type. Possible values for `name` are: `'Notifications'`, `'Display'`, `'Sidebar'`, and `'Advanced'`.

  * **Clicking a button within the Settings modal**:
    ```javascript
    // # Open 'Advanced' section of 'Settings' modal
    cy.uiOpenSettingsModal().within(() => {
      // # Click 'Notifications' button
      cy.findByRoleExtended('button', {name: 'Notifications'}).should('be.visible').click();
    });
    ```
#### Select a section's setting within a modal via the name of the section
Use the function `cy.findByRole('heading', {name})`. `name` is of the < <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type">string</a> > type. Possible values for `name` are: `'Full Name'`, `'Username'`, and others depending on the sections in the modal.

  * **Open a section within the Settings modal**:
    ```javascript
    // # Open 'Notifications' of 'Settings' modal
    cy.uiOpenSettingsModal('Notifications').within(() => {
      // # Open 'Words That Trigger Mentions' setting
      cy.findByRole('heading', {name: 'Words That Trigger Mentions'}).should('be.visible').click();
    });
    ```

#### Select a section's setting within a modal via role
Use the function `cy.findByRole(role, {name})`. `role` is of the < <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type">string</a> > type. Possible values for `role` are: `'textbox'`, `'radio'`, `'checkbox'` and other <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles">roles</a>. `name` is of the < <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type">string</a> > type. Possible values for `name` are: `'On'`, `'Off'`, and others depending on a section's settings.
  * **Change value of a section's setting in the Settings modal**: 
    ```javascript
    // # Open 'Notifications' of 'Settings' modal
    cy.uiOpenSettingsModal('Notifications').within(() => {
      // # Open 'Words That Trigger Mentions' setting
      cy.findByRole('heading', {name: 'Words That Trigger Mentions'}).should('be.visible').click();
      // # Check channel-wide mentions
      cy.findByRole('checkbox', {name: 'Channel-wide mentions "@channel", "@all", "@here"'}).click();
    });
    ```

#### Saving and closing a modal
`cy.uiSave` and `cy.uiClose` are common functions that can be used to save things and close modals.

  * **Saving and closing in the Settings modal**:
    ```javascript
    // # Open 'Notifications' of 'Settings' modal
    cy.uiOpenSettingsModal('Notifications').within(() => {
      // # Open 'Words That Trigger Mentions' setting
      cy.findByRole('heading', {name: 'Words That Trigger Mentions'}).should('be.visible').click();
      // # Check channel-wide mentions
      cy.findByRole('checkbox', {name: 'Channel-wide mentions "@channel", "@all", "@here"'}).click();
      // # Save then close the modal
      cy.uiSave();
      cy.uiClose();
    });
    ```
_____
### Channel Menu
![channel menu image](../../../../img/e2e/channel-menu.png)

#### Opening the channel menu
Use the function `cy.uiOpenChannelMenu(item)`. This will open the channel menu by clicking the channel header title or dropdown icon when viewing a channel. `item` is of the type < <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type">string</a> >. Possible values for `item` are: `'View Info'`, `'Move to...'`,`'Notification Preferences'`, `'Mute Channel'`, `'Add Members'`, `'Manage Members'`,`'Edit Channel Header'`, `'Edit Channel Purpose'`, `'Rename Channel'`, and `'Convert to Private Channel'`, `'Archive Channel'`, and `'Leave Channel'`.

  * **Open the channel menu normally**:
    ```javascript
    // # Open 'Channel Menu'
    cy.uiOpenChannelMenu();
    ```
  * **Open the channel menu and click on a specific item**:
    ```javascript
    // # Open 'Advanced' section of 'Settings' modal
    cy.uiOpenChannelMenu('View Info');
    ```
#### Closing the channel menu
Use the function `cy.uiCloseChannelMenu()`. This will close the channel menu by clicking the channel header title or dropdown icon again at the center channel view, given that the menu is already open.

#### Get the DOM elements of the channel menu
Use the function `cy.uiGetChannelMenu()`.
_____
### Product Menu
![product menu image](../../../../img/e2e/product-menu.png)

#### Opening the product menu
Use the function `cy.uiOpenProductMenu(item)`. `item` is of the type < <a target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type">string</a> >. Possible values for `item` are: `'Channels'`, `'Boards'`, `'Playbooks'`, `'System Console'`, `'Integrations'`, `'Marketplace'`, `'Download Apps'`, and `'About Mattermost'`.

* **Open the product menu normally**:
  ```javascript
  // # Open 'Product menu'
  cy.uiOpenProductMenu();
  ```
* **Open the product menu and click on a specific item**:
  ```javascript
  // # Open 'Integrations' section of 'Product Menu' modal
  cy.uiOpenProductMenu('Integrations');
  ```
#### Get the DOM elements of the product menu
Use the function `cy.uiGetProductMenu()`.
_____
