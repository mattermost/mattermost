import React, {useState} from 'react';
import {Link, NavLink, useHistory} from 'react-router-dom';
import {useSelector} from 'react-redux';

import {Menu, MenuItem} from './menu';
import {InfoPopover, LazyModal, LeaveModal, openModal, SettingsModal, TestIdToggleModalButton, ToggleModalButton} from './modals';

const leaveDescriptor = {modalId: 'leave', dialogType: LeaveModal};

function canManage(state: unknown, id: string) {
    return Boolean(state && id);
}

// a link component: where it goes comes from its usage
function ChannelLink({testId, url}: {testId: string; url: string}) {
    return (
        <Link
            to={url}
            data-testid={testId}
        />
    );
}

export function Header({channelId, isMobile, teamName = 'team', externalUrl = ''}: {channelId: string; isMobile: boolean; teamName?: string; externalUrl?: string}) {
    const [showInfo, setShowInfo] = useState(false);
    const history = useHistory();
    const canAccess = useSelector((state) => canManage(state, channelId));
    const either = isMobile ? LeaveModal : SettingsModal;
    if (!channelId) {
        return null;
    }
    return (
        <div>
            <Menu
                menuButton={{id: 'headerMenuButton', dataTestId: 'header.open_menu--button'}}
                menu={{id: 'headerMenu'}}
            >
                {canAccess && (
                    <MenuItem
                        data-testid='header.menu.settings--menuitem'
                        onClick={() => openModal({modalId: 'settings', dialogType: SettingsModal, dialogProps: {onSave: () => null}})}
                    />
                )}
                <MenuItem
                    data-testid='header.menu.leave--menuitem'
                    onClick={() => openModal(leaveDescriptor)}
                />
                <MenuItem
                    role='menuitemcheckbox'
                    data-testid='header.menu.mute--menuitem'
                />
            </Menu>
            <ToggleModalButton
                dialogType={LazyModal}
                data-testid='header.lazy--button'
            />
            <TestIdToggleModalButton
                dialogType={SettingsModal}
                testId='header.settings'
            />
            <ul role='listbox'>
                <li
                    role='option'
                    aria-selected={true}
                    data-testid='header.current_channel--option'
                />
            </ul>
            <TestIdToggleModalButton
                dialogType={either}
                testId='header.either'
            />
            {isMobile ? (
                <button
                    data-testid='header.info--button'
                    onClick={() => setShowInfo(true)}
                />
            ) : (
                <a
                    href='/help'
                    data-testid='header.help--link'
                    onClick={() => history.push('/help')}
                />
            )}
            {showInfo && <InfoPopover/>}
            <Link
                to={`/${teamName}/channels/town-square`}
                data-testid='header.home--link'
            />
            <NavLink
                to='/help/faq?from=header'
                data-testid='header.faq--link'
            />
            <Link
                to={externalUrl}
                data-testid='header.external--link'
            />
            <button
                data-testid='header.guide--button'
                onClick={() => {
                    if (isMobile) {
                        history.push('/help/mobile');
                        return;
                    }
                    setShowInfo(true);
                }}
            />
            <ChannelLink
                testId='header.off_topic--link'
                url={`/${teamName}/messages/@${'someone'}`}
            />
        </div>
    );
}

// class component that shows a modal through this.state
export class Banner extends React.Component<{}, {showLeave: boolean}> {
    open = () => this.setState({showLeave: true});
    render() {
        return (
            <div>
                <button
                    aria-pressed={false}
                    data-testid='banner.leave--togglebutton'
                    onClick={this.open}
                />
                {this.state.showLeave && <LeaveModal/>}
            </div>
        );
    }
}

// class component that builds the modal in an if statement before returning it
export class Footer extends React.Component<{}, {showLeave: boolean}> {
    open = () => this.setState({showLeave: true});
    renderModals = () => {
        let modal;
        if (this.state.showLeave) {
            modal = <LeaveModal/>;
        }
        return modal;
    };
    render() {
        return (
            <div>
                <button
                    data-testid='footer.leave--button'
                    onClick={this.open}
                />
                {this.renderModals()}
            </div>
        );
    }
}

// a tip rendered inside a menu item has its own scope, which must not widen the menu's
function Tip() {
    return <button data-testid='tip.close--button'/>;
}

export function Bar() {
    return (
        <div>
            <Menu
                menuButton={{id: 'barMenuButton', dataTestId: 'bar.header.open_menu--button'}}
                menu={{id: 'barMenu'}}
            >
                <MenuItem data-testid='bar.menu.one--menuitem'/>
                <MenuItem data-testid='bar.menu.two--menuitem'/>
                <Tip/>
            </Menu>
        </div>
    );
}

export function ResponsiveHeader({isMobile}: {isMobile: boolean}) {
    return <Header channelId='responsive' isMobile={isMobile}/>;
}

export function NavigationModalOpener() {
    const history = useHistory();
    return <button data-testid='header.navigation_modal--button' onClick={() => openModal({modalId: 'navigation', dialogType: SettingsModal, dialogProps: {onSave: () => history.push('/help')}})}/>;
}
