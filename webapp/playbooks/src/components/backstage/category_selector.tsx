import React from 'react';
import {SelectComponentsConfig, components as defaultComponents} from 'react-select';
import {useSelector} from 'react-redux';
import {makeGetCategoriesForTeam} from 'mattermost-redux/selectors/entities/channel_categories';

import {ChannelCategory} from '@mattermost/types/channel_categories';
import {GlobalState} from '@mattermost/types/store';

import {StyledCreatable} from './styles';

export interface Props {
    id?: string;
    onCategorySelected: (categoryName: string) => void;
    categoryName?: string;
    isClearable?: boolean;
    selectComponents?: SelectComponentsConfig<ChannelCategory, false>;
    isDisabled: boolean;
    captureMenuScroll: boolean;
    shouldRenderValue: boolean;
    placeholder: string;
    menuPlacement?: string;
}

const getCategoriesForTeam = makeGetCategoriesForTeam();
const getMyCategories = (state: GlobalState) => getCategoriesForTeam(state, state.entities.teams.currentTeamId);

const CategorySelector = (props: Props & { className?: string }) => {
    const selectableCategories = useSelector(getMyCategories);

    const options = React.useMemo(() => {
        return selectableCategories
            .filter((category) => category.type !== 'direct_messages' && category.type !== 'channels')
            .map((category) => ({value: category.display_name, label: category.display_name}));
    }, [selectableCategories]);

    const onChange = (option: {label: string; value: string}, {action}: {action: string}) => {
        if (action === 'clear') {
            props.onCategorySelected('');
        } else {
            props.onCategorySelected(option.value);
        }
    };

    const components = props.selectComponents || defaultComponents;

    return (
        <StyledCreatable
            className={props.className}
            id={props.id}
            controlShouldRenderValue={props.shouldRenderValue}
            options={options}
            onChange={onChange}
            defaultMenuIsOpen={false}
            openMenuOnClick={true}
            isClearable={props.isClearable}
            value={props.categoryName && {value: props.categoryName, label: props.categoryName}}
            placeholder={props.placeholder}
            classNamePrefix='channel-selector'
            components={components}
            isDisabled={props.isDisabled}
            captureMenuScroll={props.captureMenuScroll}
            menuPlacement={props.menuPlacement ?? 'auto'}
            menuShouldScrollIntoView={false}
        />
    );
};

export default CategorySelector;
