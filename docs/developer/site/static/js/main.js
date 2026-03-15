"use strict";

$(document).ready(function () {
  $(".header__menu-toggle, .sidebar__menu-toggle").on("click", function () {
    $(this).next().slideToggle();
  });

  $(".sub-menu__toggle").on("click", function () {
    $(this).parent().next(".sub-menu").toggle();
    $(this).toggleClass("fa-plus-square-o fa-minus-square-o");
  });

  // NOTE: Change the notification_banner_key to something unique everytime it changes
  // So it will show up for new announcements
  // Keep "mm_notification_banner__" at the beginning of the key
  // Add system to clean out storage items that are no longer needed

  const notification_banner_key = 'mm_notification_banner__11-0-release';
  const showBanner = localStorage.getItem(notification_banner_key);

  if (showBanner === null) {
		localStorage.setItem(notification_banner_key, true);
  }

  if (showBanner === 'false') {
    $(".notification-bar").addClass("closed");
    $("header").removeClass("with-notification-bar");
  }

  $(".notification-bar__close").on("click", function () {
    if (showBanner === 'true') {
      $(".notification-bar").addClass("closed");
      $("header").removeClass("with-notification-bar");
      localStorage.setItem(notification_banner_key, false);
    }
  });

});

// 2021 Redesign - Navigation
document.addEventListener("DOMContentLoaded", function (event) {
  const hamburger = document.getElementById("hamburger");
  const subMenus = document.querySelectorAll(".site-nav__hassubnav a");

  let multiEventSingleHandler = (elem, events, handler, use_capture) => {
    events.forEach((ev) => {
      elem.addEventListener(
        ev,
        handler,
        typeof use_capture === "undefined" ? false : use_capture
      );
    });
  };

  let clickTouch = (elem, handler, use_capture) => {
    multiEventSingleHandler(
      elem,
      ["click", "touch"],
      handler,
      typeof use_capture === "undefined" ? false : use_capture
    );
  };

  subMenus.forEach((snav) => {
    clickTouch(
      snav,
      () => {
        snav.parentElement.classList.toggle("is-active");
      },
      false
    );
  });

  clickTouch(hamburger, () => {
    hamburger.classList.toggle("is-active");
    document.body.classList.toggle("nav-open");
    document.getElementById("navigation").classList.toggle("active");
  });
});

const searchForm = document.getElementById("search-form");
searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
});
