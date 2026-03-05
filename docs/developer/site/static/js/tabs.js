function openTab(evt, tabName) {
    // Declare all variables
    var i, tabcontent, tablinks;

    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}

/**
 * Click handler that activates a tab in a group of tabs
 * @param {Event} evt The click event metadata
 * @param {string} tabGroupName The id of the tab group to activate a tab in
 * @param {string} tabName The id of the tab to activate
 */
const openTabV2 = (evt, tabGroupName, tabName) => {
    // Get the <div> with id matching tabGroupName
    const tabgroupdiv = document.getElementById(tabGroupName);
    if (tabgroupdiv) {
        // Get the tabs (<div class="tabcontent" id="tabGroupName-xxxxx">) and hide them
        const tabGroupPrefix = `${tabGroupName}-`;
        const tabs = document.getElementsByClassName("tabcontent");
        for (const tab of tabs) {
            if (tab.id.startsWith(tabGroupPrefix)) {
                // Hide the tab
                tab.style.display = "none";
            }
        }
        // Get the tab links and remove the `active` class
        const tablinks = tabgroupdiv.getElementsByClassName("tablinks");
        for (const tablink of tablinks) {
            tablink.className = tablink.className.replace(" active", "");
        }
        // Show the desired tab and activate its tab link
        const desiredTab = document.getElementById(tabName);
        if (desiredTab) {
            desiredTab.style.display = "block";
        } else {
            console.error(`openTabV2(): cannot find desired tab with id '${tabName}'`);
        }
        evt.currentTarget.className += " active";
    } else {
        console.error(`openTabV2(): cannot find a div element with id '${tabGroupName}'`);
    }
};
