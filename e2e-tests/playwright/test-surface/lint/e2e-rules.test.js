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
        {code: 'scope.getByTestId(id);'},
        {code: 'scope.getByRole("button", {name: label});'},
        {code: 'scope.getByRole("button", {name: formatMessage(Msg.x)});'},
        {code: 'await composer.messageTextbox.fill("text a user types");'},
        {code: 'let name = "Save"; name = other; scope.getByRole("button", {name});'},
        {code: 'items.filter({has: app.x.locator});'},
        {code: 'items.filter({hasText: user.username});'},
        {code: 'scope.locator(`#post_${id}`);', options: [{templates: false}]},
        {code: 'const SAVE = "Save"; scope.getByRole("button", {name: SAVE});', options: [{variables: false}]},
        {code: 'rows.filter({hasText: "Town Square"});', options: [{hasText: false}]},
        {code: 'scope.evaluate(() => 1);'},
        {code: 'scope.evaluate((el) => el.scrollTop);'},

        // a role held in a variable is not a literal
        {code: 'scope.getByRole(role);'},

        // the options that turn the added checks off
        {code: 'scope.getByRole("menuitem");', options: [{roles: false}]},
        {code: 'page.getByTestId(id);', options: [{pageRooted: false}]},
        {code: 'page.$("x");', options: [{legacy: false}]},
        {code: 'document.querySelector("x");', options: [{legacy: false}]},
    ],
    invalid: [
        {code: 'scope.getByTestId("channel_view");', errors: [{message: /getByTestId\(\)` with a literal/}]},
        {code: 'scope.locator("#searchBox");', errors: [{message: /locator\(\)` with a literal/}]},
        {code: 'scope.getByText(`Save`);', errors: [{message: /getByText/}]},
        {code: 'scope.getByTestId(/^center\\.post_list/);', errors: [{message: /getByTestId/}]},
        {code: 'scope.getByRole("button", {name: "Save"});', errors: [{message: /literal name/}]},

        // templated locators
        {code: 'scope.locator(`#post_${id}`);', errors: [{message: /locator\(\)` with a template literal/}]},
        {code: 'scope.getByTestId(`center.post:${id}--button`);', errors: [{message: /template literal/}]},

        // names held in variables
        {code: 'const SAVE = "Save"; scope.getByRole("button", {name: SAVE});', errors: [{message: /string held in a const as the name/}]},
        {code: 'const ID = "channel_view"; scope.getByTestId(ID);', errors: [{message: /string held in a const/}]},

        // text filters
        {code: 'rows.filter({hasText: "Town Square"});', errors: [{message: /filter\(\{hasText\}\)/}]},
        {code: 'rows.filter({hasNotText: /Archived/});', errors: [{message: /filter\(\{hasNotText\}\)/}]},

        // testid selectors anywhere, including inside evaluate
        {code: 'scope.evaluate(() => document.querySelector("[data-testid=\\"post_list\\"]"));', errors: [{message: /querySelector\(\)` in a spec/}, {message: /data-testid` selector/}]},
        {code: 'scope.$$(`[data-testid^="${prefix}"]`);', errors: [{message: /\$\$\(\)` in a spec/}, {message: /data-testid` selector/}]},
        {code: 'scope.locator("[data-testid=x]");', errors: [{message: /locator\(\)` with a literal/}]},

        // a role with no name is a raw lookup
        {code: 'scope.getByRole("menuitem");', errors: [{message: /only a role/}]},
        {code: 'scope.getByRole("button", {exact: true});', errors: [{message: /only a role/}]},

        // any lookup made directly on the page, whatever its argument
        {code: 'page.getByTestId(id);', errors: [{message: /getByTestId\(\)` on the page/}]},
        {code: 'app.page.locator(selector);', errors: [{message: /locator\(\)` on the page/}]},
        {code: 'page.getByRole("button", {name: formatMessage(Msg.x)});', errors: [{message: /getByRole\(\)` on the page/}]},
        {code: 'this.page.getByText(text);', errors: [{message: /getByText\(\)` on the page/}]},

        // the old selector APIs and DOM queries by selector
        {code: 'page.$("#x");', errors: [{message: /\$\(\)` in a spec/}]},
        {code: 'scope.$eval("#x", (el) => el.id);', errors: [{message: /\$eval\(\)` in a spec/}]},
        {code: 'page.waitForSelector("#x");', errors: [{message: /waitForSelector\(\)` in a spec/}]},
        {code: 'scope.evaluate(() => document.getElementById("x"));', errors: [{message: /getElementById\(\)` in a spec/}]},
        {code: 'scope.evaluate(() => document.querySelectorAll(".x"));', errors: [{message: /querySelectorAll\(\)` in a spec/}]},
    ],
});
