/**
 * banana-theme — thin theme on @panomc/theme-core.
 * Overrides: Navbar (username tooltip on the avatar dropdown).
 */
export default {
  views: {
    Navbar: () => import("./src/views/Navbar.svelte"),
  },
};
