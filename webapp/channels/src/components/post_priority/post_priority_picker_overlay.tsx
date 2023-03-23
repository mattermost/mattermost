// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {Overlay} from 'react-bootstrap';
import memoize from 'memoize-one';

import {PostPriorityMetadata} from '@mattermost/types/posts';

import PostPriorityPicker from './post_priority_picker';

type Props = {
    show: boolean;
    settings?: PostPriorityMetadata;
    target: () => React.RefObject<HTMLButtonElement> | React.ReactInstance | null;
    onApply: (props: PostPriorityMetadata) => void;
    onHide: () => void;
    defaultHorizontalPosition: 'left'|'right';
};

function PostPriorityPickerOverlay({
    show,
    settings,
    target,
    onApply,
    onHide,
}: Props) {
    const pickerPosition = memoize((trigger, show) => {
        if (show && trigger) {
            return trigger.getBoundingClientRect().left;
        }
        return 0;
    });
    const offset = pickerPosition(target(), show);

    return (
        <Overlay
            show={show}
            placement={'top'}
            rootClose={true}
            onHide={onHide}
            target={target}
            animation={false}
        >
            <PostPriorityPicker
                settings={settings}
                leftOffset={offset}
                onApply={onApply}
                topOffset={-7}
                placement={'top'}
                onClose={onHide}
            />
        </Overlay>
    );
}

export default memo(PostPriorityPickerOverlay);
