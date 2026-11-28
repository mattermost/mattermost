import React from 'react';
import Client4 from '../../effects/client/client4';
import type {Channel} from '../../effects/types/channels';

declare const flag: boolean;
declare const values: number[];
function dispatch(action: unknown): unknown { return typeof action === 'function' ? action() : action; }

function nested() { return Client4.patchChannel('id', {}); }
function Modal() { return <div data-testid='flow.modal'/>; }
function openModal<T>(value: T): T { return value; }

function reopenModal() {
    dispatch(openModal({dialogType: Modal, dialogProps: {onConfirm: reopenModal}}));
}

export function RecursiveModalOpener() {
    return <button data-testid='flow.recursive_modal--button' onClick={reopenModal}/>;
}

function ScopedModal({testId, onConfirm, onDone}: {testId?: string; onConfirm?: () => void; onDone?: () => void}) {
    return <div data-testid={testId ? `${testId}--dialog` : undefined}>
        <button data-testid={testId ? `${testId}.confirm--button` : undefined} onClick={() => {onConfirm?.(); onDone?.();}}/>
    </div>;
}

export function ScopedModalOpener() {
    return <button data-testid='flow.scoped_open--button' onClick={() => dispatch(openModal({dialogType: ScopedModal, dialogProps: {testId: 'flow.confirm_modal', onConfirm: nested}}))}/>;
}

function LoadingFields({loading}: {loading: boolean}) {
    if (loading) {
        return <span>Loading</span>;
    }
    return <button data-testid='availability.save--button'/>;
}

export function LoadingFieldsUsage() {
    return <LoadingFields loading={true}/>;
}

export function HelperAvailability({show}: {show: boolean}) {
    const renderLabel = () => <span data-testid='helper_availability.label--text'/>;
    return <div>{show && renderLabel()}</div>;
}

export function ConditionalTestId({show}: {show: boolean}) {
    return <span data-testid={show ? 'testid_availability.label--text' : undefined}/>;
}

function Family({testId, extra}: {testId?: string; extra: boolean}) {
    return <div data-testid={testId}>
        <button data-testid={testId ? `${testId}.confirm--button` : undefined}/>
        {extra && <input data-testid={testId ? `${testId}.extra--checkbox` : undefined}/>}
    </div>;
}

function FooterA({testId}: {testId?: string}) {
    return <span data-testid={testId ? `${testId}.label--text` : undefined}/>;
}
function FooterB({testId}: {testId?: string}) {
    return <button data-testid={testId ? `${testId}.confirm--button` : undefined}/>;
}
function Shell({testId, kind}: {testId?: string; kind: boolean}) {
    return <div data-testid={testId}>{kind ? <FooterA testId={testId ? `${testId}.footer` : undefined}/> : <FooterB testId={testId ? `${testId}.footer` : undefined}/>}</div>;
}
export function FamilyUsages() {
    return <div>
        <Family testId='family_one' extra={true}/>
        <Family testId='family_two' extra={false}/>
        <Shell testId='shell_one' kind={true}/>
        <Shell testId='shell_two' kind={false}/>
    </div>;
}


export function DoubleCallbackOpener() {
    return <button data-testid='flow.double_callback_open--button' onClick={() => dispatch(openModal({dialogType: ScopedModal, dialogProps: {testId: 'flow.confirm_modal', onConfirm: nested, onDone: nested}}))}/>;
}

export function NestedCallbackOpener() {
    return <button data-testid='flow.nested_callback_open--button' onClick={() => dispatch(openModal({dialogType: ScopedModal, dialogProps: {testId: 'flow.outer_modal', onConfirm: () => dispatch(openModal({dialogType: ScopedModal, dialogProps: {testId: 'flow.inner_modal', onConfirm: nested}}))}}))}/>;
}

function LeafButton({testId, toggled, onClick}: {testId?: string; toggled: boolean; onClick?: () => void}) {
    return <button data-testid={testId ? (toggled ? `${testId}--togglebutton` : `${testId}--button`) : undefined} onClick={onClick}/>;
}
export function LeafButtonUsages() {
    return <div><LeafButton testId='leaf.bold' toggled={false} onClick={nested}/><LeafButton testId='leaf.italic' toggled={true} onClick={() => Client4.getMe()}/></div>;
}

function RoleParent({testId, toggled}: {testId?: string; toggled: boolean}) {
    return <div data-testid={testId}>
        <span data-testid={testId ? `${testId}.label--text` : undefined}/>
        <LeafButton testId={testId ? `${testId}.action` : undefined} toggled={toggled}/>
    </div>;
}
export function RoleParentUsages() {
    return <div><RoleParent testId='parent_one' toggled={false}/><RoleParent testId='parent_two' toggled={true}/></div>;
}

class LegacySidebar extends React.Component<{testIdScope?: string}> {
    render() {
        let id = 'legacy-tab-button';
        if (this.props.testIdScope) {
            id = `${this.props.testIdScope}.tabs.tab--tab`;
        }
        return <button data-testid={id}/>;
    }
}
export function SidebarUsages() {
    return <div><LegacySidebar/><LegacySidebar testIdScope='sidebar'/></div>;
}

type SettingsTab = 'general' | 'advanced';
export function SetExamples({tab}: {tab: SettingsTab}) {
    return <div>
        <button data-testid={`named.tab:${tab}--tab`}/>
        <button data-testid='set_paths.option:one--menuitem'/>
        <span data-testid='set_paths.option.label--text'/>
        <div data-testid='reserved.page'/>
        <span data-testid='reserved.item:one--text'/>
        <span data-testid='reserved.scope.label--text'/>
    </div>;
}

export function TwoModalTargets() {
    return <button data-testid='flow.two_targets--button' onClick={() => {
        if (flag) {
            dispatch(openModal({dialogType: ScopedModal, dialogProps: {testId: 'first.confirm_modal'}}));
        } else {
            dispatch(openModal({dialogType: ScopedModal, dialogProps: {testId: 'second.confirm_modal'}}));
        }
    }}/>;
}

function InnerDialog({testId, extra}: {testId?: string; extra: boolean}) {
    return <div data-testid={testId ? `${testId}--dialog` : undefined}>
        <button data-testid={testId ? `${testId}.confirm--button` : undefined}/>
        {extra && <input data-testid={testId ? `${testId}.extra--checkbox` : undefined}/>}
    </div>;
}
function WrappedDialog({testId, extra}: {testId?: string; extra: boolean}) {
    return <InnerDialog testId={testId} extra={extra}/>;
}
export function WrappedDialogUsages() {
    return <div><WrappedDialog testId='wrapped.first' extra={true}/><WrappedDialog testId='wrapped.second' extra={false}/>{flag && <WrappedDialog testId='wrapped.third' extra={true}/>}</div>;
}

export function EntityChildren({recap}: {recap: Channel}) {
    return <div data-testid={`recaps.recap:${recap.id}--region`}>
        <span data-testid='recaps.recap.label--text'/>
    </div>;
}

interface SidebarTab {name: string; pluginId?: string}
declare const typedTabs: Array<SidebarTab & {name: 'first' | 'second'}>;
class TypedSidebar extends React.Component<{testId?: string; tabs: SidebarTab[]}> {
    renderTab(tab: SidebarTab) {
        return <button data-testid={this.props.testId ? `${this.props.testId}.tab:${tab.name}--tab` : undefined}/>;
    }
    render() {
        return this.props.tabs.map((tab) => this.renderTab(tab));
    }
}
export function TypedSidebarUsage() {
    return <TypedSidebar testId='typed_sidebar' tabs={typedTabs}/>;
}

function IndexedRow({testId, testKey}: {testId?: string; testKey?: number}) {
    return <button data-testid={testId ? `${testId}.node:${testKey}--menuitemcheckbox` : undefined}/>;
}
export function IndexedRowUsage() {
    return <div>{values.map((_, index) => <IndexedRow testId='indexed_row' testKey={index}/>)}</div>;
}

type Kind = 'allow' | 'deny';
type Outcome = 'pass' | 'fail';
export function TemplateKey({kind, outcome}: {kind: Kind; outcome: Outcome}) {
    const key: `${Kind}_${Outcome}` = `${kind}_${outcome}`;
    return <span data-testid={`template_key.node:${key}--text`}/>;
}

const EMPTY_CHANNELS: Channel[] = [];
export function FallbackKeys({items}: {items?: Channel[]}) {
    const memo = useMemo(() => flag ? items ?? [] : EMPTY_CHANNELS, [items]);
    return <div>
        {(flag ? items ?? [] : []).map((item) => <span data-testid={`fallback.conditional:${item.id}--text`}/>)}
        {(items || []).map((item) => <span data-testid={`fallback.or:${item.id}--text`}/>)}
        {EMPTY_CHANNELS.map((item) => <span data-testid={`fallback.empty:${item.id}--text`}/>)}
        {(memo as Channel[]).map((item) => <span data-testid={`fallback.memo:${item.id}--text`}/>)}
    </div>;
}

function OptionalAction({testId, onAction}: {testId?: string; onAction?: () => void}) {
    return <button data-testid={testId ? `${testId}--button` : undefined} onClick={() => onAction?.()}/>;
}
export function OptionalActionUsages() {
    return <div><OptionalAction testId='optional.present' onAction={nested}/><OptionalAction testId='optional.absent'/></div>;
}
