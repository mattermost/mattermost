#!/bin/bash

# Run pages tests with real API (unset LDAP env vars)
unset MM_ADMIN_USERNAME
unset MM_ADMIN_PASSWORD

echo "Running pages tests with real API..."
echo "Using sysadmin account (not LDAP)"
npm run test -- src/actions/pages.test.ts src/components/wiki_view/wiki_page_editor/page_link_modal.test.tsx src/components/wiki_view/wiki_page_editor/tiptap_editor.test.tsx
