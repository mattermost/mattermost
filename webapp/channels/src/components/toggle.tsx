// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

type Props = {
    onToggle: () => void;
    toggled?: boolean;
    disabled?: boolean;
    onText?: React.ReactNode;
    offText?: React.ReactNode;
    id?: string;
    overrideTestId?: boolean;
    size?: 'btn-lg' | 'btn-sm';
    toggleClassName?: string;
}

const Toggle: React.FC<Props> = (props: Props) => {
    const {
        onToggle,
        toggled,
        disabled,
        onText,
        offText,
        id,
        overrideTestId,
        size = 'btn-lg',
        toggleClassName = 'btn-toggle',
    } = props;
    let dataTestId = `${id}-button`;
    if (overrideTestId) {
        dataTestId = id || '';
    }

    const className = classNames(
        'btn',
        size,
        toggleClassName,
        {
            active: toggled,
            disabled,
        },
    );

    return (
        <button
            data-testid={dataTestId}
            id={id}
            type='button'
            onClick={onToggle}
            className={className}
            aria-pressed={toggled ? 'true' : 'false'}
            disabled={disabled}
        >
            <div className='handle'/>
            {text(toggled, onText, offText)}
        </button>
    );
};

function text(toggled?: boolean, onText?: React.ReactNode, offText?: React.ReactNode): React.ReactNode | null {
    if ((toggled && !onText) || (!toggled && !offText)) {
        return null;
    }
    return (<div className={`bg-text ${toggled ? 'on' : 'off'}`}>{toggled ? onText : offText}</div>);
}

export default Toggle;
