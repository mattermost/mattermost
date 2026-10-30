// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

// Compass SectionNotice only offers primary and secondary action slots, so notices
// that need a tertiary action render their own row inside the description.
const SectionNoticeActions = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--spacing-s);
    padding: var(--spacing-xxs) 0;
    margin-top: var(--spacing-xs);
`;

export default SectionNoticeActions;
