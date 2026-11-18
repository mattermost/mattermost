import React, {useState} from 'react';

// the forms a Menu component can build its trigger's testid in: each links the trigger to the menu it opens

type TestIdRole = 'button' | 'menuitem';

// as `@mattermost/shared/utils/test_id` writes it: the scanner reads the body like any other helper's
function withRole(testId: string | undefined, role: TestIdRole): string | undefined {
    return testId ? `${testId}--${role}` : undefined;
}

export function MenuItem(props: {'data-testid'?: string}) {
    return (
        <li
            role='menuitem'
            {...props}
        />
    );
}

// today's form: the caller passes the whole testid
export function DataMenu(props: {menuButton: {id: string; dataTestId?: string}; menu: {id: string}; children?: any}) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                id={props.menuButton.id}
                data-testid={props.menuButton.dataTestId}
                onClick={() => setOpen(true)}
            />
            {open && <ul id={props.menu.id}>{props.children}</ul>}
        </>
    );
}

// the caller passes a path and the menu adds the role
export function RoleMenu(props: {menuButton: {id: string; testId?: string}; menu: {id: string}; children?: any}) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button
                id={props.menuButton.id}
                data-testid={withRole(props.menuButton.testId, 'button')}
                onClick={() => setOpen(true)}
            />
            {open && <ul id={props.menu.id}>{props.children}</ul>}
        </>
    );
}

// both, through a local value (a menu moving from one to the other), destructured
export function MixedMenu({menuButton, menu, children}: {menuButton: {id: string; testId?: string; dataTestId?: string}; menu: {id: string}; children?: any}) {
    const [open, setOpen] = useState(false);
    const triggerTestId = menuButton.testId ? `${menuButton.testId}--button` : menuButton.dataTestId;
    return (
        <>
            <button
                id={menuButton.id}
                data-testid={triggerTestId}
                onClick={() => setOpen(true)}
            />
            {open && <ul id={menu.id}>{children}</ul>}
        </>
    );
}

// takes `menu` too, but the button's testid isn't the trigger's: it opens nothing
export function NotATrigger(props: {testId?: string; menuButton: {id: string}; menu: {id: string}}) {
    return (
        <button
            id={props.menuButton.id}
            data-testid={withRole(props.testId, 'button')}
        />
    );
}

export function Forms() {
    return (
        <div>
            <DataMenu
                menuButton={{id: 'dataButton', dataTestId: 'forms.open_data_menu--button'}}
                menu={{id: 'dataMenu'}}
            >
                <MenuItem data-testid='forms.data_menu.one--menuitem'/>
            </DataMenu>
            <RoleMenu
                menuButton={{id: 'roleButton', testId: 'forms.open_role_menu'}}
                menu={{id: 'roleMenu'}}
            >
                <MenuItem data-testid='forms.role_menu.one--menuitem'/>
            </RoleMenu>
            <MixedMenu
                menuButton={{id: 'oldButton', dataTestId: 'forms.open_old_menu--button'}}
                menu={{id: 'oldMenu'}}
            >
                <MenuItem data-testid='forms.old_menu.one--menuitem'/>
            </MixedMenu>
            <MixedMenu
                menuButton={{id: 'newButton', testId: 'forms.open_new_menu'}}
                menu={{id: 'newMenu'}}
            >
                <MenuItem data-testid='forms.new_menu.one--menuitem'/>
            </MixedMenu>
            <NotATrigger
                testId='forms.plain'
                menuButton={{id: 'plainButton'}}
                menu={{id: 'plainMenu'}}
            />
        </div>
    );
}
