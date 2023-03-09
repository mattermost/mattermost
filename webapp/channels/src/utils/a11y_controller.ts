// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Constants, {EventTypes, A11yClassNames, A11yAttributeNames, A11yCustomEventTypes, isA11yFocusEventDetail} from 'utils/constants';
import {isKeyPressed, cmdOrCtrlPressed, isMac} from 'utils/utils';
import {isDesktopApp} from 'utils/user_agent';

const listenerOptions = {
    capture: true,
};

export default class A11yController {
    // Note that these collections are live which means that they'll be updated automatically
    regionHTMLCollection = this.getAllRegions();
    sectionHTMLCollection?: HTMLCollectionOf<HTMLElement>; // populated when region changes
    modalHTMLCollection = this.getAllModals();
    popupHTMLCollection = this.getAllPopups();

    activeRegion?: HTMLElement;
    activeSection?: HTMLElement;
    activeElement?: HTMLElement;

    mouseIsPressed = false;

    // The default behaviour is to only show a visible focus if the user is currently
    // in the middle of using the keyboard (i.e. the user is pressing a key on the keyboard).
    // This behaviour was introduced in https://github.com/mattermost/mattermost-webapp/pull/3922.
    // But we want to be able to manually focus elements with the custom focus event, even if
    // no keys are currently pressed, for components that manually handle focus such as
    // popovers and modals. So we need a distinction between these two actions.
    lastInputEventIsKeyDown = false;
    lastInputEventIsKeyboard = true;

    manualFocus = false;

    enterKeyIsPressed = false;
    f6KeyIsPressed = false;
    upArrowKeyIsPressed = false;
    downArrowKeyIsPressed = false;
    tabKeyIsPressed = false;
    tildeKeyIsPressed = false;
    lKeyIsPressed = false;
    escKeyIsPressed = false;
    windowIsFocused = true;

    // used to reset navigation whenever navigation within a region occurs (section or element)
    resetNavigation = false;

    constructor() {
        document.addEventListener(EventTypes.KEY_DOWN, this.handleKeyDown, listenerOptions);
        document.addEventListener(EventTypes.KEY_UP, this.handleKeyUp, listenerOptions);
        document.addEventListener(EventTypes.CLICK, this.handleMouseClick, listenerOptions);
        document.addEventListener(EventTypes.MOUSE_DOWN, this.handleMouseDown, listenerOptions);
        document.addEventListener(EventTypes.MOUSE_UP, this.handleMouseUp, listenerOptions);
        document.addEventListener(EventTypes.FOCUS, this.handleFocus, listenerOptions);
        document.addEventListener(A11yCustomEventTypes.FOCUS, this.handleA11yFocus, listenerOptions);
        window.addEventListener(EventTypes.BLUR, this.handleWindowBlur, listenerOptions);
    }

    destroy() {
        this.clearActiveRegion();
        this.clearCurrentFocus();

        document.removeEventListener(EventTypes.KEY_DOWN, this.handleKeyDown, listenerOptions);
        document.removeEventListener(EventTypes.KEY_UP, this.handleKeyUp, listenerOptions);
        document.removeEventListener(EventTypes.CLICK, this.handleMouseClick, listenerOptions);
        document.removeEventListener(EventTypes.MOUSE_DOWN, this.handleMouseDown, listenerOptions);
        document.removeEventListener(EventTypes.MOUSE_UP, this.handleMouseUp, listenerOptions);
        document.removeEventListener(EventTypes.FOCUS, this.handleFocus, listenerOptions);
        document.removeEventListener(A11yCustomEventTypes.FOCUS, this.handleA11yFocus, listenerOptions);
        window.removeEventListener(EventTypes.BLUR, this.handleWindowBlur, listenerOptions);
    }

    // convenience getter/setters

    /**
     * Determines if keyboard navigation is currently in progress based on several criteria as follows:
     * 1. There must be defined regions and a single region must be active
     * 2. The last input event detected must be a keyboard event
     * 3. There must be no open modals and/or popups
     * 4. There must be an active element and it must support classList
     */
    get navigationInProgress() {
        if (!this.regions || !this.regions.length || !this.isElementValid(this.activeRegion)) {
            return false;
        }
        if (!this.lastInputEventIsKeyDown) {
            return false;
        }
        if (this.modalIsOpen || this.popupIsOpen) {
            return false;
        }
        if (!this.isElementValid(this.activeElement)) {
            return false;
        }
        return true;
    }

    /**
     * Returns an array of available regions sorted by A11yAttributeNames.SORT_ORDER
     */
    get regions() {
        let domElements = this.sortElementsByAttributeOrder(this.regionHTMLCollection);
        domElements = domElements.filter((element) => {
            return this.elementIsVisible(element);
        });
        return domElements;
    }

    /**
     * Returns an array of available sections sorted by A11yAttributeNames.SORT_ORDER and optionally reversed
     */
    get sections() {
        let domElements = this.sortElementsByAttributeOrder(this.sectionHTMLCollection!);
        domElements = domElements.filter((element) => {
            return this.elementIsVisible(element);
        });
        if (this.shouldReverseSections) {
            domElements.reverse();
        }
        return domElements;
    }

    /**
     * Returns the index of the active region
     */
    get activeRegionIndex() {
        if (!this.activeRegion) {
            return -1;
        }
        return this.regions.indexOf(this.activeRegion);
    }

    /**
     * Returns the index of the active section
     */
    get activeSectionIndex() {
        if (!this.activeSection) {
            return -1;
        }
        return this.sections.indexOf(this.activeSection);
    }

    /**
     * Returns whether the regions requires reverse section navigation
     */
    get shouldReverseSections() {
        if (!this.activeRegion) {
            return false;
        }
        return this.getOrderReverseAttribute(this.activeRegion);
    }

    /**
     * Returns the element that should currently have focus
     */
    get focusedElement() {
        let focusedElement;
        if (this.activeElement) {
            focusedElement = this.activeElement;
        } else if (this.activeSection) {
            focusedElement = this.activeSection;
        } else if (this.activeRegion) {
            focusedElement = this.activeRegion;
        }
        return focusedElement;
    }

    /**
     * Returnes whether an a11y-specific key is currently pressed
     */
    get a11yKeyIsPressed() {
        return this.f6KeyIsPressed ||
               this.upArrowKeyIsPressed ||
               this.downArrowKeyIsPressed ||
               this.tabKeyIsPressed ||
               this.tildeKeyIsPressed ||
               this.lKeyIsPressed ||
               this.escKeyIsPressed;
    }

    /**
     * Indicates if a modal window is currently open
     * - modals must have A11yClassNames.MODAL to be considered
     */
    get modalIsOpen() {
        return this.modalHTMLCollection.length > 0;
    }

    /**
     * Indicates if a popup/dropdown element is currently open
     * - popups/dropdowns must have A11yClassNames.POPUP to be considered
     */
    get popupIsOpen() {
        return this.popupHTMLCollection.length > 0;
    }

    /**
     * Indicates if the region should disallow the change of active sections and regions
     * This stops sections and regions from changing in the controller while this class is applied, such that another package can
     * utilize the a11y_controller to stop other keyboard events for accessibility reasons in favour of its own
     */
    get disableNavigation() {
        return this.activeRegion && this.activeRegion.getAttribute(A11yAttributeNames.DISABLE_NAVIGATION) === 'true';
    }

    // public methods

    /**
     * Determines the next region, sets it as active and updates the current focus
     */
    nextRegion() {
        const regions = this.regions;
        if (
            !regions ||
            !regions.length ||
            this.modalIsOpen ||
            this.popupIsOpen
        ) {
            return;
        }
        if (!this.disableNavigation) {
            let newRegion;
            if (
                !this.activeRegion ||
                this.activeRegionIndex === regions.length - 1 ||
                this.resetNavigation
            ) {
                newRegion = regions[0];
            } else {
                newRegion = regions[this.activeRegionIndex + 1];
            }
            this.setActiveRegion(newRegion);
        }
        this.setCurrentFocus();
        this.resetNavigation = false;
    }

    /**
     * Determines the previous region, sets it as active and updates the current focus
     */
    previousRegion() {
        const regions = this.regions;
        if (
            !regions ||
            !regions.length ||
            this.modalIsOpen ||
            this.popupIsOpen
        ) {
            return;
        }
        if (!this.disableNavigation) {
            let newRegion;
            if (!this.activeRegion || (this.activeRegionIndex !== 0 && this.resetNavigation)) {
                newRegion = regions[0];
            } else if (this.activeRegionIndex === 0) {
                newRegion = regions[regions.length - 1];
            } else {
                newRegion = regions[this.activeRegionIndex - 1];
            }
            this.setActiveRegion(newRegion);
        }
        this.setCurrentFocus();
        this.resetNavigation = false;
    }

    /**
     * Determines the next section, sets it as active and updates the current focus
     */
    nextSection() {
        const sections = this.sections;
        const shouldLoopNavigation = this.getLoopNavigationAttribute(this.activeRegion);
        if (
            this.modalIsOpen ||
            this.popupIsOpen ||
            !sections ||
            !sections.length ||
            (!shouldLoopNavigation && this.activeSectionIndex === sections.length - 1)
        ) {
            return;
        }
        if (!this.disableNavigation) {
            let newSection;
            if (this.activeSection && this.activeSectionIndex < sections.length - 1) {
                newSection = sections[this.activeSectionIndex + 1];
            } else {
                newSection = sections[0];
            }
            this.setActiveSection(newSection);
        }
        this.setCurrentFocus();
        this.resetNavigation = true;
    }

    /**
     * Determines the previous section, sets it as active and updates the current focus
     */
    previousSection() {
        const sections = this.sections;
        const shouldLoopNavigation = this.getLoopNavigationAttribute(this.activeRegion);
        if (
            this.modalIsOpen ||
            this.popupIsOpen ||
            !sections ||
            !sections.length ||
            (!shouldLoopNavigation && this.activeSectionIndex === 0)
        ) {
            return;
        }
        if (!this.disableNavigation) {
            let newSection;
            if (this.activeSection && this.activeSectionIndex > 0) {
                newSection = sections[this.activeSectionIndex - 1];
            } else if (this.activeSection && this.activeSectionIndex === 0) {
                newSection = sections[sections.length - 1];
            } else {
                newSection = sections[0];
            }
            this.setActiveSection(newSection);
        }
        this.setCurrentFocus();
        this.resetNavigation = true;
    }

    /**
     * Takes the provided dom element, finds it's parent section and region (if available),
     * sets them as active and updates the current focus
     * @param element - the DOM element to set as the active element
     * @param elementPath - array of element's dom branch or boolean to find section/region of element
     */
    nextElement(element: HTMLElement, elementPath: EventTarget[] | boolean = false) {
        function isPath(obj: unknown): obj is HTMLElement[] {
            return Array.isArray(obj);
        }

        let region;
        let section;
        if (isPath(elementPath)) {
            // is the current element in an active region?
            if (!this.activeRegion || elementPath.indexOf(this.activeRegion) < 0) {
                region = elementPath.find((pathElement) => {
                    if (!pathElement.classList) {
                        return false;
                    }
                    return pathElement.classList.contains(A11yClassNames.REGION);
                });
            }

            // is the current element in an active section?
            if (!this.activeSection || elementPath.indexOf(this.activeSection) < 0) {
                section = elementPath.find((pathElement) => {
                    if (!pathElement.classList) {
                        return false;
                    }
                    return pathElement.classList.contains(A11yClassNames.SECTION);
                });
            }
        } else if (elementPath && typeof element.closest === 'function') {
            region = element.closest(`.${A11yClassNames.REGION}`) as HTMLElement;
            section = element.closest(`.${A11yClassNames.SECTION}`) as HTMLElement;
        }
        if (region && this.activeRegion !== region) {
            this.setActiveRegion(region, false);
        }
        if (section && this.activeSection !== section) {
            this.setActiveSection(section);
        }
        this.setActiveElement(element);
        this.setCurrentFocus();
        this.resetNavigation = true;
    }

    /**
     * Resets the a11y navigation controller, active region/section/element, clears focus and resets user interraction states
     */
    cancelNavigation() {
        this.clearActiveRegion();
        this.setCurrentFocus();
        this.resetInterractionStates();
    }

    // private methods

    /**
     * Sets the currently active region and stores a list of the regions sections
     * @param element - DOM element to set as the active region
     * @param {boolean} canFocusChild - whether to focus child section instead of provide region
     * @emits {A11yCustomEventTypes.ACTIVATE} - emitted on the provided DOM element once set to active
     */
    setActiveRegion(element: HTMLElement, canFocusChild = true) {
        if (!this.isElementValid(element, [this.activeRegion]) && !this.resetNavigation) {
            return;
        }

        // clear previous active region
        this.clearActiveRegion();

        // setup new active region
        this.activeRegion = element;
        this.activeRegion.addEventListener(A11yCustomEventTypes.UPDATE, this.handleActiveRegionUpdate);
        this.activeRegion.dispatchEvent(new Event(A11yCustomEventTypes.ACTIVATE));

        // apply visual updates to active region
        this.updateActiveRegion();

        // retrieve all sections for the new active region
        this.sectionHTMLCollection = this.getAllSectionsForRegion(this.activeRegion);

        // should the visual focus start on a child section
        if (canFocusChild && this.getFocusChildAttribute(this.activeRegion) && this.sections && this.sections.length) {
            this.setActiveSection(this.sections[0]);
        }
    }

    /**
     * Sets the currently active section
     * @param element - DOM element to set as the active section
     * @emits {A11yCustomEventTypes.ACTIVATE} - emitted on the provided DOM element once set to active
     */
    setActiveSection(element: HTMLElement) {
        if (!this.isElementValid(element, [this.activeSection])) {
            return;
        }

        // clear previous active section
        this.clearActiveSection();

        // setup new active section
        this.activeSection = element;
        this.activeSection.addEventListener(A11yCustomEventTypes.UPDATE, this.handleActiveSectionUpdate);
        this.activeSection.dispatchEvent(new Event(A11yCustomEventTypes.ACTIVATE));

        // apply visual updates to active section
        this.updateActiveSection();
    }

    /**
     * Sets the currently active element
     * @param element - DOM element to set as the active element
     * @emits {A11yCustomEventTypes.ACTIVATE} - emitted on the provided DOM element once set to active
     */
    setActiveElement(element: HTMLElement) {
        if (!this.isElementValid(element, [this.activeElement])) {
            return;
        }

        // clear previous active element
        this.clearActiveElement();

        // setup new active element
        this.activeElement = element;
        this.activeElement.addEventListener(A11yCustomEventTypes.UPDATE, this.handleActiveElementUpdate);
        if (this.activeElement !== this.activeRegion && this.activeElement !== this.activeSection) {
            this.activeElement.dispatchEvent(new Event(A11yCustomEventTypes.ACTIVATE));
        }

        // apply visual updates to active element
        this.updateActiveElement();
    }

    /**
     * Updates the focus status of the element that should now have focus
     */
    setCurrentFocus() {
        this.clearCurrentFocus();
        if (!this.focusedElement) {
            return;
        }

        // set focus on the element that should have focus if needed
        if (document.activeElement !== this.focusedElement) {
            this.focusedElement.focus();
        }

        // apply visual updates to focused element
        this.udpateCurrentFocus();
    }

    /**
     * Updates the visual state of the active region and makes sure it is focusable
     */
    updateActiveRegion() {
        if (!this.activeRegion) {
            return;
        }
        this.activeRegion.classList.add(A11yClassNames.ACTIVE);

        // ensure active region element is focusable
        if (!this.activeRegion.getAttribute('tabindex')) {
            this.activeRegion.setAttribute('tabindex', '-1');
        }
    }

    /**
     * Updates the visual state of the active section and makes sure it is focusable
     */
    updateActiveSection() {
        if (!this.activeSection) {
            return;
        }
        this.activeSection.classList.add(A11yClassNames.ACTIVE);

        // ensure active section element is focusable
        if (!this.activeSection.getAttribute('tabindex')) {
            this.activeSection.setAttribute('tabindex', '-1');
        }
    }

    /**
     * Updates the visual state of the active element
     */
    updateActiveElement() {
        if (!this.activeElement) {
            return;
        }
        this.activeElement.classList.add(A11yClassNames.ACTIVE);
    }

    /**
     * Updates the visual state of the currently focused element
     */
    udpateCurrentFocus(forceUpdate = false) {
        if ((!this.focusedElement || !(this.a11yKeyIsPressed || this.manualFocus)) && !forceUpdate) {
            return;
        }
        this.focusedElement?.classList.add(A11yClassNames.FOCUSED);
    }

    /**
     * Clears all a11y-applied classes, events and the active region DOM element reference
     */
    clearActiveRegion() {
        if (this.activeRegion) {
            this.activeRegion.classList.remove(A11yClassNames.ACTIVE);
            this.activeRegion.dispatchEvent(new Event(A11yCustomEventTypes.DEACTIVATE));
            this.activeRegion.removeEventListener(A11yCustomEventTypes.UPDATE, this.handleActiveRegionUpdate);
            this.activeRegion = undefined;
        }
        this.clearActiveSection();
    }

    /**
     * Clears all a11y-applied classes, events and the active section DOM element reference
     */
    clearActiveSection() {
        if (this.activeSection) {
            this.activeSection.classList.remove(A11yClassNames.ACTIVE);
            this.activeSection.dispatchEvent(new Event(A11yCustomEventTypes.DEACTIVATE));
            this.activeSection.removeEventListener(A11yCustomEventTypes.UPDATE, this.handleActiveSectionUpdate);
            this.activeSection = undefined;
        }
        this.clearActiveElement();
    }

    /**
     * Clears all a11y-applied classes, events and the active DOM element reference
     */
    clearActiveElement() {
        if (this.activeElement) {
            if (this.activeElement !== this.activeRegion && this.activeElement !== this.activeSection) {
                this.activeElement.classList.remove(A11yClassNames.ACTIVE);
                this.activeElement.dispatchEvent(new Event(A11yCustomEventTypes.DEACTIVATE));
            }
            this.activeElement.removeEventListener(A11yCustomEventTypes.UPDATE, this.handleActiveElementUpdate);
            this.activeElement = undefined;
        }
    }

    /**
     * Clears all focused element classes and blurs the active element if requested
     */
    clearCurrentFocus(blurActiveElement = false) {
        Array.from(document.getElementsByClassName(A11yClassNames.FOCUSED)).forEach((element) => {
            element.classList.remove(A11yClassNames.FOCUSED);
        });
        if (blurActiveElement) {
            (document.activeElement as HTMLElement).blur();
        }
    }

    /**
     * Resets the state of all a11y-defined interraction methods
     */
    resetInterractionStates() {
        this.mouseIsPressed = false;
        this.f6KeyIsPressed = false;
        this.upArrowKeyIsPressed = false;
        this.downArrowKeyIsPressed = false;
        this.tabKeyIsPressed = false;
        this.tildeKeyIsPressed = false;
        this.enterKeyIsPressed = false;
        this.escKeyIsPressed = false;
        this.lKeyIsPressed = false;
        this.lastInputEventIsKeyDown = false;
    }

    // helper methods

    /**
     * Returns an HTMLCollection object of all defined regions
     * - use of HTMLCollection is intentional as this object auto updates to reflect DOM changes
     */
    getAllRegions() {
        return document.getElementsByClassName(A11yClassNames.REGION) as HTMLCollectionOf<HTMLElement>;
    }

    /**
     * Returns an HTMLCollection object of all defined sections for the currently active region
     * - use of HTMLCollection is intentional as this object auto updates to reflect DOM changes
     */
    getAllSectionsForRegion(region: HTMLElement) {
        if (!region) {
            return undefined;
        }
        return region.getElementsByClassName(A11yClassNames.SECTION) as HTMLCollectionOf<HTMLElement>;
    }

    /**
     * Sort a list of DOM elements by defined A11yAttributeNames.SORT_ORDER attribute
     * @param elements - list of elements to be sorted
     */
    sortElementsByAttributeOrder(elements: HTMLCollectionOf<HTMLElement>) {
        if (!elements || !elements.length) {
            return [];
        }
        return Array.from(elements).sort((elementA, elementB) => {
            const elementAOrder = parseInt(elementA.getAttribute(A11yAttributeNames.SORT_ORDER) || '', 10);
            const elementBOrder = parseInt(elementB.getAttribute(A11yAttributeNames.SORT_ORDER) || '', 10);

            if (isNaN(elementAOrder) && isNaN(elementBOrder)) {
                return 0;
            }
            if (isNaN(elementBOrder)) {
                return -1;
            }
            if (isNaN(elementAOrder)) {
                return 1;
            }

            return elementAOrder - elementBOrder;
        });
    }

    /**
     * Returns whether a DOM element is currently visible or not
     * @param element - the DOM element to check
     */
    elementIsVisible(element: HTMLElement) {
        return element &&
            element instanceof HTMLElement &&
            element.offsetParent;
    }

    /**
     * Retuns an HTMLCollection of all DOM elements that have the A11yClassNames.MODAL class
     */
    getAllModals() {
        return document.getElementsByClassName(A11yClassNames.MODAL) as HTMLCollectionOf<HTMLElement>;
    }

    /**
     * Retuns an HTMLCollection of all DOM elements that have the A11yClassNames.POPUP class
     */
    getAllPopups() {
        return document.getElementsByClassName(A11yClassNames.POPUP) as HTMLCollectionOf<HTMLElement>;
    }

    /**
     * Helper to retrieve the value of the A11yAttributeNames.LOOP_NAVIGATION attribute for the provided DOM element
     * @param element - the element to retrive the A11yAttributeNames.LOOP_NAVIGATION value from
     */
    getLoopNavigationAttribute(element: HTMLElement | undefined) {
        const attributeValue = element?.getAttribute(A11yAttributeNames.LOOP_NAVIGATION);
        if (attributeValue && attributeValue.toLowerCase() === 'false') {
            return false;
        }
        return true;
    }

    /**
     * Helper to retrieve the value of the A11yAttributeNames.ORDER_REVERSE attribute for the provided DOM element
     * @param element - the element to retrive the A11yAttributeNames.ORDER_REVERSE value from
     */
    getOrderReverseAttribute(element: HTMLElement) {
        const attributeValue = element.getAttribute(A11yAttributeNames.ORDER_REVERSE);
        if (attributeValue && attributeValue.toLowerCase() === 'true') {
            return true;
        }
        return false;
    }

    /**
     * Helper to retrieve the value of the A11yAttributeNames.FOCUS_CHILD attribute for the provided DOM element
     * @param element - the element to retrive the A11yAttributeNames.FOCUS_CHILD value from
     */
    getFocusChildAttribute(element: HTMLElement) {
        const attributeValue = element.getAttribute(A11yAttributeNames.FOCUS_CHILD);
        if (attributeValue && attributeValue.toLowerCase() === 'true') {
            return true;
        }
        return false;
    }

    /**
     * Helper method to verify if a provided DOM element is a valid element for a11y navigation
     * @param element - the DOM element to check
     * @param invalidElements - a list of invalid DOM elements to check against
     */
    isElementValid(element: HTMLElement | undefined, invalidElements: Array<HTMLElement | undefined> = []) {
        if (
            element &&
            element.classList &&
            !invalidElements.includes(element)
        ) {
            return true;
        }
        return false;
    }

    // event handling methods

    handleKeyDown = (event: Event) => {
        if (
            !(event instanceof KeyboardEvent) ||
            !event.target ||
            !(event.target instanceof HTMLElement)
        ) {
            return;
        }

        this.lastInputEventIsKeyboard = true;

        const modifierKeys = {
            ctrlIsPressed: event.ctrlKey,
            altIsPressed: event.altKey,
            shiftIsPressed: event.shiftKey,
        };
        switch (true) {
        case isKeyPressed(event, Constants.KeyCodes.TAB):
            this.lastInputEventIsKeyDown = true;
            if ((!isMac() && modifierKeys.altIsPressed) || cmdOrCtrlPressed(event)) {
                return;
            }
            this.tabKeyIsPressed = true;
            break;
        case isKeyPressed(event, Constants.KeyCodes.TILDE):
            this.lastInputEventIsKeyDown = true;
            if (!this.regions || !this.regions.length) {
                return;
            }

            // Check to make sure both aren't pressed because some older webkit browsers set CTRL and ALT when AltGr is pressed
            if (modifierKeys.ctrlIsPressed && !modifierKeys.altIsPressed) {
                this.tildeKeyIsPressed = true;
                event.preventDefault();
                if (modifierKeys.shiftIsPressed) {
                    this.previousRegion();
                } else {
                    this.nextRegion();
                }
            }
            break;
        case isKeyPressed(event, Constants.KeyCodes.F6):
            this.lastInputEventIsKeyDown = true;
            if (!isDesktopApp() && !cmdOrCtrlPressed(event)) {
                return;
            }
            this.f6KeyIsPressed = true;
            event.preventDefault();
            if (modifierKeys.shiftIsPressed) {
                this.previousRegion();
            } else {
                this.nextRegion();
            }
            break;
        case isKeyPressed(event, Constants.KeyCodes.UP):
            this.lastInputEventIsKeyDown = true;
            if (!this.navigationInProgress || !this.sections || !this.sections.length) {
                return;
            }
            this.upArrowKeyIsPressed = true;
            event.preventDefault();
            if (this.shouldReverseSections) {
                this.nextSection();
            } else {
                this.previousSection();
            }
            break;
        case isKeyPressed(event, Constants.KeyCodes.DOWN):
            this.lastInputEventIsKeyDown = true;
            if (!this.navigationInProgress || !this.sections || !this.sections.length) {
                return;
            }
            this.downArrowKeyIsPressed = true;
            event.preventDefault();
            if (this.shouldReverseSections) {
                this.previousSection();
            } else {
                this.nextSection();
            }
            break;
        case isKeyPressed(event, Constants.KeyCodes.ESCAPE):
            this.escKeyIsPressed = true;
            this.lastInputEventIsKeyDown = true;
            if (!this.navigationInProgress) {
                return;
            }
            event.preventDefault();
            this.cancelNavigation();
            break;
        case isKeyPressed(event, Constants.KeyCodes.ENTER):
            this.enterKeyIsPressed = true;
            break;
        case isKeyPressed(event, Constants.KeyCodes.SPACE):
            if (event.target.nodeName === 'BUTTON') {
                event.preventDefault();
                event.stopPropagation();
                event.target.click();
            }
            break;
        case isKeyPressed(event, Constants.KeyCodes.L):
            // For the Ctrl+Shift+L keyboard shortcut
            this.lastInputEventIsKeyDown = true;
            this.lKeyIsPressed = true;
            break;
        }
    }

    handleKeyUp = () => {
        this.resetInterractionStates();
    }

    handleMouseClick = (event: Event) => {
        // hitting enter on a <button> triggers a click event
        if (!this.enterKeyIsPressed) {
            this.lastInputEventIsKeyDown = false;
        }
        if (event.target === this.activeElement) {
            return;
        }
        this.cancelNavigation();
    }

    handleMouseDown = () => {
        this.mouseIsPressed = true;
        this.lastInputEventIsKeyboard = false;
    }

    handleMouseUp = () => {
        this.mouseIsPressed = false;
    }

    handleFocus = (event: Event) => {
        if (event.target instanceof HTMLElement) {
            // since the post-list (in which the EditPost component lives) has the attribute `data-a11y-child-focus` hitting
            // the UP-Key causes the a11y controller to go through the posts. This is unwanted behavior in a textarea, so we
            // decided to leave this fix in for now. If we find the need for a more sustainable fix we can certainly do
            // that, as well, but for now this is sufficient.
            // @see: https://github.com/mattermost/mattermost-webapp/pull/8882#discussion_r790905592
            if (this.lastInputEventIsKeyDown && this.windowIsFocused && event.target.id !== 'edit_textbox') {
                this.nextElement(event.target, event.composedPath() || true);
            }
        }

        // focus just came back to the app
        if (!this.windowIsFocused) {
            this.windowIsFocused = true;
        }
    }

    handleA11yFocus = (event: Event) => {
        if (!(event instanceof CustomEvent)) {
            return;
        }

        if (!isA11yFocusEventDetail(event.detail) || !event.detail.target) {
            return;
        }

        if (!event.detail.keyboardOnly || this.lastInputEventIsKeyboard) {
            this.manualFocus = true;
            this.nextElement(event.detail.target, true);
            this.manualFocus = false;
        } else {
            event.detail.target.focus();
        }
    }

    handleWindowBlur = (event: Event) => {
        if (event.target === window) {
            this.windowIsFocused = false;
        }
    }

    handleActiveRegionUpdate = () => {
        if (this.navigationInProgress) {
            this.updateActiveRegion();
            if (this.focusedElement === this.activeRegion) {
                this.udpateCurrentFocus(true);
            }
        }
    }

    handleActiveSectionUpdate = () => {
        if (this.navigationInProgress) {
            this.updateActiveSection();
            if (this.focusedElement === this.activeSection) {
                this.udpateCurrentFocus(true);
            }
        }
    }

    handleActiveElementUpdate = () => {
        if (this.navigationInProgress) {
            this.updateActiveElement();
            if (this.focusedElement === this.activeElement) {
                this.udpateCurrentFocus(true);
            }
        }
    }
}
