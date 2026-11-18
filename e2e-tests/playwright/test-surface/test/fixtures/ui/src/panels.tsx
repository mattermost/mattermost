import React from 'react';
import {connect, useDispatch} from 'react-redux';

// UI the store shows: a click dispatches a constant, the sidebar renders a panel when its state equals it
export const PanelStates = {
    INFO: 'info',
    MEMBERS: 'members',
    FILES: 'files',
} as const;

function showInfo() {
    return {type: 'UPDATE_PANEL', state: PanelStates.INFO};
}

function InfoPanel() {
    return (
        <div data-testid='side.info'>
            <button data-testid='side.info.close--button'/>
        </div>
    );
}

function MembersPanel() {
    return <div data-testid='side.members'/>;
}

class Sidebar extends React.Component<{isInfo: boolean; isMembers: boolean; open: boolean}> {
    render() {
        let content = null;
        if (this.props.isInfo) {
            content = <InfoPanel/>;
        } else if (this.props.isMembers) {
            content = <MembersPanel/>;
        }
        return <div>{content}</div>;
    }
}

function mapStateToProps(state: {panel: string}) {
    const panel = state.panel;
    return {
        isInfo: panel === PanelStates.INFO,
        isMembers: panel === PanelStates.MEMBERS,

        // a membership test is not a dispatched value
        open: [PanelStates.INFO, PanelStates.FILES].includes(panel as 'info'),
    };
}

export const ConnectedSidebar = connect(mapStateToProps)(Sidebar);

export function PanelButtons() {
    const dispatch = useDispatch();
    return (
        <div>
            <button
                data-testid='toolbar.info--button'
                onClick={() => dispatch(showInfo())}
            />
            <button
                data-testid='toolbar.files--button'
                onClick={() => dispatch({type: 'CHECK', open: [PanelStates.INFO, PanelStates.FILES].includes('files')})}
            />
            <ConnectedSidebar/>
        </div>
    );
}
