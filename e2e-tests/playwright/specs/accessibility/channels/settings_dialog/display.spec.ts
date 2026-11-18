// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {focusVisible} from '../focus_support';

import {selectorOf} from './support';

/**
 * @objective Verify keyboard navigation through interactive elements in Display settings
 */
test(
    'navigate on keyboard tab between interactive elements',
    {tag: ['@accessibility', '@settings', '@display_settings']},
    async ({pw}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;
        const displaySettings = app.settings.panel('display');

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible and focus should be on the modal
        await expect(settingsModal).toBeVisible();
        await expect.poll(() => focusVisible(settingsModal)).toBe(true);

        // # Press Tab and verify focus is on Close button
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(settingsModal.closeButton)).toBe(true);

        // # Click on Display tab to open it
        await settingsModal.tabs.tab('display').select();
        await expect(settingsModal.tabs.tab('display')).toBeSelected();

        // * Display Settings panel should be visible
        await expect(displaySettings).toBeVisible();

        // # Press Tab to move focus to first edit button (Theme)
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(app.settings.display.section('theme').editButton)).toBe(true);

        // # Press Tab to move focus to Clock Display button
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(app.settings.display.section('clock').editButton)).toBe(true);

        // # Press Tab to move focus to Teammate Name Display button
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(app.settings.display.section('name_format').editButton)).toBe(true);

        // # Press Tab to move focus to Show online availability button
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(app.settings.display.section('availabilityStatus').editButton)).toBe(true);

        // # Press Tab to move focus to Share last active time button
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(app.settings.display.section('lastactive').editButton)).toBe(true);

        // # Press Tab to move focus to Timezone button
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(app.settings.display.section('timezone').editButton)).toBe(true);

        // # Press Tab to move focus to Website Link Previews button
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(app.settings.display.section('linkpreview').editButton)).toBe(true);

        // # Press Tab to move focus to Default Appearance of Image Previews button
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(app.settings.display.section('collapse').editButton)).toBe(true);

        // # Press Tab to move focus to Message Display button
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(app.settings.display.section('message_display').editButton)).toBe(true);

        // # Press Tab to move focus to Click to open threads button
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(app.settings.display.section('click_to_reply').editButton)).toBe(true);

        // # Press Tab to move focus to Channel Display button
        await page.keyboard.press('Tab');
        await expect
            .poll(() => focusVisible(app.settings.display.section('channel_display_mode').editButton))
            .toBe(true);

        // # Press Tab to move focus to Collapse category with unread channels button
        await page.keyboard.press('Tab');
        await expect
            .poll(() => focusVisible(app.settings.display.section('collapse_category_with_unreads').editButton))
            .toBe(true);

        // # Press Tab to move focus to Quick reactions button
        await page.keyboard.press('Tab');
        await expect
            .poll(() => focusVisible(app.settings.display.section('one_click_reactions_enabled').editButton))
            .toBe(true);

        // # Press Tab to move focus to Render emoticons button
        await page.keyboard.press('Tab');
        await expect
            .poll(() => focusVisible(app.settings.display.section('renderEmoticonsAsEmoji').editButton))
            .toBe(true);

        // # Press Tab to move focus to Language button
        await page.keyboard.press('Tab');
        await expect.poll(() => focusVisible(app.settings.display.section('languages').editButton)).toBe(true);
    },
);

/**
 * @objective Verify Display settings panel passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Display settings panel',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Display tab
        await settingsModal.tabs.tab('display').select();
        await expect(settingsModal.tabs.tab('display')).toBeSelected();

        // * Display Settings panel should be visible
        await expect(app.settings.panel('display')).toBeVisible();

        // * Verify aria snapshot of Display settings tab
        await expect(app.settings.panel('display')).toMatchAriaSnapshot(`
          - tabpanel "display":
            - heading "Display Settings" [level=3]
            - group:
              - heading "Theme" [level=4]
              - button "Theme Edit": Edit
              - text: /.+/
            - group:
              - heading "Clock Display" [level=4]
              - button "Clock Display Edit": Edit
              - text: /.+/
            - group:
              - heading "Teammate Name Display" [level=4]
              - button "Teammate Name Display Edit": Edit
              - text: /.+/
            - group:
              - heading "Show online availability on profile images" [level=4]
              - button "Show online availability on profile images Edit": Edit
              - text: /.+/
            - group:
              - heading "Share last active time" [level=4]
              - button "Share last active time Edit": Edit
              - text: /.+/
            - group:
              - heading "Timezone" [level=4]
              - button "Timezone Edit": Edit
              - text: /.+/
            - group:
              - heading "Website Link Previews" [level=4]
              - button "Website Link Previews Edit": Edit
              - text: /.+/
            - group:
              - heading "Default Appearance of Image Previews" [level=4]
              - button "Default Appearance of Image Previews Edit": Edit
              - text: /.+/
            - group:
              - heading "Message Display" [level=4]
              - button "Message Display Edit": Edit
              - text: /.+/
            - group:
              - heading "Click to open threads" [level=4]
              - button "Click to open threads Edit": Edit
              - text: /.+/
            - group:
              - heading "Channel Display" [level=4]
              - button "Channel Display Edit": Edit
              - text: /.+/
            - group:
              - heading "Collapse category with unread channels" [level=4]
              - button "Collapse category with unread channels Edit": Edit
              - text: /.+/
            - group:
              - heading "Quick reactions on messages" [level=4]
              - button "Quick reactions on messages Edit": Edit
              - text: /.+/
            - group:
              - heading "Render emoticons as emojis" [level=4]
              - button "Render emoticons as emojis Edit": Edit
              - text: /.+/
            - group:
              - heading "Language" [level=4]
              - button "Language Edit": Edit
              - text: /.+/
        `);

        // * Analyze the Display settings panel for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .include(selectorOf(app.settings.panel('display')))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Theme section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Theme section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Display tab
        await settingsModal.tabs.tab('display').select();
        await expect(settingsModal.tabs.tab('display')).toBeSelected();

        // # Click Edit on Theme section
        await app.settings.display.section('theme').editButton.click();

        // * Verify aria snapshot of Theme section when expanded
        await expect(app.settings.display.section('theme')).toBeVisible();
        await expect(app.settings.display.section('theme')).toMatchAriaSnapshot(`
          - heading "Theme" [level=4]
          - group "Theme":
            - text: Theme
            - radio "Premade Themes" [checked]
            - text: Premade Themes
            - radio "Custom Theme"
            - text: Custom Theme
            - button /.*/
            - button /.*/
            - button /.*/
            - button /.*/
            - button /.*/
            - link "See other themes"
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.display.section('theme').container))
            .disableRules(['color-contrast'])
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Timezone section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Timezone section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Display tab
        await settingsModal.tabs.tab('display').select();
        await expect(settingsModal.tabs.tab('display')).toBeSelected();

        // # Click Edit on Timezone section
        await app.settings.display.section('timezone').editButton.click();

        // * Verify aria snapshot of Timezone section when expanded
        await expect(app.settings.display.section('timezone')).toBeVisible();
        await expect(app.settings.display.section('timezone')).toMatchAriaSnapshot(`
          - heading "Timezone" [level=4]
          - checkbox "Automatic" [checked]
          - text: Automatic
          - log
          - text: /.+ Select the timezone used for timestamps in the user interface and email notifications./
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.display.section('timezone').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Language section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Language section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Display tab
        await settingsModal.tabs.tab('display').select();
        await expect(settingsModal.tabs.tab('display')).toBeSelected();

        // # Click Edit on Language section
        await app.settings.display.section('languages').editButton.click();

        // * Verify aria snapshot of Language section when expanded
        await expect(app.settings.display.section('languages')).toBeVisible();
        await expect(app.settings.display.section('languages')).toMatchAriaSnapshot(`
          - heading "Language" [level=4]
          - text: /.+/
          - log
          - text: /.+/
          - combobox /.+/
          - text: Select which language Mattermost displays in the user interface.
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.display.section('languages').container))
            .disableRules(['color-contrast', 'link-in-text-block'])
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Clock Display section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Clock Display section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Display tab
        await settingsModal.tabs.tab('display').select();
        await expect(settingsModal.tabs.tab('display')).toBeSelected();

        // # Click Edit on Clock Display section
        await app.settings.display.section('clock').editButton.click();

        // * Verify aria snapshot of Clock Display section when expanded
        await expect(app.settings.display.section('clock')).toBeVisible();
        await expect(app.settings.display.section('clock')).toMatchAriaSnapshot(`
          - heading "Clock Display" [level=4]
          - group "Clock Display":
            - text: Clock Display
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.display.section('clock').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Teammate Name Display section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Teammate Name Display section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Display tab
        await settingsModal.tabs.tab('display').select();
        await expect(settingsModal.tabs.tab('display')).toBeSelected();

        // # Click Edit on Teammate Name Display section
        await app.settings.display.section('name_format').editButton.click();

        // * Verify aria snapshot of Teammate Name Display section when expanded
        await expect(app.settings.display.section('name_format')).toBeVisible();
        await expect(app.settings.display.section('name_format')).toMatchAriaSnapshot(`
          - heading "Teammate Name Display" [level=4]
          - group "Teammate Name Display":
            - text: Teammate Name Display
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.display.section('name_format').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Message Display section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Message Display section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Display tab
        await settingsModal.tabs.tab('display').select();
        await expect(settingsModal.tabs.tab('display')).toBeSelected();

        // # Click Edit on Message Display section
        await app.settings.display.section('message_display').editButton.click();

        // * Verify aria snapshot of Message Display section when expanded
        await expect(app.settings.display.section('message_display')).toBeVisible();
        await expect(app.settings.display.section('message_display')).toMatchAriaSnapshot(`
          - heading "Message Display" [level=4]
          - group "Message Display":
            - text: Message Display
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.display.section('message_display').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Channel Display section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Channel Display section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Display tab
        await settingsModal.tabs.tab('display').select();
        await expect(settingsModal.tabs.tab('display')).toBeSelected();

        // # Click Edit on Channel Display section
        await app.settings.display.section('channel_display_mode').editButton.click();

        // * Verify aria snapshot of Channel Display section when expanded
        await expect(app.settings.display.section('channel_display_mode')).toBeVisible();
        await expect(app.settings.display.section('channel_display_mode')).toMatchAriaSnapshot(`
          - heading "Channel Display" [level=4]
          - group "Channel Display":
            - text: Channel Display
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.display.section('channel_display_mode').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Show online availability section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Show online availability section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Display tab
        await settingsModal.tabs.tab('display').select();
        await expect(settingsModal.tabs.tab('display')).toBeSelected();

        // # Click Edit on Show online availability section
        await app.settings.display.section('availabilityStatus').editButton.click();

        // * Verify aria snapshot of Show online availability section when expanded
        await expect(app.settings.display.section('availabilityStatus')).toBeVisible();
        await expect(app.settings.display.section('availabilityStatus')).toMatchAriaSnapshot(`
          - heading "Show online availability on profile images" [level=4]
          - group "Show online availability on profile images":
            - text: Show online availability on profile images
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.display.section('availabilityStatus').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Share last active time section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Share last active time section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Display tab
        await settingsModal.tabs.tab('display').select();
        await expect(settingsModal.tabs.tab('display')).toBeSelected();

        // # Click Edit on Share last active time section
        await app.settings.display.section('lastactive').editButton.click();

        // * Verify aria snapshot of Share last active time section when expanded
        await expect(app.settings.display.section('lastactive')).toBeVisible();
        await expect(app.settings.display.section('lastactive')).toMatchAriaSnapshot(`
          - heading "Share last active time" [level=4]
          - group "Share last active time":
            - text: Share last active time
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.display.section('lastactive').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Website Link Previews section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Website Link Previews section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Display tab
        await settingsModal.tabs.tab('display').select();
        await expect(settingsModal.tabs.tab('display')).toBeSelected();

        // # Click Edit on Website Link Previews section
        await app.settings.display.section('linkpreview').editButton.click();

        // * Verify aria snapshot of Website Link Previews section when expanded
        await expect(app.settings.display.section('linkpreview')).toBeVisible();
        await expect(app.settings.display.section('linkpreview')).toMatchAriaSnapshot(`
          - heading "Website Link Previews" [level=4]
          - group "Website Link Previews":
            - text: Website Link Previews
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.display.section('linkpreview').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Default Appearance of Image Previews section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Default Appearance of Image Previews section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Display tab
        await settingsModal.tabs.tab('display').select();
        await expect(settingsModal.tabs.tab('display')).toBeSelected();

        // # Click Edit on Default Appearance of Image Previews section
        await app.settings.display.section('collapse').editButton.scrollIntoView();
        await app.settings.display.section('collapse').editButton.click();

        // * Verify aria snapshot of Default Appearance of Image Previews section when expanded
        await expect(app.settings.display.section('collapse')).toBeVisible();
        await expect(app.settings.display.section('collapse')).toMatchAriaSnapshot(`
          - heading "Default Appearance of Image Previews" [level=4]
          - group "Default Appearance of Image Previews":
            - text: Default Appearance of Image Previews
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.display.section('collapse').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Click to open threads section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Click to open threads section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Display tab
        await settingsModal.tabs.tab('display').select();
        await expect(settingsModal.tabs.tab('display')).toBeSelected();

        // # Click Edit on Click to open threads section
        await app.settings.display.section('click_to_reply').editButton.click();

        // * Verify aria snapshot of Click to open threads section when expanded
        await expect(app.settings.display.section('click_to_reply')).toBeVisible();
        await expect(app.settings.display.section('click_to_reply')).toMatchAriaSnapshot(`
          - heading "Click to open threads" [level=4]
          - group "Click to open threads":
            - text: Click to open threads
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.display.section('click_to_reply').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Quick reactions on messages section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Quick reactions on messages section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Display tab
        await settingsModal.tabs.tab('display').select();
        await expect(settingsModal.tabs.tab('display')).toBeSelected();

        // # Click Edit on Quick reactions on messages section
        await app.settings.display.section('one_click_reactions_enabled').editButton.click();

        // * Verify aria snapshot of Quick reactions on messages section when expanded
        await expect(app.settings.display.section('one_click_reactions_enabled')).toBeVisible();
        await expect(app.settings.display.section('one_click_reactions_enabled')).toMatchAriaSnapshot(`
          - heading "Quick reactions on messages" [level=4]
          - group "Quick reactions on messages":
            - text: Quick reactions on messages
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.display.section('one_click_reactions_enabled').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify Render emoticons as emojis section passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Render emoticons as emojis section',
    {tag: ['@accessibility', '@settings', '@display_settings', '@snapshots']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {app, page} = await pw.testBrowser.login(user);
        const globalHeader = app.globalHeader;
        const settingsModal = app.userSettingsModal;

        // # Visit a default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();
        await expect(app.center.postCreate.message.container).toBeVisible();

        // # Set focus to Settings button and press Enter
        await globalHeader.settingsButton.focus();
        await page.keyboard.press('Enter');

        // * Settings modal should be visible
        await expect(settingsModal).toBeVisible();

        // # Open Display tab
        await settingsModal.tabs.tab('display').select();
        await expect(settingsModal.tabs.tab('display')).toBeSelected();

        // # Click Edit on Render emoticons as emojis section
        await app.settings.display.section('renderEmoticonsAsEmoji').editButton.click();

        // * Verify aria snapshot of Render emoticons as emojis section when expanded
        await expect(app.settings.display.section('renderEmoticonsAsEmoji')).toBeVisible();
        await expect(app.settings.display.section('renderEmoticonsAsEmoji')).toMatchAriaSnapshot(`
          - heading "Render emoticons as emojis" [level=4]
          - group "Render emoticons as emojis":
            - text: Render emoticons as emojis
            - radio /.+/ [checked]
            - text: /.+/
            - radio /.+/
            - text: /.+/
          - separator
          - alert
          - button "Save"
          - button "Cancel"
        `);

        // # Analyze the expanded section for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page)
            .include(selectorOf(app.settings.display.section('renderEmoticonsAsEmoji').container))
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);
