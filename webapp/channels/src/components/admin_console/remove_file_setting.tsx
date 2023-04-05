// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import Setting from './setting';

type Props = {
    id: string;
    label: React.ReactNode;
    helpText?: React.ReactNode;
    removeButtonText: React.ReactNode;
    removingText?: React.ReactNode;
    fileName: string;
    onSubmit: (id: string, callback: () => void) => void;
    disabled?: boolean;
};

const RemoveFileSetting = ({
    id,
    label,
    helpText,
    removeButtonText,
    removingText,
    fileName,
    onSubmit,
    disabled,
}: Props) => {
    const [removing, setRemoving] = useState(false);

    const handleRemove = (e: React.MouseEvent<HTMLButtonElement, globalThis.MouseEvent>) => {
        e.preventDefault();

        setRemoving(true);
        onSubmit(id, () => {
            setRemoving(false);
        });
    };

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
                    onClick={handleRemove}// ref={this.removeButtonRef}
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

export default RemoveFileSetting;
