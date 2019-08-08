function onHover(element, prefix) {
    element.classList.add('container-hover');
    let unHoverElement = element.querySelector('.' + prefix + ':not(.hidden)');
    let hoverElement = element.querySelector('.' + prefix + '-hover.hidden');
    if (unHoverElement && hoverElement) {
        unHoverElement.classList.add('hidden');
        hoverElement.classList.remove('hidden');
    }
}
function onUnHover(element, prefix) {
    element.classList.remove('container-hover');
    let unHoverElement = element.querySelector('.' + prefix + '.hidden');
    let hoverElement = element.querySelector('.' + prefix + '-hover:not(.hidden)');
    if (unHoverElement && hoverElement) {
        hoverElement.classList.add('hidden');
        unHoverElement.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll("div[data-mattermost-hover]").forEach(function(element) {
        element.addEventListener("mouseover", function() {
            onHover(element, element.getAttribute("data-mattermost-hover"));
        });
        element.addEventListener("mouseleave", function() {
            onUnHover(element, element.getAttribute("data-mattermost-hover"))
        });
    });
    document.querySelectorAll("div[data-mattermost-click]").forEach(function(element) {
        element.addEventListener("click", function() {
            window.location.href = element.getAttribute("data-mattermost-click");
        });
    });
});