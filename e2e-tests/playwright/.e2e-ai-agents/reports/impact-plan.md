# Impact Analysis Report

Run ID: impact-local-mma0op18-k8vnlf
Run window: 2026-03-03T02:57:15.450Z -> 2026-03-03T02:57:49.829Z
Run duration (ms): 34378
Since ref: master
Framework: playwright
Test Patterns: specs/**/*.spec.ts
Impact Model: flow=heuristic test=ai confidence=low
Traceability: enabled=true manifestFound=false matchedFlows=0/232 matchedTests=0 coverageRatio=0
Dependency Graph: enabled=true seeds=129 expanded=135 files=2824 edges=2475 depth=3
Changed Files: 201
Flows: P0=102 P1=73 P2=57

Impacted Flows:
- [P0] Team Settings Modal (team_settings_modal)
  Score: 19
  Reasons: Shared component change; Critical keyword: settings; Visual styling change; UI logic change
  Files: channels/src/components/team_settings_modal/index.ts, channels/src/components/team_settings_modal/team_settings_modal.scss, channels/src/components/team_settings_modal/team_settings_modal.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Search Results (search_results)
  Score: 17
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: search
  Files: channels/src/components/search_results/search_results.tsx, channels/src/components/search_results/index.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Ldap Wizard (ldap_wizard)
  Score: 15
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/ldap_wizard/ldap_wizard.tsx, channels/src/components/admin_console/ldap_wizard/index.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Permissions Tree (permissions_tree)
  Score: 15
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/permission_schemes_settings/permissions_tree/permissions_tree.tsx, channels/src/components/admin_console/permission_schemes_settings/permissions_tree/index.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Content Flagging (content_flagging)
  Score: 15
  Reasons: Shared component change; State or data flow change
  Files: channels/src/components/common/hooks/content_flagging.ts, channels/src/packages/mattermost-redux/src/action_types/content_flagging.ts, channels/src/packages/mattermost-redux/src/actions/content_flagging.ts, channels/src/packages/mattermost-redux/src/reducers/entities/content_flagging.ts, channels/src/packages/mattermost-redux/src/selectors/entities/content_flagging.ts, platform/types/src/content_flagging.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Team Info Tab (team_info_tab)
  Score: 15
  Reasons: Shared component change; Critical keyword: settings; UI logic change; Interactive element change
  Files: channels/src/components/team_settings/team_info_tab/index.ts, channels/src/components/team_settings/team_info_tab/team_info_tab.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Emoji (emoji)
  Score: 15
  Reasons: Shared component change; Visual styling change; UI logic change; Interactive element change
  Files: platform/shared/src/components/emoji/emoji.css, platform/shared/src/components/emoji/emoji.tsx, platform/shared/src/components/emoji/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Permission Team Scheme Settings (permission_team_scheme_settings)
  Score: 15
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/permission_schemes_settings/permission_team_scheme_settings/permission_team_scheme_settings.tsx, channels/src/components/admin_console/permission_schemes_settings/permission_team_scheme_settings/index.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Permission System Scheme Settings (permission_system_scheme_settings)
  Score: 15
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/permission_schemes_settings/permission_system_scheme_settings/permission_system_scheme_settings.tsx, channels/src/components/admin_console/permission_schemes_settings/permission_system_scheme_settings/index.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Localization (localization)
  Score: 14
  Reasons: Shared component change; Visual styling change; Critical keyword: admin; UI logic change; Interactive element change
  Files: channels/src/components/admin_console/localization/localization.scss, channels/src/components/admin_console/localization/localization.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Policy Details (policy_details)
  Score: 13
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/access_control/policy_details/policy_details.tsx, channels/src/components/admin_console/access_control/policy_details/index.ts
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] System Users (system_users)
  Score: 13
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/system_users/system_users.tsx, channels/src/components/admin_console/system_users/index.ts
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Mobile Sidebar Right Items (mobile_sidebar_right_items)
  Score: 13
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/mobile_sidebar_right/mobile_sidebar_right_items/mobile_sidebar_right_items.tsx, channels/src/components/mobile_sidebar_right/mobile_sidebar_right_items/index.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Post Message Preview (post_message_preview)
  Score: 13
  Reasons: Shared component change; Critical keyword: message; UI logic change
  Files: channels/src/components/post_view/post_message_preview/index.ts, channels/src/components/post_view/post_message_preview/post_message_preview.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Quick Switch Modal (quick_switch_modal)
  Score: 13
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/quick_switch_modal/quick_switch_modal.tsx, channels/src/components/quick_switch_modal/index.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Team Access Tab (team_access_tab)
  Score: 13
  Reasons: Shared component change; Critical keyword: settings; UI logic change
  Files: channels/src/components/team_settings/team_access_tab/index.ts, channels/src/components/team_settings/team_access_tab/team_access_tab.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Team Settings (team_settings)
  Score: 13
  Reasons: Shared component change; UI logic change; Critical keyword: settings
  Files: channels/src/components/team_settings/team_settings.tsx, channels/src/components/team_settings/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Admin Sidebar (admin_sidebar)
  Score: 13
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/admin_sidebar/admin_sidebar.tsx, channels/src/components/admin_console/admin_sidebar/index.ts
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Plugin Management (plugin_management)
  Score: 13
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/plugin_management/plugin_management.tsx, channels/src/components/admin_console/plugin_management/index.ts
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] System Properties (system_properties)
  Score: 13
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/system_properties/system_properties.tsx, channels/src/components/admin_console/system_properties/index.ts
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Secure Connections (secure_connections)
  Score: 13
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/secure_connections/secure_connections.tsx, channels/src/components/admin_console/secure_connections/index.ts
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Info Toast (info_toast)
  Score: 12
  Reasons: Shared component change; Visual styling change; UI logic change; Interactive element change
  Files: channels/src/components/info_toast/info_toast.scss, channels/src/components/info_toast/info_toast.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Add User To Channel Modal (add_user_to_channel_modal)
  Score: 11
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/add_user_to_channel_modal/add_user_to_channel_modal.tsx, channels/src/components/add_user_to_channel_modal/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Licensed Section Container (licensed_section_container)
  Score: 11
  Reasons: Shared component change; UI logic change; Critical keyword: admin
  Files: channels/src/components/admin_console/licensed_section_container/licensed_section_container.tsx, channels/src/components/admin_console/licensed_section_container/index.ts
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Apps Form Date Field (apps_form_date_field)
  Score: 11
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/apps_form/apps_form_date_field/apps_form_date_field.tsx, channels/src/components/apps_form/apps_form_date_field/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Apps Form Datetime Field (apps_form_datetime_field)
  Score: 11
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/apps_form/apps_form_datetime_field/apps_form_datetime_field.tsx, channels/src/components/apps_form/apps_form_datetime_field/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Apps Form Field (apps_form_field)
  Score: 11
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/apps_form/apps_form_field/apps_form_field.tsx, channels/src/components/apps_form/apps_form_field/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Channel Header (channel_header)
  Score: 11
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/channel_header/index.ts, channels/src/components/channel_header/channel_header.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Channel Selector Modal (channel_selector_modal)
  Score: 11
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/channel_selector_modal/channel_selector_modal.tsx, channels/src/components/channel_selector_modal/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] File Attachment (file_attachment)
  Score: 11
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/file_attachment/file_attachment.tsx, channels/src/components/file_attachment/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] File Preview Modal (file_preview_modal)
  Score: 11
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/file_preview_modal/file_preview_modal.tsx, channels/src/components/file_preview_modal/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Quick Input (quick_input)
  Score: 11
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/quick_input/quick_input.tsx, channels/src/components/quick_input/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Single Image View (single_image_view)
  Score: 11
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/single_image_view/index.ts, channels/src/components/single_image_view/single_image_view.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Thread Item (thread_item)
  Score: 11
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/threading/global_threads/thread_item/index.ts, channels/src/components/threading/global_threads/thread_item/thread_item.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Utils (utils)
  Score: 11
  Reasons: UI logic change; Shared component change; Critical keyword: admin
  Files: channels/src/utils/utils.tsx, channels/src/components/admin_console/system_users/utils/index.tsx
  Audience: system_admin, member
  Blast radius: broad; unflagged
- [P0] Admin Console (admin_console)
  Score: 11
  Reasons: Shared component change; UI logic change; Critical keyword: admin
  Files: channels/src/components/admin_console/admin_console.tsx, channels/src/components/admin_console/index.ts
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Mobile Sidebar Right (mobile_sidebar_right)
  Score: 11
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/mobile_sidebar_right/mobile_sidebar_right.tsx, channels/src/components/mobile_sidebar_right/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Channel Settings Configuration Tab (channel_settings_configuration_tab)
  Score: 10
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: settings
  Files: channels/src/components/channel_settings_modal/channel_settings_configuration_tab.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Channel Settings Info Tab (channel_settings_info_tab)
  Score: 10
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: settings
  Files: channels/src/components/channel_settings_modal/channel_settings_info_tab.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Remove Flagged Message Confirmation Modal (remove_flagged_message_confirmation_modal)
  Score: 10
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: message
  Files: channels/src/components/remove_flagged_message_confirmation_modal/remove_flagged_message_confirmation_modal.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Search Bar (search_bar)
  Score: 10
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: search
  Files: channels/src/components/search_bar/search_bar.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Channel Bookmarks (channel_bookmarks)
  Score: 10
  Reasons: Shared component change; UI logic change
  Files: platform/types/src/channel_bookmarks.ts, channels/src/components/channel_bookmarks/channel_bookmarks.tsx, channels/src/components/channel_bookmarks/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Dnd Custom Time Picker Modal (dnd_custom_time_picker_modal)
  Score: 9
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/dnd_custom_time_picker_modal/dnd_custom_time_picker_modal.tsx, channels/src/components/dnd_custom_time_picker_modal/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] File Thumbnail (file_thumbnail)
  Score: 9
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/file_attachment/file_thumbnail/file_thumbnail.tsx, channels/src/components/file_attachment/file_thumbnail/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] File Attachment List (file_attachment_list)
  Score: 9
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/file_attachment_list/file_attachment_list.tsx, channels/src/components/file_attachment_list/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Markdown (markdown)
  Score: 9
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/markdown/index.ts, channels/src/components/markdown/markdown.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Post Edit History (post_edit_history)
  Score: 9
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/post_edit_history/index.ts, channels/src/components/post_edit_history/post_edit_history.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] File Card (file_card)
  Score: 9
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/threading/global_threads/thread_item/attachments/file_card/file_card.tsx, channels/src/components/threading/global_threads/thread_item/attachments/file_card/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Context (context)
  Score: 9
  Reasons: UI logic change; State or data flow change
  Files: platform/shared/src/context/context.tsx, platform/shared/src/context/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Mobile Channel Header (mobile_channel_header)
  Score: 9
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/mobile_channel_header/mobile_channel_header.tsx, channels/src/components/mobile_channel_header/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Post View (post_view)
  Score: 9
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/post_view/post_view.tsx, channels/src/components/post_view/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Root (root)
  Score: 9
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/root/root.tsx, channels/src/components/root/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Sidebar Header (sidebar_header)
  Score: 9
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/sidebar/sidebar_header/sidebar_header.tsx, channels/src/components/sidebar/sidebar_header/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Thread Viewer (thread_viewer)
  Score: 9
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/threading/thread_viewer/thread_viewer.tsx, channels/src/components/threading/thread_viewer/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Editor (editor)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/access_control/editors/cel_editor/editor.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Custom Profile Attributes (custom_profile_attributes)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/custom_profile_attributes/custom_profile_attributes.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Auto Translation (auto_translation)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/localization/auto_translation.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Apps Form Component (apps_form_component)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/apps_form/apps_form_component.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Bookmark Dot Menu (bookmark_dot_menu)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/channel_bookmarks/bookmark_dot_menu.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Channel Header Menu (channel_header_menu)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/channel_header_menu/channel_header_menu.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Autotranslation (autotranslation)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/channel_header_menu/menu_items/autotranslation.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Channel Settings Modal (channel_settings_modal)
  Score: 8
  Reasons: Shared component change; UI logic change; Critical keyword: settings
  Files: channels/src/components/channel_settings_modal/channel_settings_modal.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Custom Status Modal (custom_status_modal)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/custom_status/custom_status_modal.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Date Time Picker Modal (date_time_picker_modal)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/date_time_picker_modal/date_time_picker_modal.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Datetime Input (datetime_input)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/datetime_input/datetime_input.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Multiselect (multiselect)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/multiselect/multiselect.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Data Spillage Report (data_spillage_report)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/post_view/data_spillage_report/data_spillage_report.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Post Search Results Item (post_search_results_item)
  Score: 8
  Reasons: Shared component change; UI logic change; Critical keyword: search
  Files: channels/src/components/search_results/post_search_results_item.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Sidebar Team Menu (sidebar_team_menu)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/sidebar/sidebar_header/sidebar_team_menu.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Size Aware Image (size_aware_image)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/size_aware_image.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Switch Channel Provider (switch_channel_provider)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/suggestion/switch_channel_provider.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Posts (posts)
  Score: 8
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/actions/posts.ts, channels/src/packages/mattermost-redux/src/reducers/entities/posts.ts, platform/types/src/posts.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Ldap Text Setting (ldap_text_setting)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/ldap_wizard/ldap_text_setting.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Ldap File Upload Setting (ldap_file_upload_setting)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/ldap_wizard/ldap_file_upload_setting.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Ldap Expandable Setting (ldap_expandable_setting)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/ldap_wizard/ldap_expandable_setting.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Ldap Dropdown Setting (ldap_dropdown_setting)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/ldap_wizard/ldap_dropdown_setting.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Ldap Custom Setting (ldap_custom_setting)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/ldap_wizard/ldap_custom_setting.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Ldap Boolean Setting (ldap_boolean_setting)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/ldap_wizard/ldap_boolean_setting.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Session Length Settings (session_length_settings)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/session_length_settings.tsx
  Audience: system_admin
  Flags: ExtendSessionLengthWithActivity (on), TerminateSessionsOnPasswordChange (on), SessionLengthWebInHours (on), SessionLengthMobileInHours (on), SessionLengthSSOInHours (on), SessionCacheInMinutes (on), SessionIdleTimeoutInMinutes (on)
  Blast radius: admin-only; flagged-on
- [P0] Push Settings (push_settings)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/push_settings.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Password Settings (password_settings)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/password_settings.tsx
  Audience: system_admin
  Flags: MaximumLoginAttempts (on)
  Blast radius: admin-only; flagged-on
- [P0] Message Export Settings (message_export_settings)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/message_export_settings.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Elasticsearch Settings (elasticsearch_settings)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/elasticsearch_settings.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Database Settings (database_settings)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/database_settings.tsx
  Audience: system_admin
  Flags: MinimumHashtagLength (on)
  Blast radius: admin-only; flagged-on
- [P0] Cluster Settings (cluster_settings)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/cluster_settings.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Schema Admin Settings (schema_admin_settings)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/schema_admin_settings.tsx
  Audience: system_admin
  Flags: SiteURL (on)
  Blast radius: admin-only; flagged-on
- [P0] Bookmark Item (bookmark_item)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/channel_bookmarks/bookmark_item.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Multiselect List (multiselect_list)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/multiselect/multiselect_list.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Resizable Rhs (resizable_rhs)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/resizable_sidebar/resizable_rhs/index.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] System Users Filter Team (system_users_filter_team)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/system_users/system_users_filters_popover/system_users_filter_team/index.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] System Users Filter Role (system_users_filter_role)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/system_users/system_users_filters_popover/system_users_filter_role/index.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Styled Users Filters Status (styled_users_filters_status)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/system_users/system_users_filters_popover/styled_users_filters_status/index.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] System Users Export (system_users_export)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/system_users/system_users_export/index.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] LibreTranslate Settings (libreTranslate_settings)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/localization/libreTranslate_settings.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Agents Settings (agents_settings)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/localization/agents_settings.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Content Reviewers (content_reviewers)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/content_flagging/content_reviewers/content_reviewers.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] System Users Filters Popover (system_users_filters_popover)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/system_users/system_users_filters_popover/index.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] User Multiselector (user_multiselector)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
  Files: channels/src/components/admin_console/content_flagging/user_multiselector/user_multiselector.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P0] Thread List (thread_list)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/threading/global_threads/thread_list/thread_list.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Global Threads (global_threads)
  Score: 8
  Reasons: Shared component change; UI logic change; Interactive element change
  Files: channels/src/components/threading/global_threads/global_threads.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P0] Files (files)
  Score: 7
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/action_types/files.ts, channels/src/packages/mattermost-redux/src/reducers/entities/files.ts, channels/src/packages/mattermost-redux/src/selectors/entities/files.ts, platform/types/src/files.ts
  Audience: member
  Blast radius: broad; unflagged
- [P0] Agents (agents)
  Score: 7
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/reducers/entities/agents.ts, channels/src/packages/mattermost-redux/src/actions/agents.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Websocket Actions (websocket_actions)
  Score: 6
  Reasons: State or data flow change; Interactive element change
  Files: channels/src/actions/websocket_actions.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Admin Definition (admin_definition)
  Score: 6
  Reasons: Shared component change; UI logic change; Critical keyword: admin
  Files: channels/src/components/admin_console/admin_definition.tsx
  Audience: system_admin
  Flags: SiteURL (on), ListenAddress (on), Forward80To443 (on), ConnectionSecurity (on), TLSCertFile (on), UseLetsEncrypt (on), TLSKeyFile (on), LetsEncryptCertificateCacheFile (on), ReadTimeout (on), WriteTimeout (on), MaximumPayloadSizeBytes (on), WebserverMode (on), EnableInsecureOutgoingConnections (on), ManagedResourcePaths (on), EnableSecurityFixAlert (on), EnableTesting (on), EnableDeveloper (on), EnableClientPerformanceDebugging (on), AllowedUntrustedInternalConnections (on), EnableDesktopLandingPage (on), EnableCustomGroups (on), RefreshPostStatsRunTime (on), DeleteAccountLink (on), EnableEmojiPicker (on), EnableCustomEmoji (on), ThreadAutoFollow (on), CollapsedThreads (on), AllowSyncedDrafts (on), ScheduledPosts (on), PostPriority (on), AllowPersistentNotifications (on), PersistentNotificationMaxRecipients (on), PersistentNotificationIntervalMinutes (on), PersistentNotificationMaxCount (on), AllowPersistentNotificationsForGuests (on), EnableBurnOnRead (on), BurnOnReadDurationSeconds (on), BurnOnReadMaximumTimeToLiveSeconds (on), EnableLinkPreviews (on), RestrictLinkPreviews (on), EnablePermalinkPreviews (on), EnableSVGs (on), EnableLatex (on), EnableInlineLatex (on), GoogleDeveloperKey (on), UniqueEmojiReactionLimitPerPost (on), EnableEmailInvitations (on), EnableMultifactorAuthentication (on), EnforceMultifactorAuthentication (on), EnableIncomingWebhooks (on), EnableOutgoingWebhooks (on), EnableOutgoingOAuthConnections (on), EnableCommands (on), EnableOAuthServiceProvider (on), EnableDynamicClientRegistration (on), DCRRedirectURIAllowlist (on), OutgoingIntegrationRequestsTimeout (on), EnablePostUsernameOverride (on), EnablePostIconOverride (on), EnableUserAccessTokens (on), EnableBotAccountCreation (on), DisableBotsWhenOwnerIsDeactivated (on), EnableGifPicker (on), AllowCorsFrom (on), CorsExposedHeaders (on), CorsAllowCredentials (on), CorsDebug (on), FrameAncestors (on), ExperimentalEnableAuthenticationTransfer (on), EnableChannelViewedMessages (on), ExperimentalEnableDefaultChannelLeaveJoinMessages (on), ExperimentalEnableHardenedMode (on), EnableTutorial (on), EnableOnboardingFlow (on), EnableUserTypingMessages (on), TimeBetweenUserTypingUpdatesMilliseconds (on)
  Blast radius: admin-only; flagged-on
- [P1] Settings Group (settings_group)
  Score: 6
  Reasons: Shared component change; UI logic change; Critical keyword: admin
  Files: channels/src/components/admin_console/settings_group.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P1] Channel Header Direct Menu (channel_header_direct_menu)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/channel_header_menu/channel_header_menu_items/channel_header_direct_menu.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Channel Header Group Menu (channel_header_group_menu)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/channel_header_menu/channel_header_menu_items/channel_header_group_menu.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Code Preview (code_preview)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/code_preview.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Render Emoji (render_emoji)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/emoji/render_emoji.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Post (post)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/post/index.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Post List (post_list)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/post_view/post_list/index.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Properties Card View (properties_card_view)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/properties_card_view/properties_card_view.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Channel Property Renderer (channel_property_renderer)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/properties_card_view/propertyValueRenderer/channel_property_renderer/channel_property_renderer.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Post Preview Property Renderer (post_preview_property_renderer)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/properties_card_view/propertyValueRenderer/post_preview_property_renderer/post_preview_property_renderer.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Team Property Renderer (team_property_renderer)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/properties_card_view/propertyValueRenderer/team_property_renderer/team_property_renderer.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Resizable Divider (resizable_divider)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/resizable_sidebar/resizable_divider.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Root Provider (root_provider)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/root/root_provider.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Shared Package Provider (shared_package_provider)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/root/shared_package_provider.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Admin Section Panel (admin_section_panel)
  Score: 6
  Reasons: Shared component change; UI logic change; Critical keyword: admin
  Files: channels/src/components/widgets/admin_console/admin_section_panel.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P1] Websocket Message (websocket_message)
  Score: 6
  Reasons: Interactive element change; Critical keyword: message
  Files: platform/client/src/websocket_message.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Admin Definition Ldap Wizard (admin_definition_ldap_wizard)
  Score: 6
  Reasons: Shared component change; UI logic change; Critical keyword: admin
  Files: channels/src/components/admin_console/admin_definition_ldap_wizard.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P1] Ldap Jobs Table Setting (ldap_jobs_table_setting)
  Score: 6
  Reasons: Shared component change; UI logic change; Critical keyword: admin
  Files: channels/src/components/admin_console/ldap_wizard/ldap_jobs_table_setting.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P1] Ldap Helpers (ldap_helpers)
  Score: 6
  Reasons: Shared component change; UI logic change; Critical keyword: admin
  Files: channels/src/components/admin_console/ldap_wizard/ldap_helpers.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P1] Ldap Button Setting (ldap_button_setting)
  Score: 6
  Reasons: Shared component change; UI logic change; Critical keyword: admin
  Files: channels/src/components/admin_console/ldap_wizard/ldap_button_setting.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P1] Admin Definition Helpers (admin_definition_helpers)
  Score: 6
  Reasons: Shared component change; UI logic change; Critical keyword: admin
  Files: channels/src/components/admin_console/admin_definition_helpers.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P1] Apps Form Container (apps_form_container)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/apps_form/apps_form_container.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Channel Header Title (channel_header_title)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/channel_header/channel_header_title.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Channel Header Public Private Menu (channel_header_public_private_menu)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/channel_header_menu/channel_header_menu_items/channel_header_public_private_menu.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] PropertyValueRenderer (propertyValueRenderer)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/properties_card_view/propertyValueRenderer/propertyValueRenderer.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Resizable Lhs (resizable_lhs)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/resizable_sidebar/resizable_lhs/index.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Command Provider (command_provider)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/suggestion/command_provider/command_provider.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] App Provider (app_provider)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/suggestion/command_provider/app_provider.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Attachments (attachments)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/threading/global_threads/thread_item/attachments/index.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Virtualized Thread List Row (virtualized_thread_list_row)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/threading/global_threads/thread_list/virtualized_thread_list_row.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Search (search)
  Score: 6
  Reasons: State or data flow change; Critical keyword: search
  Files: channels/src/packages/mattermost-redux/src/actions/search.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Dashboard (dashboard)
  Score: 6
  Reasons: Shared component change; UI logic change; Critical keyword: admin
  Files: channels/src/components/admin_console/workspace-optimization/dashboard.tsx
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P1] Virtualized Thread List (virtualized_thread_list)
  Score: 6
  Reasons: Shared component change; UI logic change
  Files: channels/src/components/threading/global_threads/thread_list/virtualized_thread_list.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Style (style)
  Score: 5
  Reasons: Shared component change; Visual styling change
  Files: channels/src/components/channel_banner/style.scss
  Audience: member
  Blast radius: broad; unflagged
- [P1] Channels (channels)
  Score: 5
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/selectors/entities/channels.ts, channels/src/packages/mattermost-redux/src/actions/channels.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Apps Modal (_apps-modal)
  Score: 5
  Reasons: Shared component change; Visual styling change
  Files: channels/src/sass/components/_apps-modal.scss
  Audience: member
  Blast radius: broad; unflagged
- [P1] Inputs (_inputs)
  Score: 5
  Reasons: Shared component change; Visual styling change
  Files: channels/src/sass/components/_inputs.scss
  Audience: member
  Blast radius: broad; unflagged
- [P1] Modal (_modal)
  Score: 5
  Reasons: Shared component change; Visual styling change
  Files: channels/src/sass/components/_modal.scss
  Audience: member
  Blast radius: broad; unflagged
- [P1] Threads (threads)
  Score: 5
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/actions/threads.ts, platform/types/src/threads.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Store (store)
  Score: 5
  Reasons: State or data flow change
  Files: platform/types/src/store.ts, channels/src/packages/mattermost-redux/src/store/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Package (package)
  Score: 4
  Reasons: No specific reasons
  Files: channels/package.json, package.json, platform/shared/package.json
  Audience: member
  Blast radius: broad; unflagged
- [P1] Add User To Channel Modal.test.tsx (add_user_to_channel_modal.test.tsx)
  Score: 4
  Reasons: Shared component change
  Files: channels/src/components/add_user_to_channel_modal/__snapshots__/add_user_to_channel_modal.test.tsx.snap
  Audience: member
  Blast radius: broad; unflagged
- [P1] Permissions Tree.test.tsx (permissions_tree.test.tsx)
  Score: 4
  Reasons: Shared component change; Critical keyword: admin
  Files: channels/src/components/admin_console/permission_schemes_settings/permissions_tree/__snapshots__/permissions_tree.test.tsx.snap
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P1] Types (types)
  Score: 4
  Reasons: Shared component change; Critical keyword: admin
  Files: channels/src/components/admin_console/types.ts
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P1] Datetime Input.test.tsx (datetime_input.test.tsx)
  Score: 4
  Reasons: Shared component change
  Files: channels/src/components/datetime_input/__snapshots__/datetime_input.test.tsx.snap
  Audience: member
  Blast radius: broad; unflagged
- [P1] Info Toast.test.tsx (info_toast.test.tsx)
  Score: 4
  Reasons: Shared component change
  Files: channels/src/components/info_toast/__snapshots__/info_toast.test.tsx.snap
  Audience: member
  Blast radius: broad; unflagged
- [P1] Quick Switch Modal.test.tsx (quick_switch_modal.test.tsx)
  Score: 4
  Reasons: Shared component change
  Files: channels/src/components/quick_switch_modal/__snapshots__/quick_switch_modal.test.tsx.snap
  Audience: member
  Blast radius: broad; unflagged
- [P1] App Command Parser Dependencies (app_command_parser_dependencies)
  Score: 4
  Reasons: Shared component change
  Files: channels/src/components/suggestion/command_provider/app_command_parser/app_command_parser_dependencies.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Virtualized Thread Viewer (virtualized_thread_viewer)
  Score: 4
  Reasons: Shared component change
  Files: channels/src/components/threading/virtualized_thread_viewer/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Initial State (initial_state)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/store/initial_state.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Channel Settings.ts (channel_settings.ts)
  Score: 4
  Reasons: Critical keyword: settings
  Files: channels/src/selectors/views/channel_settings.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Constants (constants)
  Score: 4
  Reasons: UI logic change
  Files: channels/src/utils/constants.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Link Only Renderer (link_only_renderer)
  Score: 4
  Reasons: UI logic change
  Files: channels/src/utils/markdown/link_only_renderer.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Websocket Events (websocket_events)
  Score: 4
  Reasons: Interactive element change
  Files: platform/client/src/websocket_events.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Websocket Messages (websocket_messages)
  Score: 4
  Reasons: Interactive element change
  Files: platform/client/src/websocket_messages.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Tsconfig (tsconfig)
  Score: 4
  Reasons: No specific reasons
  Files: platform/client/tsconfig.json, platform/mattermost-redux/tsconfig.json, platform/shared/tsconfig.json
  Audience: member
  Blast radius: broad; unflagged
- [P1] UseEmojiByName (useEmojiByName)
  Score: 4
  Reasons: State or data flow change
  Files: platform/shared/src/context/useEmojiByName.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] UseEmojiUrl (useEmojiUrl)
  Score: 4
  Reasons: State or data flow change
  Files: platform/shared/src/context/useEmojiUrl.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] React Testing Utils (react_testing_utils)
  Score: 4
  Reasons: UI logic change
  Files: platform/shared/src/testing/react_testing_utils.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] UseMockSharedContext (useMockSharedContext)
  Score: 4
  Reasons: UI logic change
  Files: platform/shared/src/testing/useMockSharedContext.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Custom Plugin Settings (custom_plugin_settings)
  Score: 4
  Reasons: Shared component change; Critical keyword: admin
  Files: channels/src/components/admin_console/custom_plugin_settings/index.ts
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P1] Enable Plugin Setting (enable_plugin_setting)
  Score: 4
  Reasons: Shared component change; Critical keyword: admin
  Files: channels/src/components/admin_console/custom_plugin_settings/enable_plugin_setting.ts
  Audience: system_admin
  Blast radius: admin-only; unflagged
- [P1] App Command Parser (app_command_parser)
  Score: 4
  Reasons: Shared component change
  Files: channels/src/components/suggestion/command_provider/app_command_parser/app_command_parser.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Actions (actions)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/actions/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Entities (entities)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/reducers/entities/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] ConfigureStore (configureStore)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/store/configureStore.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Text Formatting (text_formatting)
  Score: 4
  Reasons: UI logic change
  Files: channels/src/utils/text_formatting.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Syntax Highlighting (syntax_highlighting)
  Score: 4
  Reasons: UI logic change
  Files: channels/src/utils/syntax_highlighting.tsx
  Audience: member
  Blast radius: broad; unflagged
- [P1] Admin (admin)
  Score: 4
  Reasons: Critical keyword: admin
  Files: platform/types/src/admin.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Apps Form (apps_form)
  Score: 4
  Reasons: Shared component change
  Files: channels/src/components/apps_form/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P1] Reducers (reducers)
  Score: 4
  Reasons: State or data flow change
  Files: channels/src/packages/mattermost-redux/src/reducers/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Jest.config (jest.config)
  Score: 3
  Reasons: No specific reasons
  Files: channels/jest.config.js, platform/shared/jest.config.js
  Audience: member
  Blast radius: broad; unflagged
- [P2] Variables (_variables)
  Score: 3
  Reasons: Visual styling change
  Files: channels/src/sass/utils/_variables.scss
  Audience: member
  Blast radius: broad; unflagged
- [P2] .gitignore (.gitignore)
  Score: 2
  Reasons: No specific reasons
  Files: .gitignore
  Audience: member
  Blast radius: broad; unflagged
- [P2] Makefile (Makefile)
  Score: 2
  Reasons: No specific reasons
  Files: Makefile
  Audience: member
  Blast radius: broad; unflagged
- [P2] Jest.config.channels (jest.config.channels)
  Score: 2
  Reasons: No specific reasons
  Files: channels/jest.config.channels.js
  Audience: member
  Blast radius: broad; unflagged
- [P2] Jest.config.mattermost Redux (jest.config.mattermost-redux)
  Score: 2
  Reasons: No specific reasons
  Files: channels/jest.config.mattermost-redux.js
  Audience: member
  Blast radius: broad; unflagged
- [P2] De (de)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/i18n/de.json
  Audience: member
  Blast radius: broad; unflagged
- [P2] En AU (en-AU)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/i18n/en-AU.json
  Audience: member
  Blast radius: broad; unflagged
- [P2] En (en)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/i18n/en.json
  Audience: member
  Blast radius: broad; unflagged
- [P2] Hr (hr)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/i18n/hr.json
  Audience: member
  Blast radius: broad; unflagged
- [P2] Nb NO (nb-NO)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/i18n/nb-NO.json
  Audience: member
  Blast radius: broad; unflagged
- [P2] Nl (nl)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/i18n/nl.json
  Audience: member
  Blast radius: broad; unflagged
- [P2] Pl (pl)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/i18n/pl.json
  Audience: member
  Blast radius: broad; unflagged
- [P2] Sv (sv)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/i18n/sv.json
  Audience: member
  Blast radius: broad; unflagged
- [P2] Zh CN (zh-CN)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/i18n/zh-CN.json
  Audience: member
  Blast radius: broad; unflagged
- [P2] Data Loader (data_loader)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/packages/mattermost-redux/src/utils/data_loader.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Emoji Utils (emoji_utils)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/packages/mattermost-redux/src/utils/emoji_utils.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Export (export)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/plugins/export.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Shared Dependencies (shared_dependencies)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/plugins/shared_dependencies.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Date Utils (date_utils)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/utils/date_utils.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Dialog Conversion (dialog_conversion)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/utils/dialog_conversion.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Remove Markdown (remove_markdown)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/utils/markdown/remove_markdown.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Test Helper (test_helper)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/utils/test_helper.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Timezone (timezone)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/utils/timezone.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Webpack.config (webpack.config)
  Score: 2
  Reasons: No specific reasons
  Files: channels/webpack.config.js
  Audience: member
  Blast radius: broad; unflagged
- [P2] Package Lock (package-lock)
  Score: 2
  Reasons: No specific reasons
  Files: package-lock.json
  Audience: member
  Blast radius: broad; unflagged
- [P2] .eslintrc (.eslintrc)
  Score: 2
  Reasons: No specific reasons
  Files: platform/shared/.eslintrc.json
  Audience: member
  Blast radius: broad; unflagged
- [P2] .parcelrc (.parcelrc)
  Score: 2
  Reasons: No specific reasons
  Files: platform/shared/.parcelrc
  Audience: member
  Blast radius: broad; unflagged
- [P2] .stylelintignore (.stylelintignore)
  Score: 2
  Reasons: No specific reasons
  Files: platform/shared/.stylelintignore
  Audience: member
  Blast radius: broad; unflagged
- [P2] .stylelintrc (.stylelintrc)
  Score: 2
  Reasons: No specific reasons
  Files: platform/shared/.stylelintrc.json
  Audience: member
  Blast radius: broad; unflagged
- [P2] README (README)
  Score: 2
  Reasons: No specific reasons
  Files: platform/shared/README.md
  Audience: member
  Blast radius: broad; unflagged
- [P2] Parcel Namer Shared (parcel-namer-shared)
  Score: 2
  Reasons: No specific reasons
  Files: platform/shared/build/parcel-namer-shared.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Webpack Web App Externals (webpack-web-app-externals)
  Score: 2
  Reasons: No specific reasons
  Files: platform/shared/build/webpack-web-app-externals.cjs
  Audience: member
  Blast radius: broad; unflagged
- [P2] Setup Jest (setup_jest)
  Score: 2
  Reasons: No specific reasons
  Files: platform/shared/setup_jest.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Testing (testing)
  Score: 2
  Reasons: No specific reasons
  Files: platform/shared/src/testing/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Apps (apps)
  Score: 2
  Reasons: No specific reasons
  Files: platform/types/src/apps.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Config (config)
  Score: 2
  Reasons: No specific reasons
  Files: platform/types/src/config.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Emojis (emojis)
  Score: 2
  Reasons: No specific reasons
  Files: platform/types/src/emojis.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Integrations (integrations)
  Score: 2
  Reasons: No specific reasons
  Files: platform/types/src/integrations.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Reports (reports)
  Score: 2
  Reasons: No specific reasons
  Files: platform/types/src/reports.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Action Types (action_types)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/packages/mattermost-redux/src/action_types/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Reactions (reactions)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/packages/mattermost-redux/src/selectors/entities/reactions.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Access Control (access_control)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/packages/mattermost-redux/src/selectors/entities/access_control.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Storage Utils (storage_utils)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/utils/storage_utils.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Products (products)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/utils/products.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Overage Team (overage_team)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/utils/overage_team.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Notify Admin Utils (notify_admin_utils)
  Score: 2
  Reasons: Critical keyword: admin
  Files: channels/src/utils/notify_admin_utils.ts
  Audience: channel_admin
  Blast radius: admin-only; unflagged
- [P2] Contact Support Sales (contact_support_sales)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/utils/contact_support_sales.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] A11y Utils (a11y_utils)
  Score: 2
  Reasons: No specific reasons
  Files: channels/src/utils/a11y_utils.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Websocket (websocket)
  Score: 2
  Reasons: No specific reasons
  Files: platform/client/src/websocket.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Src (src)
  Score: 2
  Reasons: No specific reasons
  Files: platform/client/src/index.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Marketplace (marketplace)
  Score: 2
  Reasons: No specific reasons
  Files: platform/types/src/marketplace.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] General (general)
  Score: 2
  Reasons: No specific reasons
  Files: platform/types/src/general.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Cloud (cloud)
  Score: 2
  Reasons: No specific reasons
  Files: platform/types/src/cloud.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Hosted Customer (hosted_customer)
  Score: 2
  Reasons: No specific reasons
  Files: platform/types/src/hosted_customer.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Schedule Post (schedule_post)
  Score: 2
  Reasons: No specific reasons
  Files: platform/types/src/schedule_post.ts
  Audience: member
  Blast radius: broad; unflagged
- [P2] Drafts (drafts)
  Score: 2
  Reasons: No specific reasons
  Files: platform/types/src/drafts.ts
  Audience: member
  Blast radius: broad; unflagged

Coverage Gaps (P0/P1 without tests):
- [P1] Package (package)
- [P1] Websocket Actions (websocket_actions)
- [P1] Add User To Channel Modal.test.tsx (add_user_to_channel_modal.test.tsx)
- [P0] Editor (editor)
- [P1] Admin Definition (admin_definition)
- [P0] Custom Profile Attributes (custom_profile_attributes)
- [P0] Licensed Section Container (licensed_section_container)
- [P0] Auto Translation (auto_translation)
- [P1] Permissions Tree.test.tsx (permissions_tree.test.tsx)
- [P1] Settings Group (settings_group)
- [P1] Types (types)
- [P0] Apps Form Component (apps_form_component)
- [P0] Apps Form Date Field (apps_form_date_field)
- [P0] Apps Form Datetime Field (apps_form_datetime_field)
- [P0] Apps Form Field (apps_form_field)
- [P1] Style (style)
- [P0] Bookmark Dot Menu (bookmark_dot_menu)
- [P0] Channel Header Menu (channel_header_menu)
- [P1] Channel Header Direct Menu (channel_header_direct_menu)
- [P1] Channel Header Group Menu (channel_header_group_menu)
- [P0] Autotranslation (autotranslation)
- [P0] Channel Settings Configuration Tab (channel_settings_configuration_tab)
- [P0] Channel Settings Info Tab (channel_settings_info_tab)
- [P0] Channel Settings Modal (channel_settings_modal)
- [P1] Code Preview (code_preview)
- [P0] Custom Status Modal (custom_status_modal)
- [P0] Date Time Picker Modal (date_time_picker_modal)
- [P1] Datetime Input.test.tsx (datetime_input.test.tsx)
- [P0] Datetime Input (datetime_input)
- [P0] Dnd Custom Time Picker Modal (dnd_custom_time_picker_modal)
- [P1] Render Emoji (render_emoji)
- [P0] File Thumbnail (file_thumbnail)
- [P0] File Attachment List (file_attachment_list)
- [P0] File Preview Modal (file_preview_modal)
- [P1] Info Toast.test.tsx (info_toast.test.tsx)
- [P0] Info Toast (info_toast)
- [P0] Markdown (markdown)
- [P0] Multiselect (multiselect)
- [P1] Post (post)
- [P0] Post Edit History (post_edit_history)
- [P0] Data Spillage Report (data_spillage_report)
- [P1] Post List (post_list)
- [P0] Post Message Preview (post_message_preview)
- [P1] Properties Card View (properties_card_view)
- [P1] Channel Property Renderer (channel_property_renderer)
- [P1] Post Preview Property Renderer (post_preview_property_renderer)
- [P1] Team Property Renderer (team_property_renderer)
- [P0] Quick Input (quick_input)
- [P1] Quick Switch Modal.test.tsx (quick_switch_modal.test.tsx)
- [P0] Remove Flagged Message Confirmation Modal (remove_flagged_message_confirmation_modal)
- [P1] Resizable Divider (resizable_divider)
- [P1] Root Provider (root_provider)
- [P1] Shared Package Provider (shared_package_provider)
- [P0] Search Bar (search_bar)
- [P0] Post Search Results Item (post_search_results_item)
- [P0] Sidebar Team Menu (sidebar_team_menu)
- [P0] Single Image View (single_image_view)
- [P0] Size Aware Image (size_aware_image)
- [P1] App Command Parser Dependencies (app_command_parser_dependencies)
- [P0] Switch Channel Provider (switch_channel_provider)
- [P0] File Card (file_card)
- [P0] Thread Item (thread_item)
- [P1] Virtualized Thread Viewer (virtualized_thread_viewer)
- [P1] Admin Section Panel (admin_section_panel)
- [P0] Files (files)
- [P0] Posts (posts)
- [P1] Channels (channels)
- [P1] Initial State (initial_state)
- [P1] Apps Modal (_apps-modal)
- [P1] Inputs (_inputs)
- [P1] Modal (_modal)
- [P1] Channel Settings.ts (channel_settings.ts)
- [P1] Constants (constants)
- [P1] Link Only Renderer (link_only_renderer)
- [P0] Utils (utils)
- [P1] Websocket Events (websocket_events)
- [P1] Websocket Message (websocket_message)
- [P1] Websocket Messages (websocket_messages)
- [P1] Tsconfig (tsconfig)
- [P0] Context (context)
- [P1] UseEmojiByName (useEmojiByName)
- [P1] UseEmojiUrl (useEmojiUrl)
- [P1] React Testing Utils (react_testing_utils)
- [P1] UseMockSharedContext (useMockSharedContext)
- [P0] Admin Sidebar (admin_sidebar)
- [P1] Admin Definition Ldap Wizard (admin_definition_ldap_wizard)
- [P0] Ldap Text Setting (ldap_text_setting)
- [P1] Ldap Jobs Table Setting (ldap_jobs_table_setting)
- [P1] Ldap Helpers (ldap_helpers)
- [P0] Ldap File Upload Setting (ldap_file_upload_setting)
- [P0] Ldap Expandable Setting (ldap_expandable_setting)
- [P0] Ldap Dropdown Setting (ldap_dropdown_setting)
- [P0] Ldap Custom Setting (ldap_custom_setting)
- [P1] Ldap Button Setting (ldap_button_setting)
- [P0] Ldap Boolean Setting (ldap_boolean_setting)
- [P0] Session Length Settings (session_length_settings)
- [P0] Push Settings (push_settings)
- [P0] Password Settings (password_settings)
- [P0] Message Export Settings (message_export_settings)
- [P0] Elasticsearch Settings (elasticsearch_settings)
- [P0] Database Settings (database_settings)
- [P0] Cluster Settings (cluster_settings)
- [P0] Schema Admin Settings (schema_admin_settings)
- [P1] Admin Definition Helpers (admin_definition_helpers)
- [P0] Admin Console (admin_console)
- [P0] System Properties (system_properties)
- [P0] Secure Connections (secure_connections)
- [P1] Custom Plugin Settings (custom_plugin_settings)
- [P1] Enable Plugin Setting (enable_plugin_setting)
- [P1] Apps Form Container (apps_form_container)
- [P0] Bookmark Item (bookmark_item)
- [P0] Mobile Channel Header (mobile_channel_header)
- [P1] Channel Header Title (channel_header_title)
- [P1] Channel Header Public Private Menu (channel_header_public_private_menu)
- [P0] Multiselect List (multiselect_list)
- [P0] Post View (post_view)
- [P1] PropertyValueRenderer (propertyValueRenderer)
- [P0] Resizable Rhs (resizable_rhs)
- [P1] Resizable Lhs (resizable_lhs)
- [P0] Root (root)
- [P0] Sidebar Header (sidebar_header)
- [P1] Command Provider (command_provider)
- [P1] App Provider (app_provider)
- [P1] App Command Parser (app_command_parser)
- [P1] Attachments (attachments)
- [P1] Virtualized Thread List Row (virtualized_thread_list_row)
- [P0] Thread Viewer (thread_viewer)
- [P1] Threads (threads)
- [P1] Search (search)
- [P1] Actions (actions)
- [P1] Entities (entities)
- [P1] ConfigureStore (configureStore)
- [P1] Text Formatting (text_formatting)
- [P1] Syntax Highlighting (syntax_highlighting)
- [P1] Store (store)
- [P1] Admin (admin)
- [P0] Channel Bookmarks (channel_bookmarks)
- [P0] System Users Filter Team (system_users_filter_team)
- [P0] System Users Filter Role (system_users_filter_role)
- [P0] Styled Users Filters Status (styled_users_filters_status)
- [P0] System Users Export (system_users_export)
- [P0] LibreTranslate Settings (libreTranslate_settings)
- [P0] Agents Settings (agents_settings)
- [P0] Content Reviewers (content_reviewers)
- [P1] Dashboard (dashboard)
- [P1] Apps Form (apps_form)
- [P0] Mobile Sidebar Right (mobile_sidebar_right)
- [P1] Virtualized Thread List (virtualized_thread_list)
- [P0] Agents (agents)
- [P1] Reducers (reducers)
- [P0] System Users Filters Popover (system_users_filters_popover)
- [P0] User Multiselector (user_multiselector)
- [P0] Thread List (thread_list)
- [P0] Global Threads (global_threads)

Recommended Tests to Run:
- specs/accessibility/channels/add_people_to_channel_dialog.spec.ts
- specs/accessibility/channels/browse_channels_dialog.spec.ts
- specs/accessibility/channels/team_menu.spec.ts
- specs/client/upload_file.spec.ts
- specs/functional/channels/autotranslation/autotranslation.spec.ts
- specs/functional/channels/channel_banner/channel_banner.spec.ts
- specs/functional/channels/content_flagging/flagging/flag-messages.spec.ts
- specs/functional/channels/content_flagging/notifications/author-notification.spec.ts
- specs/functional/channels/content_flagging/notifications/reporter-notification.spec.ts
- specs/functional/channels/content_flagging/reviewer-actions/reviewer-actions.spec.ts
- specs/functional/channels/content_flagging/reviewer-reports/cross-team-flag-reports-global-reviewers.spec.ts
- specs/functional/channels/emoji_picker/emoji_picker.spec.ts
- specs/functional/channels/file_attachments/edit_file_attachment.spec.ts
- specs/functional/channels/file_attachments/edit_message_with_attachment.spec.ts
- specs/functional/channels/search/find_channels.spec.ts
- specs/functional/channels/search/find_channels_korean.spec.ts
- specs/functional/channels/search/search_box_clear_button.spec.ts
- specs/functional/channels/search/search_box_korean.spec.ts
- specs/functional/channels/search/search_box_suggestions.spec.ts
- specs/functional/channels/sidebar_right/page_up_down_scroll.spec.ts
- specs/functional/channels/team_settings/invite_user_to_closed_team.spec.ts
- specs/functional/channels/team_settings/team_settings_modal.spec.ts
- specs/functional/plugins/demo_plugin_installation.spec.ts
- specs/functional/system_console/abac/ldap/ldap_sync.spec.ts
- specs/functional/system_console/abac/policies/advanced_policies.spec.ts
- specs/functional/system_console/abac/policies/create_policies.spec.ts
- specs/functional/system_console/abac/policy_management/delete_policies.spec.ts
- specs/functional/system_console/abac/policy_management/edit_policies.spec.ts
- specs/functional/system_console/permissions/team_access.spec.ts
- specs/functional/system_console/site_configuration/autotranslation_system_console.spec.ts
- specs/functional/system_console/system_users/actions.spec.ts
- specs/functional/system_console/system_users/column_sort.spec.ts
- specs/functional/system_console/system_users/column_toggler.spec.ts
- specs/functional/system_console/system_users/export_data.spec.ts
- specs/functional/system_console/system_users/filter_popover.spec.ts

data-testid Suggestions:
- channels/src/components/apps_form/apps_form_component.tsx:597 -> apps_form_component-form-1
  <form onSubmit={this.handleSubmit}>

Suggested New Tests (Actionable):
- [P1] Package (package)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/package.spec.ts
  Source files: channels/package.json, package.json, platform/shared/package.json
  Why: High priority flow is currently uncovered
- [P1] Websocket Actions (websocket_actions)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/websocket_actions.spec.ts
  Source files: channels/src/actions/websocket_actions.ts
  Why: State or data flow change; Interactive element change
- [P1] Add User To Channel Modal.test.tsx (add_user_to_channel_modal.test.tsx)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/add_user_to_channel_modal.test.tsx.spec.ts
  Source files: channels/src/components/add_user_to_channel_modal/__snapshots__/add_user_to_channel_modal.test.tsx.snap
  Why: Shared component change
- [P0] Editor (editor)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/editor.spec.ts
  Source files: channels/src/components/admin_console/access_control/editors/cel_editor/editor.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P1] Admin Definition (admin_definition)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/admin_definition.spec.ts
  Source files: channels/src/components/admin_console/admin_definition.tsx
  Why: Shared component change; UI logic change; Critical keyword: admin
- [P0] Custom Profile Attributes (custom_profile_attributes)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/custom_profile_attributes.spec.ts
  Source files: channels/src/components/admin_console/custom_profile_attributes/custom_profile_attributes.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] Licensed Section Container (licensed_section_container)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/licensed_section_container.spec.ts
  Source files: channels/src/components/admin_console/licensed_section_container/licensed_section_container.tsx, channels/src/components/admin_console/licensed_section_container/index.ts
  Why: Shared component change; UI logic change; Critical keyword: admin
- [P0] Auto Translation (auto_translation)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/auto_translation.spec.ts
  Source files: channels/src/components/admin_console/localization/auto_translation.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P1] Permissions Tree.test.tsx (permissions_tree.test.tsx)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/permissions_tree.test.tsx.spec.ts
  Source files: channels/src/components/admin_console/permission_schemes_settings/permissions_tree/__snapshots__/permissions_tree.test.tsx.snap
  Why: Shared component change; Critical keyword: admin
- [P1] Settings Group (settings_group)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/settings_group.spec.ts
  Source files: channels/src/components/admin_console/settings_group.tsx
  Why: Shared component change; UI logic change; Critical keyword: admin
- [P1] Types (types)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/types.spec.ts
  Source files: channels/src/components/admin_console/types.ts
  Why: Shared component change; Critical keyword: admin
- [P0] Apps Form Component (apps_form_component)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/apps_form_component.spec.ts
  Source files: channels/src/components/apps_form/apps_form_component.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P0] Apps Form Date Field (apps_form_date_field)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/apps_form_date_field.spec.ts
  Source files: channels/src/components/apps_form/apps_form_date_field/apps_form_date_field.tsx, channels/src/components/apps_form/apps_form_date_field/index.ts
  Why: Shared component change; UI logic change; Interactive element change
- [P0] Apps Form Datetime Field (apps_form_datetime_field)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/apps_form_datetime_field.spec.ts
  Source files: channels/src/components/apps_form/apps_form_datetime_field/apps_form_datetime_field.tsx, channels/src/components/apps_form/apps_form_datetime_field/index.ts
  Why: Shared component change; UI logic change; Interactive element change
- [P0] Apps Form Field (apps_form_field)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/apps_form_field.spec.ts
  Source files: channels/src/components/apps_form/apps_form_field/apps_form_field.tsx, channels/src/components/apps_form/apps_form_field/index.ts
  Why: Shared component change; UI logic change; Interactive element change
- [P1] Style (style)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/style.spec.ts
  Source files: channels/src/components/channel_banner/style.scss
  Why: Shared component change; Visual styling change
- [P0] Bookmark Dot Menu (bookmark_dot_menu)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/bookmark_dot_menu.spec.ts
  Source files: channels/src/components/channel_bookmarks/bookmark_dot_menu.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P0] Channel Header Menu (channel_header_menu)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/channel_header_menu.spec.ts
  Source files: channels/src/components/channel_header_menu/channel_header_menu.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P1] Channel Header Direct Menu (channel_header_direct_menu)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/channel_header_direct_menu.spec.ts
  Source files: channels/src/components/channel_header_menu/channel_header_menu_items/channel_header_direct_menu.tsx
  Why: Shared component change; UI logic change
- [P1] Channel Header Group Menu (channel_header_group_menu)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/channel_header_group_menu.spec.ts
  Source files: channels/src/components/channel_header_menu/channel_header_menu_items/channel_header_group_menu.tsx
  Why: Shared component change; UI logic change
- [P0] Autotranslation (autotranslation)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/autotranslation.spec.ts
  Source files: channels/src/components/channel_header_menu/menu_items/autotranslation.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P0] Channel Settings Configuration Tab (channel_settings_configuration_tab)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/channel_settings_configuration_tab.spec.ts
  Source files: channels/src/components/channel_settings_modal/channel_settings_configuration_tab.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: settings
- [P0] Channel Settings Info Tab (channel_settings_info_tab)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/channel_settings_info_tab.spec.ts
  Source files: channels/src/components/channel_settings_modal/channel_settings_info_tab.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: settings
- [P0] Channel Settings Modal (channel_settings_modal)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/channel_settings_modal.spec.ts
  Source files: channels/src/components/channel_settings_modal/channel_settings_modal.tsx
  Why: Shared component change; UI logic change; Critical keyword: settings
- [P1] Code Preview (code_preview)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/code_preview.spec.ts
  Source files: channels/src/components/code_preview.tsx
  Why: Shared component change; UI logic change
- [P0] Custom Status Modal (custom_status_modal)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/custom_status_modal.spec.ts
  Source files: channels/src/components/custom_status/custom_status_modal.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P0] Date Time Picker Modal (date_time_picker_modal)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/date_time_picker_modal.spec.ts
  Source files: channels/src/components/date_time_picker_modal/date_time_picker_modal.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P1] Datetime Input.test.tsx (datetime_input.test.tsx)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/datetime_input.test.tsx.spec.ts
  Source files: channels/src/components/datetime_input/__snapshots__/datetime_input.test.tsx.snap
  Why: Shared component change
- [P0] Datetime Input (datetime_input)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/datetime_input.spec.ts
  Source files: channels/src/components/datetime_input/datetime_input.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P0] Dnd Custom Time Picker Modal (dnd_custom_time_picker_modal)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/dnd_custom_time_picker_modal.spec.ts
  Source files: channels/src/components/dnd_custom_time_picker_modal/dnd_custom_time_picker_modal.tsx, channels/src/components/dnd_custom_time_picker_modal/index.ts
  Why: Shared component change; UI logic change
- [P1] Render Emoji (render_emoji)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/render_emoji.spec.ts
  Source files: channels/src/components/emoji/render_emoji.tsx
  Why: Shared component change; UI logic change
- [P0] File Thumbnail (file_thumbnail)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/file_thumbnail.spec.ts
  Source files: channels/src/components/file_attachment/file_thumbnail/file_thumbnail.tsx, channels/src/components/file_attachment/file_thumbnail/index.ts
  Why: Shared component change; UI logic change
- [P0] File Attachment List (file_attachment_list)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/file_attachment_list.spec.ts
  Source files: channels/src/components/file_attachment_list/file_attachment_list.tsx, channels/src/components/file_attachment_list/index.ts
  Why: Shared component change; UI logic change
- [P0] File Preview Modal (file_preview_modal)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/file_preview_modal.spec.ts
  Source files: channels/src/components/file_preview_modal/file_preview_modal.tsx, channels/src/components/file_preview_modal/index.ts
  Why: Shared component change; UI logic change; Interactive element change
- [P1] Info Toast.test.tsx (info_toast.test.tsx)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/info_toast.test.tsx.spec.ts
  Source files: channels/src/components/info_toast/__snapshots__/info_toast.test.tsx.snap
  Why: Shared component change
- [P0] Info Toast (info_toast)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/info_toast.spec.ts
  Source files: channels/src/components/info_toast/info_toast.scss, channels/src/components/info_toast/info_toast.tsx
  Why: Shared component change; Visual styling change; UI logic change; Interactive element change
- [P0] Markdown (markdown)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/markdown.spec.ts
  Source files: channels/src/components/markdown/index.ts, channels/src/components/markdown/markdown.tsx
  Why: Shared component change; UI logic change
- [P0] Multiselect (multiselect)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/multiselect.spec.ts
  Source files: channels/src/components/multiselect/multiselect.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P1] Post (post)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/post.spec.ts
  Source files: channels/src/components/post/index.tsx
  Why: Shared component change; UI logic change
- [P0] Post Edit History (post_edit_history)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/post_edit_history.spec.ts
  Source files: channels/src/components/post_edit_history/index.ts, channels/src/components/post_edit_history/post_edit_history.tsx
  Why: Shared component change; UI logic change
- [P0] Data Spillage Report (data_spillage_report)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/data_spillage_report.spec.ts
  Source files: channels/src/components/post_view/data_spillage_report/data_spillage_report.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P1] Post List (post_list)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/post_list.spec.ts
  Source files: channels/src/components/post_view/post_list/index.tsx
  Why: Shared component change; UI logic change
- [P0] Post Message Preview (post_message_preview)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/post_message_preview.spec.ts
  Source files: channels/src/components/post_view/post_message_preview/index.ts, channels/src/components/post_view/post_message_preview/post_message_preview.tsx
  Why: Shared component change; Critical keyword: message; UI logic change
- [P1] Properties Card View (properties_card_view)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/properties_card_view.spec.ts
  Source files: channels/src/components/properties_card_view/properties_card_view.tsx
  Why: Shared component change; UI logic change
- [P1] Channel Property Renderer (channel_property_renderer)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/channel_property_renderer.spec.ts
  Source files: channels/src/components/properties_card_view/propertyValueRenderer/channel_property_renderer/channel_property_renderer.tsx
  Why: Shared component change; UI logic change
- [P1] Post Preview Property Renderer (post_preview_property_renderer)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/post_preview_property_renderer.spec.ts
  Source files: channels/src/components/properties_card_view/propertyValueRenderer/post_preview_property_renderer/post_preview_property_renderer.tsx
  Why: Shared component change; UI logic change
- [P1] Team Property Renderer (team_property_renderer)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/team_property_renderer.spec.ts
  Source files: channels/src/components/properties_card_view/propertyValueRenderer/team_property_renderer/team_property_renderer.tsx
  Why: Shared component change; UI logic change
- [P0] Quick Input (quick_input)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/quick_input.spec.ts
  Source files: channels/src/components/quick_input/quick_input.tsx, channels/src/components/quick_input/index.ts
  Why: Shared component change; UI logic change; Interactive element change
- [P1] Quick Switch Modal.test.tsx (quick_switch_modal.test.tsx)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/quick_switch_modal.test.tsx.spec.ts
  Source files: channels/src/components/quick_switch_modal/__snapshots__/quick_switch_modal.test.tsx.snap
  Why: Shared component change
- [P0] Remove Flagged Message Confirmation Modal (remove_flagged_message_confirmation_modal)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/remove_flagged_message_confirmation_modal.spec.ts
  Source files: channels/src/components/remove_flagged_message_confirmation_modal/remove_flagged_message_confirmation_modal.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: message
- [P1] Resizable Divider (resizable_divider)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/resizable_divider.spec.ts
  Source files: channels/src/components/resizable_sidebar/resizable_divider.tsx
  Why: Shared component change; UI logic change
- [P1] Root Provider (root_provider)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/root_provider.spec.ts
  Source files: channels/src/components/root/root_provider.tsx
  Why: Shared component change; UI logic change
- [P1] Shared Package Provider (shared_package_provider)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/shared_package_provider.spec.ts
  Source files: channels/src/components/root/shared_package_provider.tsx
  Why: Shared component change; UI logic change
- [P0] Search Bar (search_bar)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/search_bar.spec.ts
  Source files: channels/src/components/search_bar/search_bar.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: search
- [P0] Post Search Results Item (post_search_results_item)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/post_search_results_item.spec.ts
  Source files: channels/src/components/search_results/post_search_results_item.tsx
  Why: Shared component change; UI logic change; Critical keyword: search
- [P0] Sidebar Team Menu (sidebar_team_menu)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/sidebar_team_menu.spec.ts
  Source files: channels/src/components/sidebar/sidebar_header/sidebar_team_menu.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P0] Single Image View (single_image_view)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/single_image_view.spec.ts
  Source files: channels/src/components/single_image_view/index.ts, channels/src/components/single_image_view/single_image_view.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P0] Size Aware Image (size_aware_image)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/size_aware_image.spec.ts
  Source files: channels/src/components/size_aware_image.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P1] App Command Parser Dependencies (app_command_parser_dependencies)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/app_command_parser_dependencies.spec.ts
  Source files: channels/src/components/suggestion/command_provider/app_command_parser/app_command_parser_dependencies.ts
  Why: Shared component change
- [P0] Switch Channel Provider (switch_channel_provider)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/switch_channel_provider.spec.ts
  Source files: channels/src/components/suggestion/switch_channel_provider.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P0] File Card (file_card)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/file_card.spec.ts
  Source files: channels/src/components/threading/global_threads/thread_item/attachments/file_card/file_card.tsx, channels/src/components/threading/global_threads/thread_item/attachments/file_card/index.ts
  Why: Shared component change; UI logic change
- [P0] Thread Item (thread_item)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/thread_item.spec.ts
  Source files: channels/src/components/threading/global_threads/thread_item/index.ts, channels/src/components/threading/global_threads/thread_item/thread_item.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P1] Virtualized Thread Viewer (virtualized_thread_viewer)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/virtualized_thread_viewer.spec.ts
  Source files: channels/src/components/threading/virtualized_thread_viewer/index.ts
  Why: Shared component change
- [P1] Admin Section Panel (admin_section_panel)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/admin_section_panel.spec.ts
  Source files: channels/src/components/widgets/admin_console/admin_section_panel.tsx
  Why: Shared component change; UI logic change; Critical keyword: admin
- [P0] Files (files)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/files.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/action_types/files.ts, channels/src/packages/mattermost-redux/src/reducers/entities/files.ts, channels/src/packages/mattermost-redux/src/selectors/entities/files.ts, platform/types/src/files.ts
  Why: State or data flow change
- [P0] Posts (posts)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/posts.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/actions/posts.ts, channels/src/packages/mattermost-redux/src/reducers/entities/posts.ts, platform/types/src/posts.ts
  Why: State or data flow change
- [P1] Channels (channels)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/channels.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/selectors/entities/channels.ts, channels/src/packages/mattermost-redux/src/actions/channels.ts
  Why: State or data flow change
- [P1] Initial State (initial_state)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/initial_state.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/store/initial_state.ts
  Why: State or data flow change
- [P1] Apps Modal (_apps-modal)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/_apps-modal.spec.ts
  Source files: channels/src/sass/components/_apps-modal.scss
  Why: Shared component change; Visual styling change
- [P1] Inputs (_inputs)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/_inputs.spec.ts
  Source files: channels/src/sass/components/_inputs.scss
  Why: Shared component change; Visual styling change
- [P1] Modal (_modal)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/_modal.spec.ts
  Source files: channels/src/sass/components/_modal.scss
  Why: Shared component change; Visual styling change
- [P1] Channel Settings.ts (channel_settings.ts)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/channel_settings.ts.spec.ts
  Source files: channels/src/selectors/views/channel_settings.ts
  Why: Critical keyword: settings
- [P1] Constants (constants)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/constants.spec.ts
  Source files: channels/src/utils/constants.tsx
  Why: UI logic change
- [P1] Link Only Renderer (link_only_renderer)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/link_only_renderer.spec.ts
  Source files: channels/src/utils/markdown/link_only_renderer.tsx
  Why: UI logic change
- [P0] Utils (utils)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/utils.spec.ts
  Source files: channels/src/utils/utils.tsx, channels/src/components/admin_console/system_users/utils/index.tsx
  Why: UI logic change; Shared component change; Critical keyword: admin
- [P1] Websocket Events (websocket_events)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/websocket_events.spec.ts
  Source files: platform/client/src/websocket_events.ts
  Why: Interactive element change
- [P1] Websocket Message (websocket_message)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/websocket_message.spec.ts
  Source files: platform/client/src/websocket_message.ts
  Why: Interactive element change; Critical keyword: message
- [P1] Websocket Messages (websocket_messages)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/websocket_messages.spec.ts
  Source files: platform/client/src/websocket_messages.ts
  Why: Interactive element change
- [P1] Tsconfig (tsconfig)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/tsconfig.spec.ts
  Source files: platform/client/tsconfig.json, platform/mattermost-redux/tsconfig.json, platform/shared/tsconfig.json
  Why: High priority flow is currently uncovered
- [P0] Context (context)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/context.spec.ts
  Source files: platform/shared/src/context/context.tsx, platform/shared/src/context/index.ts
  Why: UI logic change; State or data flow change
- [P1] UseEmojiByName (useEmojiByName)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/useEmojiByName.spec.ts
  Source files: platform/shared/src/context/useEmojiByName.ts
  Why: State or data flow change
- [P1] UseEmojiUrl (useEmojiUrl)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/useEmojiUrl.spec.ts
  Source files: platform/shared/src/context/useEmojiUrl.ts
  Why: State or data flow change
- [P1] React Testing Utils (react_testing_utils)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/react_testing_utils.spec.ts
  Source files: platform/shared/src/testing/react_testing_utils.tsx
  Why: UI logic change
- [P1] UseMockSharedContext (useMockSharedContext)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/useMockSharedContext.spec.ts
  Source files: platform/shared/src/testing/useMockSharedContext.tsx
  Why: UI logic change
- [P0] Admin Sidebar (admin_sidebar)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/admin_sidebar.spec.ts
  Source files: channels/src/components/admin_console/admin_sidebar/admin_sidebar.tsx, channels/src/components/admin_console/admin_sidebar/index.ts
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P1] Admin Definition Ldap Wizard (admin_definition_ldap_wizard)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/admin_definition_ldap_wizard.spec.ts
  Source files: channels/src/components/admin_console/admin_definition_ldap_wizard.tsx
  Why: Shared component change; UI logic change; Critical keyword: admin
- [P0] Ldap Text Setting (ldap_text_setting)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/ldap_text_setting.spec.ts
  Source files: channels/src/components/admin_console/ldap_wizard/ldap_text_setting.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P1] Ldap Jobs Table Setting (ldap_jobs_table_setting)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/ldap_jobs_table_setting.spec.ts
  Source files: channels/src/components/admin_console/ldap_wizard/ldap_jobs_table_setting.tsx
  Why: Shared component change; UI logic change; Critical keyword: admin
- [P1] Ldap Helpers (ldap_helpers)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/ldap_helpers.spec.ts
  Source files: channels/src/components/admin_console/ldap_wizard/ldap_helpers.tsx
  Why: Shared component change; UI logic change; Critical keyword: admin
- [P0] Ldap File Upload Setting (ldap_file_upload_setting)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/ldap_file_upload_setting.spec.ts
  Source files: channels/src/components/admin_console/ldap_wizard/ldap_file_upload_setting.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] Ldap Expandable Setting (ldap_expandable_setting)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/ldap_expandable_setting.spec.ts
  Source files: channels/src/components/admin_console/ldap_wizard/ldap_expandable_setting.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] Ldap Dropdown Setting (ldap_dropdown_setting)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/ldap_dropdown_setting.spec.ts
  Source files: channels/src/components/admin_console/ldap_wizard/ldap_dropdown_setting.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] Ldap Custom Setting (ldap_custom_setting)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/ldap_custom_setting.spec.ts
  Source files: channels/src/components/admin_console/ldap_wizard/ldap_custom_setting.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P1] Ldap Button Setting (ldap_button_setting)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/ldap_button_setting.spec.ts
  Source files: channels/src/components/admin_console/ldap_wizard/ldap_button_setting.tsx
  Why: Shared component change; UI logic change; Critical keyword: admin
- [P0] Ldap Boolean Setting (ldap_boolean_setting)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/ldap_boolean_setting.spec.ts
  Source files: channels/src/components/admin_console/ldap_wizard/ldap_boolean_setting.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] Session Length Settings (session_length_settings)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/session_length_settings.spec.ts
  Source files: channels/src/components/admin_console/session_length_settings.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] Push Settings (push_settings)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/push_settings.spec.ts
  Source files: channels/src/components/admin_console/push_settings.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] Password Settings (password_settings)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/password_settings.spec.ts
  Source files: channels/src/components/admin_console/password_settings.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] Message Export Settings (message_export_settings)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/message_export_settings.spec.ts
  Source files: channels/src/components/admin_console/message_export_settings.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] Elasticsearch Settings (elasticsearch_settings)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/elasticsearch_settings.spec.ts
  Source files: channels/src/components/admin_console/elasticsearch_settings.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] Database Settings (database_settings)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/database_settings.spec.ts
  Source files: channels/src/components/admin_console/database_settings.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] Cluster Settings (cluster_settings)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/cluster_settings.spec.ts
  Source files: channels/src/components/admin_console/cluster_settings.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] Schema Admin Settings (schema_admin_settings)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/schema_admin_settings.spec.ts
  Source files: channels/src/components/admin_console/schema_admin_settings.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P1] Admin Definition Helpers (admin_definition_helpers)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/admin_definition_helpers.spec.ts
  Source files: channels/src/components/admin_console/admin_definition_helpers.tsx
  Why: Shared component change; UI logic change; Critical keyword: admin
- [P0] Admin Console (admin_console)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/admin_console.spec.ts
  Source files: channels/src/components/admin_console/admin_console.tsx, channels/src/components/admin_console/index.ts
  Why: Shared component change; UI logic change; Critical keyword: admin
- [P0] System Properties (system_properties)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/system_properties.spec.ts
  Source files: channels/src/components/admin_console/system_properties/system_properties.tsx, channels/src/components/admin_console/system_properties/index.ts
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] Secure Connections (secure_connections)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/secure_connections.spec.ts
  Source files: channels/src/components/admin_console/secure_connections/secure_connections.tsx, channels/src/components/admin_console/secure_connections/index.ts
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P1] Custom Plugin Settings (custom_plugin_settings)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/custom_plugin_settings.spec.ts
  Source files: channels/src/components/admin_console/custom_plugin_settings/index.ts
  Why: Shared component change; Critical keyword: admin
- [P1] Enable Plugin Setting (enable_plugin_setting)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/enable_plugin_setting.spec.ts
  Source files: channels/src/components/admin_console/custom_plugin_settings/enable_plugin_setting.ts
  Why: Shared component change; Critical keyword: admin
- [P1] Apps Form Container (apps_form_container)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/apps_form_container.spec.ts
  Source files: channels/src/components/apps_form/apps_form_container.tsx
  Why: Shared component change; UI logic change
- [P0] Bookmark Item (bookmark_item)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/bookmark_item.spec.ts
  Source files: channels/src/components/channel_bookmarks/bookmark_item.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P0] Mobile Channel Header (mobile_channel_header)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/mobile_channel_header.spec.ts
  Source files: channels/src/components/mobile_channel_header/mobile_channel_header.tsx, channels/src/components/mobile_channel_header/index.ts
  Why: Shared component change; UI logic change
- [P1] Channel Header Title (channel_header_title)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/channel_header_title.spec.ts
  Source files: channels/src/components/channel_header/channel_header_title.tsx
  Why: Shared component change; UI logic change
- [P1] Channel Header Public Private Menu (channel_header_public_private_menu)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/channel_header_public_private_menu.spec.ts
  Source files: channels/src/components/channel_header_menu/channel_header_menu_items/channel_header_public_private_menu.tsx
  Why: Shared component change; UI logic change
- [P0] Multiselect List (multiselect_list)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/multiselect_list.spec.ts
  Source files: channels/src/components/multiselect/multiselect_list.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P0] Post View (post_view)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/post_view.spec.ts
  Source files: channels/src/components/post_view/post_view.tsx, channels/src/components/post_view/index.ts
  Why: Shared component change; UI logic change
- [P1] PropertyValueRenderer (propertyValueRenderer)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/propertyValueRenderer.spec.ts
  Source files: channels/src/components/properties_card_view/propertyValueRenderer/propertyValueRenderer.tsx
  Why: Shared component change; UI logic change
- [P0] Resizable Rhs (resizable_rhs)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/resizable_rhs.spec.ts
  Source files: channels/src/components/resizable_sidebar/resizable_rhs/index.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P1] Resizable Lhs (resizable_lhs)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/resizable_lhs.spec.ts
  Source files: channels/src/components/resizable_sidebar/resizable_lhs/index.tsx
  Why: Shared component change; UI logic change
- [P0] Root (root)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/root.spec.ts
  Source files: channels/src/components/root/root.tsx, channels/src/components/root/index.ts
  Why: Shared component change; UI logic change
- [P0] Sidebar Header (sidebar_header)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/sidebar_header.spec.ts
  Source files: channels/src/components/sidebar/sidebar_header/sidebar_header.tsx, channels/src/components/sidebar/sidebar_header/index.ts
  Why: Shared component change; UI logic change
- [P1] Command Provider (command_provider)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/command_provider.spec.ts
  Source files: channels/src/components/suggestion/command_provider/command_provider.tsx
  Why: Shared component change; UI logic change
- [P1] App Provider (app_provider)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/app_provider.spec.ts
  Source files: channels/src/components/suggestion/command_provider/app_provider.tsx
  Why: Shared component change; UI logic change
- [P1] App Command Parser (app_command_parser)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/app_command_parser.spec.ts
  Source files: channels/src/components/suggestion/command_provider/app_command_parser/app_command_parser.ts
  Why: Shared component change
- [P1] Attachments (attachments)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/attachments.spec.ts
  Source files: channels/src/components/threading/global_threads/thread_item/attachments/index.tsx
  Why: Shared component change; UI logic change
- [P1] Virtualized Thread List Row (virtualized_thread_list_row)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/virtualized_thread_list_row.spec.ts
  Source files: channels/src/components/threading/global_threads/thread_list/virtualized_thread_list_row.tsx
  Why: Shared component change; UI logic change
- [P0] Thread Viewer (thread_viewer)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/thread_viewer.spec.ts
  Source files: channels/src/components/threading/thread_viewer/thread_viewer.tsx, channels/src/components/threading/thread_viewer/index.ts
  Why: Shared component change; UI logic change
- [P1] Threads (threads)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/threads.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/actions/threads.ts, platform/types/src/threads.ts
  Why: State or data flow change
- [P1] Search (search)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/search.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/actions/search.ts
  Why: State or data flow change; Critical keyword: search
- [P1] Actions (actions)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/actions.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/actions/index.ts
  Why: State or data flow change
- [P1] Entities (entities)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/entities.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/reducers/entities/index.ts
  Why: State or data flow change
- [P1] ConfigureStore (configureStore)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/configureStore.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/store/configureStore.ts
  Why: State or data flow change
- [P1] Text Formatting (text_formatting)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/text_formatting.spec.ts
  Source files: channels/src/utils/text_formatting.tsx
  Why: UI logic change
- [P1] Syntax Highlighting (syntax_highlighting)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/syntax_highlighting.spec.ts
  Source files: channels/src/utils/syntax_highlighting.tsx
  Why: UI logic change
- [P1] Store (store)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/store.spec.ts
  Source files: platform/types/src/store.ts, channels/src/packages/mattermost-redux/src/store/index.ts
  Why: State or data flow change
- [P1] Admin (admin)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/admin.spec.ts
  Source files: platform/types/src/admin.ts
  Why: Critical keyword: admin
- [P0] Channel Bookmarks (channel_bookmarks)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/channel_bookmarks.spec.ts
  Source files: platform/types/src/channel_bookmarks.ts, channels/src/components/channel_bookmarks/channel_bookmarks.tsx, channels/src/components/channel_bookmarks/index.ts
  Why: Shared component change; UI logic change
- [P0] System Users Filter Team (system_users_filter_team)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/system_users_filter_team.spec.ts
  Source files: channels/src/components/admin_console/system_users/system_users_filters_popover/system_users_filter_team/index.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] System Users Filter Role (system_users_filter_role)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/system_users_filter_role.spec.ts
  Source files: channels/src/components/admin_console/system_users/system_users_filters_popover/system_users_filter_role/index.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] Styled Users Filters Status (styled_users_filters_status)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/styled_users_filters_status.spec.ts
  Source files: channels/src/components/admin_console/system_users/system_users_filters_popover/styled_users_filters_status/index.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] System Users Export (system_users_export)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/system_users_export.spec.ts
  Source files: channels/src/components/admin_console/system_users/system_users_export/index.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] LibreTranslate Settings (libreTranslate_settings)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/libreTranslate_settings.spec.ts
  Source files: channels/src/components/admin_console/localization/libreTranslate_settings.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] Agents Settings (agents_settings)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/agents_settings.spec.ts
  Source files: channels/src/components/admin_console/localization/agents_settings.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] Content Reviewers (content_reviewers)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/content_reviewers.spec.ts
  Source files: channels/src/components/admin_console/content_flagging/content_reviewers/content_reviewers.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P1] Dashboard (dashboard)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/dashboard.spec.ts
  Source files: channels/src/components/admin_console/workspace-optimization/dashboard.tsx
  Why: Shared component change; UI logic change; Critical keyword: admin
- [P1] Apps Form (apps_form)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/apps_form.spec.ts
  Source files: channels/src/components/apps_form/index.ts
  Why: Shared component change
- [P0] Mobile Sidebar Right (mobile_sidebar_right)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/mobile_sidebar_right.spec.ts
  Source files: channels/src/components/mobile_sidebar_right/mobile_sidebar_right.tsx, channels/src/components/mobile_sidebar_right/index.ts
  Why: Shared component change; UI logic change; Interactive element change
- [P1] Virtualized Thread List (virtualized_thread_list)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/virtualized_thread_list.spec.ts
  Source files: channels/src/components/threading/global_threads/thread_list/virtualized_thread_list.tsx
  Why: Shared component change; UI logic change
- [P0] Agents (agents)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/agents.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/reducers/entities/agents.ts, channels/src/packages/mattermost-redux/src/actions/agents.ts
  Why: State or data flow change
- [P1] Reducers (reducers)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/reducers.spec.ts
  Source files: channels/src/packages/mattermost-redux/src/reducers/index.ts
  Why: State or data flow change
- [P0] System Users Filters Popover (system_users_filters_popover)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/system_users_filters_popover.spec.ts
  Source files: channels/src/components/admin_console/system_users/system_users_filters_popover/index.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] User Multiselector (user_multiselector)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/user_multiselector.spec.ts
  Source files: channels/src/components/admin_console/content_flagging/user_multiselector/user_multiselector.tsx
  Why: Shared component change; UI logic change; Interactive element change; Critical keyword: admin
- [P0] Thread List (thread_list)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/thread_list.spec.ts
  Source files: channels/src/components/threading/global_threads/thread_list/thread_list.tsx
  Why: Shared component change; UI logic change; Interactive element change
- [P0] Global Threads (global_threads)
  Path: /Users/yasserkhan/Documents/mattermost/mattermost/e2e-tests/playwright/specs/global_threads.spec.ts
  Source files: channels/src/components/threading/global_threads/global_threads.tsx
  Why: Shared component change; UI logic change; Interactive element change