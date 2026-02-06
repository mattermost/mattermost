# Test Scenarios for Playwright Test Planner

**Source**: DES-UX Specs- Auto-translation MVP-010226-045835.pdf
**Generated**: 2026-02-01T16:44:24.275Z
**Purpose**: Base scenarios for @playwright-test-planner to expand and enhance

---

## Instructions for @playwright-test-planner

These scenarios were extracted from the PDF specification. Your task is to:

1. Review these base scenarios and understand the feature requirements
2. Explore additional edge cases and user flows around these scenarios
3. Expand test coverage considering Mattermost framework conventions:
    - Use Page Object Model patterns from `support/ui/pages/`
    - Follow naming conventions (kebab-case for files, PascalCase for classes)
    - Leverage existing components (ChannelsPage, AdminConsole, etc.)
4. Generate comprehensive test plans that include:
    - Happy path scenarios
    - Error handling scenarios
    - Accessibility considerations
    - Multi-language support testing (if applicable)
    - Permission-based scenarios (different user roles)

---

## Feature: Auto-translation MVP

**Description**: Allows users to read channel messages in their preferred language with server-side translation personalized per user based on language preferences. Supports LibreTranslate and LLM backends.

**Priority**: critical

### Acceptance Criteria

- Channel admins can enable/disable auto-translation from channel settings modal
- All users in DM/GM can enable auto-translation from channel header menu
- System message is posted when auto-translation is enabled
- Channel header label appears when auto-translation is enabled and user has not opted out
- Tooltip on channel header label shows translation provider information
- Auto-translated indicator appears on each translated message
- Users can opt out of auto-translation independently via channel menu
- Ephemeral message is posted when user opts out
- Auto-translation option is greyed out for users with unsupported languages
- Channel header label does not show for users with unsupported languages
- When user changes language preference, new messages are translated to new language
- On desktop: loaded messages have language swapped when preference changes
- On mobile: all stored post translations are replaced when preference changes
- Source language is auto-detected by backend
- Only destination languages in target languages config are supported
- Translation only displays when source and destination languages differ
- Only messages after enablement are translated (no channel history in MVP)
- Edited messages are re-translated and cached translations invalidated
- Show translation menu option available in message actions
- Show translation option disabled when original language matches user preference
- Show translation option disabled when user language not in target languages
- Show translation modal displays side-by-side comparison
- Tooltip on 'translation by' label in modal informs about external data transmission
- Messages under 1s translation time show translated immediately
- Messages over 1s show original in 'translating' state then swap to translation
- Messages over 10s show 'translation failed' status with retry button
- Bulk translation shows all posts in pending state with pulsing animation and toast
- Disabling auto-translation reverts all messages to original state
- Web/Desktop/Mobile notifications include '(translation pending)' prefix
- Notifications update with translated text when available
- Email notifications wait for translation and show with 'Auto-translated' indicator
- Email notifications show original with 'See translation' link if translation fails
- Threads are translated in RHS and Threads view
- Translated indicator shows in thread context
- Permalink previews show translation when available with indicator in header
- Lang attribute added to HTML elements with different language for accessibility
- Feature discovery toast appears for channel admins when different language detected
- Toast only shows on channel entry, not mid-scroll
- Toast does not show again if previously dismissed for that channel
- Toast only shows for users with permission to enable auto-translation
- Mobile: Channel settings menu item combines channel info, auto-translation, and archive
- Mobile: Auto-translation option appears under Notifications in channel info modal
- Mobile: Subtitle shows 'On' with target language when enabled
- Mobile: Disabled option shows modal explaining unsupported language when tapped
- Mobile: Bulk translation shows toast with loader and gradient overlay
- Mobile: Confirmation dialog appears when disabling auto-translation
- Mobile: Toast confirms auto-translation has been turned off
- Mobile: Icon shows in channel top-bar and thread top-bar when enabled
- Mobile: Auto-translation indicator shows in message header
- Mobile: Tapping message indicator opens show translation modal
- Mobile: Long-press menu includes 'Show translation' option
- System console auto-translation settings located under Site Configuration > Localization
- Feature only available on Enterprise Advanced license
- Feature discovery block shows for licenses below Enterprise Advanced
- Auto-translation toggle disabled by default in system console
- Configuration section expands when toggle enabled
- Translation provider selection supports LibreTranslate and Mattermost Agents
- Initially translation provider is not set
- LibreTranslate fields show when LibreTranslate selected
- LibreTranslate fields include API Endpoint and API Key with docs links
- Mattermost Agents fields show when selected, LibreTranslate fields hidden
- AI Service field pulls from configured AI services with link to config page
- Error state shows if Mattermost Agents not properly configured
- Target languages can be selected by admin
- Target languages ideally pre-selected with 5 most-used languages
- Link to view languages most used on server available
- New permission 'Manage Channel Translation' added to permissions scheme
- Permission applies to both Public and Private channels
- All members: Manage Channel Translation default Off for public and private
- Channel admins: Manage Channel Translation default On for public and private
- Team admins: Manage Channel Translation default On for public and private
- System admins: Manage Channel Translation always On (cannot be turned off) for public and private

### Base Scenarios

#### Scenario 1: Channel admin enables auto-translation for channel

**Priority**: must-have

**Given**: User is a channel admin and auto-translation is disabled for the channel
**When**: Admin enables auto-translation from channel settings modal
**Then**: Translation is turned on for all members, system message is posted, channel header label appears for users who have it enabled

#### Scenario 2: User enables auto-translation in DM/GM

**Priority**: must-have

**Given**: User is in a DM or GM
**When**: User enables auto-translation from channel header menu
**Then**: Translation is enabled for that user, system message is posted, channel header label appears

#### Scenario 3: End-user opts out of auto-translation

**Priority**: must-have

**Given**: Auto-translation is enabled for the channel by admin
**When**: User toggles off auto-translation in channel menu
**Then**: Ephemeral message is posted, auto-translated label is removed from channel header for that user

#### Scenario 4: User with unsupported language attempts to enable auto-translation

**Priority**: must-have

**Given**: User's preferred language is not in target languages list
**When**: User views channel menu
**Then**: Auto-translation option is greyed out with 'Your language is not supported' subtext, channel header label does not show

#### Scenario 5: User changes language preference on desktop

**Priority**: must-have

**Given**: User has auto-translation enabled and changes preferred language in Settings > Display > Language
**When**: Language is updated
**Then**: New messages are translated to new language, loaded messages in current channel have language swapped out

#### Scenario 6: User changes language preference on mobile

**Priority**: must-have

**Given**: User has auto-translation enabled and changes preferred language
**When**: Language is updated
**Then**: New messages are translated to new language, all existing translations for stored posts are replaced with translations in new language

#### Scenario 7: Message is edited after translation

**Priority**: must-have

**Given**: A message has been translated
**When**: User edits the message
**Then**: Message is re-translated, cached translations are invalidated and updated

#### Scenario 8: User views original translation

**Priority**: must-have

**Given**: A message has been translated
**When**: User clicks 'Show translation' from message actions menu
**Then**: Modal opens showing side-by-side comparison of original and translated text

#### Scenario 9: Show translation menu option disabled when languages match

**Priority**: must-have

**Given**: Original message language matches user's preferred language
**When**: User views message actions menu
**Then**: 'Show translation' option is shown but disabled

#### Scenario 10: Show translation menu option disabled for unsupported language

**Priority**: must-have

**Given**: User's language is not in target languages
**When**: User views message actions menu
**Then**: 'Show translation' option is disabled

#### Scenario 11: Single message translation under 1 second

**Priority**: must-have

**Given**: New message arrives in auto-translated channel
**When**: Translation completes in under 1 second
**Then**: Original message is hidden, translated message is immediately shown

#### Scenario 12: Single message translation over 1 second

**Priority**: must-have

**Given**: New message arrives in auto-translated channel
**When**: Translation takes more than 1 second
**Then**: Original post is shown in 'translating' state, then swapped with translation when received

#### Scenario 13: Single message translation failure after 10 seconds

**Priority**: must-have

**Given**: New message arrives in auto-translated channel
**When**: Translation takes more than 10 seconds
**Then**: Original post is shown with 'translation failed' status and 'retry' button

#### Scenario 14: Bulk translation when enabling for channel with history

**Priority**: should-have

**Given**: User turns on translation for channel with historical content
**When**: Bulk translation begins
**Then**: All posts show in pending state with pulsing fade animation and 'translating' toast at bottom until all translations received

#### Scenario 15: User disables auto-translation for channel

**Priority**: must-have

**Given**: Auto-translation is enabled for user in a channel
**When**: User disables auto-translation
**Then**: All translated messages revert to original untranslated state

#### Scenario 16: Web/Desktop/Mobile notification with pending translation

**Priority**: should-have

**Given**: User receives notification for translated message
**When**: Translation is not yet available
**Then**: Notification includes '(translation pending)' before message text, updates with translated text when available

#### Scenario 17: Email notification with successful translation

**Priority**: should-have

**Given**: User receives email notification for translated message
**When**: Translation is available in reasonable time
**Then**: Email contains translated text with 'Auto-translated' indicator at bottom

#### Scenario 18: Email notification with failed translation

**Priority**: should-have

**Given**: User receives email notification for translated message
**When**: Translation fails or takes too long
**Then**: Email shows original text with 'See translation' link below message

#### Scenario 19: Threads are auto-translated

**Priority**: must-have

**Given**: Channel has auto-translation enabled
**When**: User views threads in RHS or Threads view
**Then**: Thread messages are translated and 'Translated' indicator shows

#### Scenario 20: Permalink preview shows translation

**Priority**: should-have

**Given**: Permalink is for message in auto-translated channel and translation is available
**When**: User views permalink preview
**Then**: Message shows in user's preferred language with indicator in header

#### Scenario 21: Feature discovery toast for channel admin on desktop

**Priority**: should-have

**Given**: Channel admin enters channel with message in different language, auto-translation not enabled, admin has not dismissed toast for this channel
**When**: Channel is entered
**Then**: Toast appears prompting to enable auto-translation with dismiss and enable options

#### Scenario 22: Feature discovery toast for channel admin on mobile

**Priority**: should-have

**Given**: Channel admin enters channel with message in different language, auto-translation not enabled, admin has not dismissed toast for this channel, admin's language is in target languages
**When**: Channel is entered
**Then**: Toast appears at bottom with dismiss and enable options

#### Scenario 23: Mobile: Channel admin enables auto-translation

**Priority**: must-have

**Given**: User is channel admin on mobile
**When**: Admin opens channel info modal and accesses Channel settings menu item
**Then**: Channel settings view shows with auto-translation, channel info, and archive channel options

#### Scenario 24: Mobile: End-user opts out via channel info modal

**Priority**: must-have

**Given**: Auto-translation is enabled by admin on mobile
**When**: User toggles off auto-translation in channel info modal
**Then**: Auto-translation is disabled for user, subtitle shows language when enabled

#### Scenario 25: Mobile: Unsupported language user attempts to enable

**Priority**: must-have

**Given**: User's language is not supported on mobile
**When**: User taps disabled auto-translation option
**Then**: Modal opens explaining language is not supported

#### Scenario 26: Mobile: Bulk translation with overlay

**Priority**: should-have

**Given**: User enables translation for channel with historical content on mobile
**When**: Bulk translation begins
**Then**: Toast shows at bottom with loader and animated gradient overlay on entire channel

#### Scenario 27: Mobile: Disable auto-translation with confirmation

**Priority**: must-have

**Given**: Auto-translation is currently on for user on mobile
**When**: User chooses to disable it
**Then**: Confirmation dialog appears, then toast shows indicating it has been turned off

#### Scenario 28: Mobile: Channel indicator shows in top-bar

**Priority**: must-have

**Given**: Channel has auto-translation enabled on mobile
**When**: User views channel
**Then**: Icon shows in channel top-bar next to title and in thread top bar

#### Scenario 29: Mobile: View original translation via message indicator

**Priority**: must-have

**Given**: Message has been auto-translated on mobile
**When**: User taps auto-translation icon on message
**Then**: Show translation modal opens with side-by-side comparison

#### Scenario 30: Mobile: View original translation via long-press

**Priority**: must-have

**Given**: Message has been auto-translated on mobile
**When**: User long-presses message and taps 'Show translation'
**Then**: Show translation modal opens with original at top and translated below

#### Scenario 31: System admin enables auto-translation in system console

**Priority**: must-have

**Given**: Workspace has Enterprise Advanced license
**When**: System admin enables auto-translation toggle in Site Configuration > Localization
**Then**: Configuration section expands to reveal settings

#### Scenario 32: System admin selects LibreTranslate provider

**Priority**: must-have

**Given**: Auto-translation is enabled in system console
**When**: System admin selects LibreTranslate as provider
**Then**: LibreTranslate API Endpoint and API Key fields display with links to docs

#### Scenario 33: System admin selects Mattermost Agents provider

**Priority**: must-have

**Given**: Auto-translation is enabled in system console
**When**: System admin selects Mattermost Agents as provider
**Then**: AI Service field displays (pulled from configured AI services), LibreTranslate fields are hidden

#### Scenario 34: Mattermost Agents not configured properly

**Priority**: must-have

**Given**: System admin selects Mattermost Agents as provider
**When**: Plugin is not enabled, not installed, or no AI service is set up
**Then**: Error state is shown

#### Scenario 35: System admin sets target languages

**Priority**: must-have

**Given**: Translation provider is configured
**When**: System admin selects target languages
**Then**: Languages are saved and available for auto-translation

#### Scenario 36: License below Enterprise Advanced

**Priority**: must-have

**Given**: Server license is below Enterprise Advanced
**When**: System admin views Site Configuration > Localization
**Then**: Feature discovery block displays in place of auto-translation settings

#### Scenario 37: Source and destination language are the same

**Priority**: must-have

**Given**: Message source language matches user's preferred language
**When**: Message is received
**Then**: Original source is always used, no translation displayed

#### Scenario 38: Only new messages are translated in MVP

**Priority**: must-have

**Given**: Auto-translation is enabled for channel
**When**: Messages arrive after enablement
**Then**: Only new messages are translated, channel history is not translated

---

---

## Feature: Core Messaging (Critical Path)

**Description**: Basic message posting and retrieval — foundational for all other features.

**Priority**: critical

### Scenarios

#### Scenario 1: User posts message to public channel

**Priority**: must-have

**Given**: User is member of a public channel
**When**: User types message in input and clicks Send
**Then**: Message appears in channel immediately with sender name and timestamp

#### Scenario 2: User posts message to direct message

**Priority**: must-have

**Given**: User has open DM with another user
**When**: User types and sends message
**Then**: Message appears in conversation, other user receives notification

#### Scenario 3: User creates thread reply

**Priority**: must-have

**Given**: Channel has message with replies enabled
**When**: User clicks reply, types message, clicks Send in thread
**Then**: Reply appears in thread RHS and thread preview shows updated count

#### Scenario 4: Edit message after posting

**Priority**: must-have

**Given**: User has posted a message
**When**: User clicks message options, clicks Edit, modifies text, clicks Save
**Then**: Message updates immediately, "Edited" label appears on message

#### Scenario 5: Delete message

**Priority**: must-have

**Given**: User has posted a message
**When**: User clicks message options, clicks Delete, confirms
**Then**: Message disappears from channel, confirmation toast appears

---

## Feature: Channel Management

**Description**: Creating and managing channels — essential for workspace organization.

**Priority**: critical

### Scenarios

#### Scenario 1: Create public channel

**Priority**: must-have

**Given**: User is team member
**When**: User clicks "+" next to channels, selects "Create new channel", enters name, clicks Create
**Then**: Channel appears in sidebar, user is added as member, channel is public

#### Scenario 2: Create private channel

**Priority**: must-have

**Given**: User is team member
**When**: User creates channel with "Make private" option checked
**Then**: Channel appears with lock icon, requires invite for others to join

#### Scenario 3: Add member to channel

**Priority**: must-have

**Given**: User is channel admin, channel exists
**When**: User opens channel info, clicks "Add Members", searches and selects user, clicks Add
**Then**: User is added to channel, appears in members list, notification is sent

#### Scenario 4: Change channel topic/description

**Priority**: should-have

**Given**: User is channel admin
**When**: User opens channel info, clicks Edit, updates topic, clicks Save
**Then**: Topic displays in channel header, members see update

---

## Framework Context

Mattermost E2E Framework follows these conventions:

- **Page Objects**: Defined in `support/ui/pages/` using class-based patterns
- **Components**: Reusable UI components in `support/ui/components/`
- **Test Data**: Fixtures and factories in `support/test_data/`
- **File Naming**: kebab-case for files (e.g., `channel-settings.spec.ts`)
- **Class Naming**: PascalCase for classes (e.g., `ChannelSettingsPage`)
- **Method Naming**: camelCase for methods (e.g., `openChannelSettings()`)
- **Test Structure**: Use `test.describe()` for grouping, `test()` for individual tests
- **Assertions**: Prefer Playwright assertions like `expect(locator).toBeVisible()`
