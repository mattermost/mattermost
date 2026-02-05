# 06 - Modal Popouts

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert Channel Info, Pinned Posts, Channel Files, Search Results, and Post Edit History from RHS views to modal popouts.

**Architecture:** Generic `ModalPopout` wrapper component provides consistent modal styling. Each view gets a dedicated modal component that wraps existing content. Modal state managed in Redux with `activeModal` and `modalData`. Triggered from channel header buttons.

**Tech Stack:** React, Redux, TypeScript, SCSS

**Depends on:** 01-feature-flag-and-infrastructure.md

---

## Task 1: Create ModalPopout Wrapper Component

**Files:**
- Create: `webapp/channels/src/components/modal_popout/index.tsx`
- Create: `webapp/channels/src/components/modal_popout/modal_popout.scss`

**Step 1: Create the modal wrapper**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import {useIntl} from 'react-intl';

import './modal_popout.scss';

interface Props {
    title: string;
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    width?: 'small' | 'medium' | 'large';
    showCloseButton?: boolean;
}

export default function ModalPopout({
    title,
    isOpen,
    onClose,
    children,
    width = 'medium',
    showCloseButton = true,
}: Props) {
    const {formatMessage} = useIntl();
    const modalRef = useRef<HTMLDivElement>(null);

    // Handle escape key
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Handle click outside
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) {
        return null;
    }

    const modal = (
        <div
            className='modal-popout__backdrop'
            onClick={handleBackdropClick}
            role='dialog'
            aria-modal='true'
            aria-labelledby='modal-popout-title'
        >
            <div
                ref={modalRef}
                className={`modal-popout modal-popout--${width}`}
            >
                <div className='modal-popout__header'>
                    <h2 id='modal-popout-title' className='modal-popout__title'>
                        {title}
                    </h2>
                    {showCloseButton && (
                        <button
                            className='modal-popout__close'
                            onClick={onClose}
                            aria-label={formatMessage({id: 'modal_popout.close', defaultMessage: 'Close'})}
                        >
                            <i className='icon icon-close' />
                        </button>
                    )}
                </div>
                <div className='modal-popout__content'>
                    {children}
                </div>
            </div>
        </div>
    );

    return createPortal(modal, document.body);
}
```

**Step 2: Create styles**

```scss
// modal_popout.scss

.modal-popout {
    &__backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        animation: modal-fade-in 0.15s ease;
    }

    display: flex;
    flex-direction: column;
    max-height: 80vh;
    background-color: var(--center-channel-bg);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    animation: modal-slide-in 0.15s ease;

    &--small {
        width: 400px;
    }

    &--medium {
        width: 560px;
    }

    &--large {
        width: 720px;
    }

    &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    }

    &__title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: var(--center-channel-color);
    }

    &__close {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: rgba(var(--center-channel-color-rgb), 0.56);
        cursor: pointer;
        transition: background-color 0.1s ease, color 0.1s ease;

        &:hover {
            background-color: rgba(var(--center-channel-color-rgb), 0.08);
            color: var(--center-channel-color);
        }

        .icon {
            font-size: 20px;
        }
    }

    &__content {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 20px;
    }
}

@keyframes modal-fade-in {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

@keyframes modal-slide-in {
    from {
        opacity: 0;
        transform: translateY(-20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/modal_popout/
git commit -m "feat: create ModalPopout wrapper component"
```

---

## Task 2: Create ChannelInfoModal Component

**Files:**
- Create: `webapp/channels/src/components/channel_info_modal/index.tsx`
- Create: `webapp/channels/src/components/channel_info_modal/channel_info_modal.scss`

**Step 1: Create the channel info modal**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {closeGuildedModal} from 'actions/views/guilded_layout';
import ModalPopout from 'components/modal_popout';
import ChannelInfoRhs from 'components/channel_info_rhs';

import type {GlobalState} from 'types/store';

import './channel_info_modal.scss';

export default function ChannelInfoModal() {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const channel = useSelector(getCurrentChannel);
    const activeModal = useSelector((state: GlobalState) => state.views.guildedLayout.activeModal);

    const isOpen = activeModal === 'info';

    const handleClose = () => {
        dispatch(closeGuildedModal());
    };

    if (!channel) {
        return null;
    }

    return (
        <ModalPopout
            title={formatMessage({id: 'channel_info_modal.title', defaultMessage: 'Channel Info'})}
            isOpen={isOpen}
            onClose={handleClose}
            width='medium'
        >
            <div className='channel-info-modal'>
                <ChannelInfoRhs isModal={true} />
            </div>
        </ModalPopout>
    );
}
```

**Step 2: Create styles**

```scss
// channel_info_modal.scss

.channel-info-modal {
    // Override RHS-specific styling for modal context
    .channel-info-rhs {
        padding: 0;
        background: transparent;

        .channel-info-rhs__header {
            display: none; // We use modal header instead
        }
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/channel_info_modal/
git commit -m "feat: create ChannelInfoModal component"
```

---

## Task 3: Create PinnedPostsModal Component

**Files:**
- Create: `webapp/channels/src/components/pinned_posts_modal/index.tsx`
- Create: `webapp/channels/src/components/pinned_posts_modal/pinned_posts_modal.scss`

**Step 1: Create the pinned posts modal**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getPinnedPosts} from 'mattermost-redux/actions/channels';

import {closeGuildedModal} from 'actions/views/guilded_layout';
import ModalPopout from 'components/modal_popout';
import PinnedPostsRhs from 'components/rhs_search/rhs_search_results';

import type {GlobalState} from 'types/store';

import './pinned_posts_modal.scss';

export default function PinnedPostsModal() {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const channel = useSelector(getCurrentChannel);
    const activeModal = useSelector((state: GlobalState) => state.views.guildedLayout.activeModal);

    const isOpen = activeModal === 'pins';

    useEffect(() => {
        if (isOpen && channel) {
            dispatch(getPinnedPosts(channel.id) as any);
        }
    }, [isOpen, channel?.id, dispatch]);

    const handleClose = () => {
        dispatch(closeGuildedModal());
    };

    if (!channel) {
        return null;
    }

    return (
        <ModalPopout
            title={formatMessage({id: 'pinned_posts_modal.title', defaultMessage: 'Pinned Posts'})}
            isOpen={isOpen}
            onClose={handleClose}
            width='large'
        >
            <div className='pinned-posts-modal'>
                {/* Reuse existing pinned posts display logic */}
                <PinnedPostsSearchResults channelId={channel.id} isModal={true} />
            </div>
        </ModalPopout>
    );
}

// Simplified pinned posts display
function PinnedPostsSearchResults({channelId, isModal}: {channelId: string; isModal: boolean}) {
    const pinnedPosts = useSelector((state: GlobalState) => {
        // Get pinned posts from state
        return state.entities.posts.pinnedPosts?.[channelId] || [];
    });

    if (pinnedPosts.length === 0) {
        return (
            <div className='pinned-posts-modal__empty'>
                <i className='icon icon-pin-outline' />
                <span>No pinned posts yet</span>
            </div>
        );
    }

    return (
        <div className='pinned-posts-modal__list'>
            {/* Render pinned posts - will need to integrate with existing post rendering */}
            <p>Pinned posts will be rendered here</p>
        </div>
    );
}
```

**Step 2: Create styles**

```scss
// pinned_posts_modal.scss

.pinned-posts-modal {
    min-height: 300px;

    &__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 48px;
        color: rgba(var(--center-channel-color-rgb), 0.56);

        .icon {
            font-size: 48px;
        }
    }

    &__list {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/pinned_posts_modal/
git commit -m "feat: create PinnedPostsModal component"
```

---

## Task 4: Create ChannelFilesModal Component

**Files:**
- Create: `webapp/channels/src/components/channel_files_modal/index.tsx`
- Create: `webapp/channels/src/components/channel_files_modal/channel_files_modal.scss`

**Step 1: Create the channel files modal**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {closeGuildedModal} from 'actions/views/guilded_layout';
import ModalPopout from 'components/modal_popout';

import type {GlobalState} from 'types/store';

import './channel_files_modal.scss';

export default function ChannelFilesModal() {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const channel = useSelector(getCurrentChannel);
    const activeModal = useSelector((state: GlobalState) => state.views.guildedLayout.activeModal);

    const isOpen = activeModal === 'files';

    const handleClose = () => {
        dispatch(closeGuildedModal());
    };

    if (!channel) {
        return null;
    }

    return (
        <ModalPopout
            title={formatMessage({id: 'channel_files_modal.title', defaultMessage: 'Files'})}
            isOpen={isOpen}
            onClose={handleClose}
            width='large'
        >
            <div className='channel-files-modal'>
                {/* Reuse existing channel files component or create new one */}
                <ChannelFilesContent channelId={channel.id} />
            </div>
        </ModalPopout>
    );
}

function ChannelFilesContent({channelId}: {channelId: string}) {
    // This would integrate with the existing file search/display logic
    return (
        <div className='channel-files-modal__content'>
            <div className='channel-files-modal__empty'>
                <i className='icon icon-file-multiple-outline' />
                <span>No files shared yet</span>
            </div>
        </div>
    );
}
```

**Step 2: Create styles**

```scss
// channel_files_modal.scss

.channel-files-modal {
    min-height: 300px;

    &__content {
        // File grid or list
    }

    &__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 48px;
        color: rgba(var(--center-channel-color-rgb), 0.56);

        .icon {
            font-size: 48px;
        }
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/channel_files_modal/
git commit -m "feat: create ChannelFilesModal component"
```

---

## Task 5: Create SearchResultsModal Component

**Files:**
- Create: `webapp/channels/src/components/search_results_modal/index.tsx`
- Create: `webapp/channels/src/components/search_results_modal/search_results_modal.scss`

**Step 1: Create the search results modal**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';

import {closeGuildedModal} from 'actions/views/guilded_layout';
import ModalPopout from 'components/modal_popout';
import SearchResults from 'components/search_results';

import type {GlobalState} from 'types/store';

import './search_results_modal.scss';

export default function SearchResultsModal() {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const activeModal = useSelector((state: GlobalState) => state.views.guildedLayout.activeModal);
    const searchTerms = useSelector((state: GlobalState) => state.views.guildedLayout.modalData.searchTerms as string);

    const isOpen = activeModal === 'search';

    const handleClose = () => {
        dispatch(closeGuildedModal());
    };

    const title = searchTerms
        ? formatMessage({id: 'search_results_modal.title_with_terms', defaultMessage: 'Search: {terms}'}, {terms: searchTerms})
        : formatMessage({id: 'search_results_modal.title', defaultMessage: 'Search Results'});

    return (
        <ModalPopout
            title={title}
            isOpen={isOpen}
            onClose={handleClose}
            width='large'
        >
            <div className='search-results-modal'>
                <SearchResults isModal={true} />
            </div>
        </ModalPopout>
    );
}
```

**Step 2: Create styles**

```scss
// search_results_modal.scss

.search-results-modal {
    min-height: 400px;
    max-height: 60vh;
    overflow-y: auto;

    // Override search results styling for modal context
    .search-results {
        padding: 0;
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/search_results_modal/
git commit -m "feat: create SearchResultsModal component"
```

---

## Task 6: Create PostEditHistoryModal Component

**Files:**
- Create: `webapp/channels/src/components/post_edit_history_modal/index.tsx`
- Create: `webapp/channels/src/components/post_edit_history_modal/post_edit_history_modal.scss`

**Step 1: Create the post edit history modal**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';

import {closeGuildedModal} from 'actions/views/guilded_layout';
import ModalPopout from 'components/modal_popout';
import PostEditHistory from 'components/post_edit_history';

import type {GlobalState} from 'types/store';

import './post_edit_history_modal.scss';

export default function PostEditHistoryModal() {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const activeModal = useSelector((state: GlobalState) => state.views.guildedLayout.activeModal);
    const postId = useSelector((state: GlobalState) => state.views.guildedLayout.modalData.postId as string);

    const isOpen = activeModal === 'edit_history';

    const handleClose = () => {
        dispatch(closeGuildedModal());
    };

    return (
        <ModalPopout
            title={formatMessage({id: 'post_edit_history_modal.title', defaultMessage: 'Edit History'})}
            isOpen={isOpen}
            onClose={handleClose}
            width='medium'
        >
            <div className='post-edit-history-modal'>
                {postId && <PostEditHistory postId={postId} isModal={true} />}
            </div>
        </ModalPopout>
    );
}
```

**Step 2: Create styles**

```scss
// post_edit_history_modal.scss

.post-edit-history-modal {
    min-height: 200px;

    // Override edit history styling for modal context
    .post-edit-history {
        padding: 0;
    }
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/post_edit_history_modal/
git commit -m "feat: create PostEditHistoryModal component"
```

---

## Task 7: Create GuildedModalsContainer

**Files:**
- Create: `webapp/channels/src/components/guilded_modals_container/index.tsx`

**Step 1: Create container that renders all modals**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {useGuildedLayout} from 'hooks/use_guilded_layout';

import ChannelInfoModal from 'components/channel_info_modal';
import PinnedPostsModal from 'components/pinned_posts_modal';
import ChannelFilesModal from 'components/channel_files_modal';
import SearchResultsModal from 'components/search_results_modal';
import PostEditHistoryModal from 'components/post_edit_history_modal';

export default function GuildedModalsContainer() {
    const isGuildedLayout = useGuildedLayout();

    if (!isGuildedLayout) {
        return null;
    }

    return (
        <>
            <ChannelInfoModal />
            <PinnedPostsModal />
            <ChannelFilesModal />
            <SearchResultsModal />
            <PostEditHistoryModal />
        </>
    );
}
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/guilded_modals_container/
git commit -m "feat: create GuildedModalsContainer"
```

---

## Task 8: Update Channel Header Buttons

**Files:**
- Modify: `webapp/channels/src/components/channel_header/channel_header.tsx` (or related)

**Step 1: Update header buttons to open modals in Guilded mode**

```typescript
import {useGuildedLayout} from 'hooks/use_guilded_layout';
import {openGuildedModal} from 'actions/views/guilded_layout';

// In the component:
const isGuildedLayout = useGuildedLayout();
const dispatch = useDispatch();

// For Info button:
const handleInfoClick = () => {
    if (isGuildedLayout) {
        dispatch(openGuildedModal('info'));
    } else {
        // Existing RHS behavior
        dispatch(showChannelInfo());
    }
};

// For Pinned Posts button:
const handlePinnedClick = () => {
    if (isGuildedLayout) {
        dispatch(openGuildedModal('pins'));
    } else {
        // Existing RHS behavior
        dispatch(showPinnedPosts());
    }
};

// For Files button:
const handleFilesClick = () => {
    if (isGuildedLayout) {
        dispatch(openGuildedModal('files'));
    } else {
        // Existing RHS behavior
        dispatch(showChannelFiles());
    }
};
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/channel_header/
git commit -m "feat: update channel header to use modals in Guilded layout"
```

---

## Task 9: Update Search to Use Modal

**Files:**
- Modify: `webapp/channels/src/components/search_bar/search_bar.tsx` (or related)

**Step 1: Open search results as modal in Guilded mode**

```typescript
import {useGuildedLayout} from 'hooks/use_guilded_layout';
import {openGuildedModal} from 'actions/views/guilded_layout';

// When search is submitted:
const handleSearch = (searchTerms: string) => {
    if (isGuildedLayout) {
        dispatch(openGuildedModal('search', {searchTerms}));
    } else {
        // Existing RHS behavior
        dispatch(showSearchResults(searchTerms));
    }
};
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/search_bar/
git commit -m "feat: open search results as modal in Guilded layout"
```

---

## Task 10: Integrate GuildedModalsContainer into App

**Files:**
- Modify: `webapp/channels/src/components/root/root.tsx` (or main app component)

**Step 1: Add GuildedModalsContainer to render tree**

```typescript
import GuildedModalsContainer from 'components/guilded_modals_container';

// In render, add near other modal containers:
<GuildedModalsContainer />
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/root/root.tsx
git commit -m "feat: integrate GuildedModalsContainer into app"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | modal_popout/ | Generic modal wrapper component |
| 2 | channel_info_modal/ | Channel info as modal |
| 3 | pinned_posts_modal/ | Pinned posts as modal |
| 4 | channel_files_modal/ | Files as modal |
| 5 | search_results_modal/ | Search results as modal |
| 6 | post_edit_history_modal/ | Edit history as modal |
| 7 | guilded_modals_container/ | Container for all modals |
| 8 | channel_header.tsx | Update header buttons |
| 9 | search_bar.tsx | Update search to use modal |
| 10 | root.tsx | Integrate modals into app |

**Next:** [07-sidebar-resize-refactor.md](./07-sidebar-resize-refactor.md)
