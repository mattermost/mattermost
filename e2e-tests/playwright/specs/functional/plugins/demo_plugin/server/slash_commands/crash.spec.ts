// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
  // See LICENSE.txt for license information.

  import {test, expect} from '@mattermost/playwright-lib';

  test('should crash plugin via /crash command and verify recovery', async ({pw}) => {
      // Setup: Install and enable the demo plugin
      const {adminClient, user} = await pw.initSetup();
      const {channelsPage} = await pw.testBrowser.login(user);

      await channelsPage.goto();
      await channelsPage.toBeVisible();

      // Enable public links (required for plugin installation from URL)
      await adminClient.patchConfig({
          FileSettings: {EnablePublicLink: true},
      });

      // Install and enable the demo plugin
      await pw.installAndEnablePlugin(
          adminClient,
          'https://github.com/mattermost/mattermost-plugin-demo/releases/download/v0.10.3/mattermost-plugin-demo-v0.10.3.tar.gz',
          'com.mattermost.demo-plugin',
      );

      // Verify plugin is active
      await expect.poll(async () => {
          return await pw.isPluginActive(adminClient, 'com.mattermost.demo-plugin');
      }).toBe(true);

      // Test: Use autocomplete to select /crash command
      await channelsPage.centerView.postCreate.selectSlashCommandFromAutocomplete('/cr', '/crash');

      // Send the crash command
      await channelsPage.centerView.postCreate.sendMessage();

      // Wait until post contains the crash message
      await channelsPage.centerView.waitUntilLastPostContains('Crashing plugin');

  // Wait for plugin to recover (polls every 500ms by default)
  await expect.poll(async () => {
      return await pw.isPluginActive(adminClient, 'com.mattermost.demo-plugin');
  }, {
      timeout: 10000, // Max 10s to recover
      intervals: [1000], // Check every 1s
  }).toBe(true);

    // Verify recovery by using /demo_plugin command
        await channelsPage.centerView.postCreate.selectSlashCommandFromAutocomplete('/demo', '/demo_plugin');
    
  });