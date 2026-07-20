// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {CloseIcon} from '@mattermost/compass-icons/components';

import './unified_labels_wrapper.scss';

type Props = {
    priorityLabels?: JSX.Element;
    burnOnReadLabels?: JSX.Element;
    onRemoveAll?: () => void;
    canRemove: boolean;
};

const UnifiedLabelsWrapper = ({
    priorityLabels,
    burnOnReadLabels,
    onRemoveAll,
    canRemove,
}: Props) => {
    const {formatMessage} = useIntl();

    // Handle click and prevent form submission
    const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        onRemoveAll?.();
    }, [onRemoveAll]);

    // Don't render if no labels
    if (!priorityLabels && !burnOnReadLabels) {
        return null;
    }

    return (
        <div className='UnifiedLabelsWrapper'>
            {priorityLabels}
            {burnOnReadLabels}
            {canRemove && onRemoveAll && (
                <button
                    type='button'
                    className='UnifiedLabelsWrapper__close'
                    onClick={handleClick}
                    aria-label={formatMessage({
                        id: 'unified_labels.remove_all',
                        defaultMessage: 'Remove all labels',
                    })}
                >
                    <CloseIcon size={14}/>
                </button>
            )}
        </div>
    );
};

export default UnifiedLabelsWrapper;
