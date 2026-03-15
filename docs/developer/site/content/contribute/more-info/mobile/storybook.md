---
title: "Storybook"
heading: "Storybook for mobile"
description: "Using Storybook to develop components"
date: 2021-02-25T11:17:44+05:30
weight: 6
aliases:
  - /contribute/mobile/storybook
---

Storybook has been added to the `mobile` repository to help prototype components. To use Storybook:

1. In the root of the repository, run `npm run storybook`. This step automatically scans and loads all stories, then opens a new browser tab with the Storybook interface. 

   **Note**: When using a real device, you may need to configure the Storybook *Host URL* by updating the `.env` file in the root of the repository. When running in an emulator, the code tries to use the default network values.

2. Run the usual `npm run android` (or `npm run ios`) and `npm start` commands.
3. Storybook has been integrated into the react-native dev menu. 
   - On Mac OS, press CMD+D to open the dev menu when your app is running in an iOS Simulator, or press CMD+M when running in an Android emulator. 
   - On Windows and Linux, press CTRL+M to open the dev menu, then select the "Storybook" option. 
   - If running on a real device, shaking the device brings up the react-native dev menu. You can also press `d` in the terminal window where you ran `npm start`.
4. The Storybook interface opens in the mobile app. The stories can be controlled either through the desktop browser Storybook UI or the mobile browser Storybook UI. Both will render the component on the device.

>**Caveat**: Promises are currently broken in Storybook for react native. Components using promises will not work correctly. There is a temporary hacky fix to work around this issue: {{< newtabref href="https://github.com/storybookjs/react-native/issues/57#issuecomment-737931284" title="storybookjs/react-native#57" >}}.
