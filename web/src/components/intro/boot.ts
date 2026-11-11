export const SEEN = "asterism-intro-seen";

/** Runs in the document head before first paint (see INTRO_BOOT): decides whether the opening plays, so nothing flashes. */
export const INTRO_BOOT = `(function(){var d=document.documentElement;try{var home=location.pathname==="/"||location.pathname==="";var seen=sessionStorage.getItem("${SEEN}")==="1";var calm=matchMedia("(prefers-reduced-motion: reduce)").matches;d.setAttribute("data-intro",home&&!seen&&!calm?"on":"off")}catch(e){d.setAttribute("data-intro","off")}})()`;
