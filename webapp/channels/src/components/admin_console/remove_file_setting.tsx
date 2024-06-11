// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback, useState} from 'react';
import type {FC, MouseEvent} from 'react';

import Setting from './setting';
import type {Props as SettingsProps} from './setting';

type Props = SettingsProps & {
    id: string;
    label: React.ReactNode;
    helpText?: React.ReactNode;
    removeButtonText: React.ReactNode;
    removingText?: React.ReactNode;
    fileName: string;
    onSubmit: (arg0: string, arg1: () => void) => void;
    disabled?: boolean;
}

const RemoveFileSetting: FC<Props> = ({
    id,
    label,
    helpText,
    removeButtonText,
    removingText,
    fileName,
    onSubmit,
    disabled,
}) => {
    const [removing, setRemoving] = useState(false);

    const handleRemove = useCallback((e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();

        setRemoving(true);
        onSubmit(id, () => {
            setRemoving(false);
        });
    }, [id, onSubmit]);

    return (
        <Setting
            label={label}
            helpText={helpText}
            inputId={id}
        >
            <div>
                <div className='help-text remove-filename'>
                    {fileName}
                </div>
                <button
                    type='button'
                    className='btn btn-danger'
                    onClick={handleRemove}
                    disabled={disabled}
                >
                    {removing && (
                        <>
                            <span className='glyphicon glyphicon-refresh glyphicon-refresh-animate'/>
                            {removingText}
                        </>)}
                    {!removing && removeButtonText}
                </button>
            </div>
        </Setting>
    );
};

export default memo(RemoveFileSetting);
