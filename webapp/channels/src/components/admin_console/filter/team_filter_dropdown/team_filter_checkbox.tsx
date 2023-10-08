import React, { useState, useCallback } from 'react';

type Props = {
    id: string;
    name: string;
    checked: boolean;
    label: string;
    updateOption: (checked: boolean, name: string) => void;
};

const TeamFilterCheckbox: React.FC<Props> = ({
    id,
    name,
    checked,
    label,
    updateOption,
}) => {
    const [isChecked, setIsChecked] = useState(checked);

    // Use useCallback to memoize the callback
    const toggleOption = useCallback(() => {
        const newChecked = !isChecked;
        setIsChecked(newChecked);
        updateOption(newChecked, id);
    }, [isChecked, id, updateOption]);

    return (
        <div className='TeamFilterDropdown_checkbox'>
            <label>
                <input
                    type='checkbox'
                    id={id}
                    name={name}
                    checked={isChecked}
                    onChange={toggleOption}
                />

                {label}
            </label>
        </div>
    );
};

export default TeamFilterCheckbox;
