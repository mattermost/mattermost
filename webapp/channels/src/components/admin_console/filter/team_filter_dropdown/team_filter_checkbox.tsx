import React, { useCallback } from 'react';

type Props = {
    id: string;
    name: string;
    checked: boolean;
    label: string;
    updateOption: (checked: boolean, name: string) => void;
};

const TeamFilterCheckbox = ({
    id,
    name,
    checked,
    label,
    updateOption,
}: React.FC<Props>) => {
    // Use useCallback to memoize the callback
    const toggleOption = useCallback(() => {
        updateOption(!checked, id);
    }, [checked, id, updateOption]);

    return (
        <div className='TeamFilterDropdown_checkbox'>
            <label>
                <input
                    type='checkbox'
                    id={id}
                    name={name}
                    checked={checked}
                    onChange={toggleOption}
                />

                {label}
            </label>
        </div>
    );
};

export default React.memo(TeamFilterCheckbox);
