# View User Group Details

## Application Overview

Mattermost channels app – User Groups feature. An admin can create a custom user group and members can view its details (group name, @mention handle, member count, member list) via the "User Groups" modal opened from the product switch menu (Main Menu → User Groups). The ViewUserGroupModal component shows the group's @mention name, member count, a search input, and a scrollable member list. This test verifies that opening a custom user group's detail modal displays the correct group name, member count, and member search input.

## Test Scenarios

### 1. view_user_group_details

**Seed:** `specs/seed.spec.ts`

#### 1.1. user can view group details in the view user group modal @ai-assisted

**File:** `specs/functional/ai-assisted/view_user_group_details/view_user_group_details.spec.ts`

**Steps:**

1. Set up admin and a regular user via pw.initSetup(); login as the regular user via pw.testBrowser.login(user)


    - expect: channelsPage and page are available

2. Using adminClient, create a custom user group with a unique name and add the regular user as a member via adminClient.createGroupWithMembers (or createGroup + addUsersToGroup)


    - expect: Group is created successfully with the user as a member

3. Navigate to channelsPage.goto() and await channelsPage.toBeVisible()


    - expect: Channels page is visible

4. Open the product/main menu by clicking channelsPage.globalHeader.productSwitchMenu


    - expect: Product menu opens and shows menu items

5. Click the 'User Groups' menu item (id='userGroups') in the product menu


    - expect: User Groups modal opens with a list of groups

6. Find and click the newly created group in the list (by its display name)


    - expect: View User Group detail modal opens

7. Assert that the modal heading or group @mention name contains the group's name/handle


    - expect: Group name/@handle is visible in the modal

8. Assert that the member count heading is visible (e.g. '1 Member')


    - expect: Member count is shown correctly

9. Assert the search input (data-testid='searchInput') is visible inside the modal


    - expect: Search input is present and functional
