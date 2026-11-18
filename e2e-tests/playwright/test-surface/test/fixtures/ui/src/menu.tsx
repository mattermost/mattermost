import React, {useState} from 'react';
import {createPortal} from 'react-dom';

import {openModal} from './modals';

type MenuButton = {id: string; dataTestId?: string; children?: any};

declare function isMobileView(): boolean;

// in mobile view the menu opens as a modal, one for every menu: the menu's other form
export function MenuModal({children}: {children?: any}) {
    return createPortal(
        <div data-testid='menu_modal'>
            <ul data-testid='menu_modal.list'>{children}</ul>
        </div>, document.body,
    );
}

// trigger and menu are bound statically: menuButton + menu props together
export function Menu(props: {menuButton: MenuButton; menu: {id: string}; children?: any}) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                id={props.menuButton.id}
                data-testid={props.menuButton.dataTestId}
                aria-haspopup={true}
                onClick={() => (isMobileView() ? openModal({modalId: props.menu.id, dialogType: MenuModal}) : setOpen(true))}
            >
                {props.menuButton.children}
            </button>
            {open && <ul id={props.menu.id}>{props.children}</ul>}
        </>
    );
}

export const MenuItem = React.forwardRef((props: {onClick?: () => void; children?: any; 'data-testid'?: string; role?: string}) => {
    const {role = 'menuitem', ...rest} = props;
    return (
        <li
            role={role}
            {...rest}
        />
    );
});

// menu items held in variables, next to a bare-word container
export function AddMenu({canCreate}: {canCreate: boolean}) {
    let create = null;
    if (canCreate) {
        create = <MenuItem data-testid='add_menu.create--menuitem'/>;
    }
    const browse = <MenuItem data-testid='add_menu.browse--menuitem'/>;
    return (
        <Menu
            menuButton={{id: 'addButton', dataTestId: 'header.open_add_menu--button'}}
            menu={{id: 'addMenu'}}
        >
            {create}
            {browse}
            <div data-testid='add_menu_tour'/>
        </Menu>
    );
}

// menu items held in variables and picked by a condition in the children (`{isAdmin ? makeMember : null}`)
export function RoleMenu({isAdmin}: {isAdmin: boolean}) {
    const makeAdmin = <MenuItem data-testid='role_menu.make_admin--menuitem'/>;
    const makeMember = <MenuItem data-testid='role_menu.make_member--menuitem'/>;
    return (
        <Menu
            menuButton={{id: 'roleButton', dataTestId: 'header.open_role_menu--button'}}
            menu={{id: 'roleMenu'}}
        >
            {isAdmin ? makeMember : null}
            {!isAdmin && makeAdmin}
        </Menu>
    );
}

// styled-components: the element a styled tag renders decides its role
const styled = Object.assign(
    (_component: any) => (_css: TemplateStringsArray) => (_props: any) => null,
    {button: (_css: TemplateStringsArray) => (_props: any) => null, div: (_css: TemplateStringsArray) => (_props: any) => null},
);
const CloseButton = styled.button`color: red;`;

// `as` picks the element per usage: a Chip with onClick is a button
const ChipWrapper = styled.div`color: blue;`;
const Chip = React.forwardRef<HTMLElement, {onClick?: () => void; 'data-testid'?: string}>(({onClick, ...rest}, ref) => {
    const element = onClick ? 'button' : 'div';
    return (
        <ChipWrapper
            {...rest}
            ref={ref}
            as={element}
            onClick={onClick}
        />
    );
});
export function Chips({onPick}: {onPick: () => void}) {
    return (
        <>
            <Chip
                data-testid='header.pick--button'
                onClick={onPick}
            />
            <Chip data-testid='header.label'/>
        </>
    );
}
export function Closer({onClose}: {onClose: () => void}) {
    return (
        <CloseButton
            data-testid='header.close--button'
            onClick={onClose}
        />
    );
}

// menu items from a render helper in the same file
export function TeamPicker({teams}: {teams: string[]}) {
    const renderTeam = (name: string) => (
        <MenuItem
            key={name}
            data-testid={`team_picker.menu.team:${name}--menuitem`}
        />
    );
    return (
        <Menu
            menuButton={{id: 'pickTeam', dataTestId: 'team_picker.open_menu--button'}}
            menu={{id: 'teamPickerMenu'}}
        >
            {teams.map((t) => renderTeam(t))}
        </Menu>
    );
}

// menu items pushed onto an array (a flat child list)
export function SortMenu({fields}: {fields: string[]}) {
    const items: React.ReactNode[] = [];
    fields.forEach((f) => {
        items.push(
            <MenuItem
                key={f}
                data-testid={`sort_menu.field:${f}--menuitem`}
            />,
        );
    });
    return (
        <Menu
            menuButton={{id: 'sortButton', dataTestId: 'header.open_sort_menu--button'}}
            menu={{id: 'sortMenu'}}
        >
            {items}
        </Menu>
    );
}

// styled(StyledTag) renders the inner tag's element; styled(Component) renders the component with the usage's props
const BigCloseButton = styled(CloseButton)`font-size: 2em;`;
const NoteBase = ({className, testId}: {className?: string; testId?: string}) => (
    <div
        className={className}
        data-testid={testId}
    />
);
const Note = styled(NoteBase)`color: gray;`;
export function StyledWrappers({onClose}: {onClose: () => void}) {
    return (
        <>
            <BigCloseButton
                data-testid='header.big_close--button'
                onClick={onClose}
            />
            <Note testId='header.note'/>
        </>
    );
}

// one picker mounted at two scopes, each opening its own menu (`left.picker.menu`, `right.picker.menu`)
export function ScopedPicker({testIdScope, teams}: {testIdScope: string; teams: string[]}) {
    return (
        <Menu
            menuButton={{id: 'scopedPicker', dataTestId: `${testIdScope}.open_menu--button`}}
            menu={{id: 'scopedPickerMenu'}}
        >
            {teams.map((t) => (
                <MenuItem
                    key={t}
                    data-testid={`${testIdScope}.menu.team:${t}--menuitem`}
                />
            ))}
        </Menu>
    );
}

export function PickerHosts({teams}: {teams: string[]}) {
    return (
        <div>
            <ScopedPicker
                testIdScope='left.picker'
                teams={teams}
            />
            <ScopedPicker
                testIdScope='right.picker'
                teams={teams}
            />
        </div>
    );
}

// one trigger testid on two menus whose ids aren't literals (both labelled `menu`): each keeps its own scope
export function TwinMenus({menuId, compact}: {menuId: string; compact: boolean}) {
    if (compact) {
        return (
            <Menu
                menuButton={{id: 'twinCompact', dataTestId: 'twin.edit--button'}}
                menu={{id: menuId}}
            >
                <MenuItem data-testid='twin.compact_menu.one--menuitem'/>
            </Menu>
        );
    }
    return (
        <Menu
            menuButton={{id: 'twinFull', dataTestId: 'twin.edit--button'}}
            menu={{id: menuId}}
        >
            <MenuItem data-testid='twin.full_menu.two--menuitem'/>
        </Menu>
    );
}

// menu items from a render helper passed to map by reference
export function FieldMenu({fields}: {fields: Array<{id: string}>}) {
    const renderField = (field: {id: string}) => (
        <MenuItem
            key={field.id}
            data-testid={`field_menu.field:${field.id}--menuitem`}
        />
    );
    return (
        <Menu
            menuButton={{id: 'fieldButton', dataTestId: 'header.open_field_menu--button'}}
            menu={{id: 'fieldMenu'}}
        >
            {fields.map(renderField)}
        </Menu>
    );
}

// one actions menu mounted with different actions: its action key is either mount's, and its own button opens it
function ActionsList({testIdScope, actions}: {testIdScope: string; actions: Array<{id: string}>}) {
    return (
        <Menu
            menuButton={{id: 'actionsButton', dataTestId: `${testIdScope}.open--button`}}
            menu={{id: 'actionsMenu'}}
        >
            {actions.map((action) => (
                <MenuItem
                    key={action.id}
                    data-testid={`${testIdScope}.action:${action.id}--menuitem`}
                />
            ))}
        </Menu>
    );
}

export function ActionHosts() {
    const leftActions = [{id: 'archive'}, {id: 'mute'}];
    const rightActions = [{id: 'pin'}];
    return (
        <div>
            <ActionsList
                testIdScope='left.actions'
                actions={leftActions}
            />
            <ActionsList
                testIdScope='right.actions'
                actions={rightActions}
            />
        </div>
    );
}
