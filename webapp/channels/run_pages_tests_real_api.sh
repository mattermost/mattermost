#!/bin/bash

# Run pages tests with real API (unset LDAP env vars)
unset MM_ADMIN_USERNAME
unset MM_ADMIN_PASSWORD

echo "Running pages tests with real API..."
echo "Using sysadmin account (not LDAP)"
npm run test -- \
  src/components/wiki_view/hooks.test.ts \
  src/components/wiki_view/page_anchor.test.ts \
  src/components/wiki_view/wiki_view.test.tsx \
  src/components/wiki_view/page_breadcrumb/page_breadcrumb.test.tsx \
  src/components/wiki_view/wiki_page_header/wiki_page_header.test.tsx \
  src/components/wiki_view/wiki_page_header/translation_indicator.test.tsx \
  src/components/wiki_view/wiki_page_editor/tiptap_editor.test.tsx \
  src/components/wiki_view/wiki_page_editor/wiki_page_editor.test.tsx \
  src/components/wiki_view/wiki_page_editor/use_page_rewrite.test.tsx \
  src/components/wiki_view/wiki_page_editor/channel_mention_mm_bridge.test.tsx \
  src/components/wiki_view/wiki_page_editor/comment_anchor_mark.test.ts \
  src/components/wiki_view/wiki_page_editor/callout_extension.test.ts \
  src/components/wiki_view/wiki_page_editor/video_extension.test.ts \
  src/components/wiki_view/wiki_page_editor/formatting_actions.test.ts \
  src/components/wiki_view/wiki_page_editor/file_upload_helper.test.ts \
  src/components/wiki_view/wiki_page_editor/file_attachment_extension.test.ts \
  src/components/wiki_view/wiki_page_editor/file_attachment_node_view.test.tsx \
  src/components/wiki_view/wiki_page_editor/ai/proofread_action.test.ts \
  src/components/wiki_view/wiki_page_editor/ai/image_ai_bubble.test.tsx \
  src/components/wiki_view/wiki_page_editor/ai/use_image_ai.test.tsx \
  src/components/wiki_view/wiki_page_editor/ai/use_page_proofread.test.tsx \
  src/components/wiki_view/wiki_page_editor/ai/use_page_translate.test.tsx \
  src/components/wiki_view/wiki_page_editor/ai/ai_tools_dropdown.test.tsx \
  src/components/wiki_view/wiki_page_editor/ai/translate_page_modal.test.tsx \
  src/components/wiki_view/wiki_page_editor/ai/image_extraction_dialog.test.tsx \
  src/components/wiki_view/wiki_page_editor/ai/image_extraction_complete_dialog.test.tsx \
  src/components/wiki_view/wiki_page_editor/ai_utils/content_validator.test.ts \
  src/components/wiki_view/wiki_page_editor/ai_utils/tiptap_reassembler.test.ts \
  src/components/wiki_view/wiki_page_editor/ai_utils/tiptap_text_extractor.test.ts
