// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-template-curly-in-string -- cases quote template-literal syntax */

import {RuleTester} from 'eslint';

import noLiteralLocators from './e2e-no-literal-locators.js';

const ruleTester = new RuleTester({languageOptions: {ecmaVersion: 2022, sourceType: 'module'}});

ruleTester.run('e2e-no-literal-locators', noLiteralLocators, {
    valid: [
        {code: 'await app.channelHeader.openMenuButton.click();'},
        {code: 'await expect(app.center.postList).toContainMessage(Msg.x.y, {u});'},
        {code: 'page.getByTestId(id);'},
        {code: 'page.getByRole("button");'},
        {code: 'page.getByRole("button", {name: label});'},
        {code: 'page.getByRole("button", {name: formatMessage(Msg.x)});'},
        {code: 'await composer.messageTextbox.fill("text a user types");'},
        {code: 'let name = "Save"; name = other; page.getByRole("button", {name});'},
        {code: 'items.filter({has: app.x.locator});'},
        {code: 'items.filter({hasText: user.username});'},
        {code: 'page.locator(`#post_${id}`);', options: [{templates: false}]},
        {code: 'const SAVE = "Save"; page.getByRole("button", {name: SAVE});', options: [{variables: false}]},
        {code: 'rows.filter({hasText: "Town Square"});', options: [{hasText: false}]},
        {code: 'page.evaluate(() => document.querySelector("[data-testid=x]"));', options: [{selectors: false}]},
    ],
    invalid: [
        {code: 'page.getByTestId("channel_view");', errors: [{message: /getByTestId\(\)` with a literal/}]},
        {code: 'page.locator("#searchBox");', errors: [{message: /locator\(\)` with a literal/}]},
        {code: 'page.getByText(`Save`);', errors: [{message: /getByText/}]},
        {code: 'page.getByTestId(/^center\\.post_list/);', errors: [{message: /getByTestId/}]},
        {code: 'page.getByRole("button", {name: "Save"});', errors: [{message: /literal name/}]},

        // templated locators
        {code: 'page.locator(`#post_${id}`);', errors: [{message: /locator\(\)` with a template literal/}]},
        {code: 'page.getByTestId(`center.post:${id}--button`);', errors: [{message: /template literal/}]},

        // names held in variables
        {code: 'const SAVE = "Save"; page.getByRole("button", {name: SAVE});', errors: [{message: /string held in a const as the name/}]},
        {code: 'const ID = "channel_view"; page.getByTestId(ID);', errors: [{message: /string held in a const/}]},

        // text filters
        {code: 'rows.filter({hasText: "Town Square"});', errors: [{message: /filter\(\{hasText\}\)/}]},
        {code: 'rows.filter({hasNotText: /Archived/});', errors: [{message: /filter\(\{hasNotText\}\)/}]},

        // testid selectors anywhere, including inside evaluate
        {code: 'page.evaluate(() => document.querySelector("[data-testid=\\"post_list\\"]"));', errors: [{message: /data-testid` selector/}]},
        {code: 'page.$$(`[data-testid^="${prefix}"]`);', errors: [{message: /data-testid` selector/}]},
        {code: 'page.locator("[data-testid=x]");', errors: [{message: /locator\(\)` with a literal/}]},
    ],
});
