// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    name: string;
    checked: boolean;
    label: string | JSX.Element;
    updateOption: (checked: boolean, name: string) => void;
};

class FilterCheckbox extends React.PureComponent<Props> {
    toggleOption = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const {checked, name, updateOption} = this.props;
        updateOption(!checked, name);
    }

    render() {
        const {name, checked, label} = this.props;
        return (
            <div
                className='FilterList_checkbox'
                onClick={this.toggleOption}
            >
                <label>
                    {checked &&
                        <input
                            type='checkbox'
                            id={name}
                            name={name}
                            defaultChecked={true}
                        />
                    }

                    {!checked &&
                        <input
                            type='checkbox'
                            id={name}
                            name={name}
                            defaultChecked={false}
                        />
                    }
                    {label}
                </label>
            </div>
        );
    }
}

export default FilterCheckbox;
