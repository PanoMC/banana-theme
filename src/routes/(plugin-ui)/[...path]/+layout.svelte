{#if data.systemLayout}
  <svelte:component this={data.systemLayout} {data}>
    {#if !data.layout}
      <slot />
    {:else}
      <!--
        layoutContainer and slotContentContainer stay OUTSIDE {#key data} so navigation never
        destroys them. The slot bridge moves slotContentContainer into the mounted layout's anchor;
        if it were keyed, the key teardown on navigation would rip the live <slot> subtree out of
        the layout, blanking/tearing the page. Only an inner wrapper is keyed, to refresh content.
      -->
      <div bind:this={layoutContainer} class="plugin-layout-container"></div>
      <div bind:this={slotContentContainer} class="plugin-content-wrapper" style="display: none;">
        {#key data}
          <div class="plugin-content-keyed">
            <slot />
          </div>
        {/key}
      </div>
    {/if}
  </svelte:component>
{:else}
  {#if !data.layout}
    <slot />
  {:else}
    <div bind:this={layoutContainer} class="plugin-layout-container"></div>
    <div bind:this={slotContentContainer} class="plugin-content-wrapper" style="display: none;">
      {#key data}
        <div class="plugin-content-keyed">
          <slot />
        </div>
      {/key}
    </div>
  {/if}
{/if}

<script context="module">
  import { error } from "@sveltejs/kit";

  import { findMatch, registeredPages } from "$lib/PluginManager.js";
  import { base } from "$app/paths";
  import { hasPermission } from "$lib/auth.util.js";


  const layouts = import.meta.glob('$lib/layouts/*.svelte', { eager: true });

  const layoutMap = Object.keys(layouts).reduce((acc, path) => {
    const name = path.split('/').pop().replace('.svelte', '');
    acc[name] = layouts[path];
    return acc;
  }, {});

  function removePrefix(str, prefix) {
    return str.startsWith(prefix) ? str.slice(prefix.length) : str;
  }

  /**
   * @type {import("@sveltejs/kit").PageLoad}
   */
  export async function load(event) {
    const {
      url: { pathname },
      parent,
    } = event;
    const { session: { user } } = await parent();

    const registeredPage = findMatch(registeredPages, removePrefix(pathname, base));

    if (registeredPage === undefined || registeredPage === null) {
      throw error(404);
    }

    if (registeredPage.permission && !hasPermission(registeredPage.permission, user)) {
      throw error(404);
    }

    const resetLayout = registeredPage.resetLayout || false;

    let systemLayout = null;
    let systemLayoutOutput = {};
    if (registeredPage.systemLayout) {
      const systemLayoutModule = layoutMap[registeredPage.systemLayout];
      if (systemLayoutModule) {
        systemLayout = systemLayoutModule.default;
        if (typeof systemLayoutModule.load === 'function') {
          systemLayoutOutput = await systemLayoutModule.load(event);
        }
      }
    }

    let layoutOutput = {};
    let layout = null;
    if (registeredPage.layout) {
      // Check if layout is a function (async import) or object
      const layoutModule =
        typeof registeredPage.layout === 'function'
          ? await registeredPage.layout()
          : registeredPage.layout;
      layout = layoutModule;

      if (layout.load !== undefined) {
        layoutOutput = await layout.load(event);
      }
    }

    const output = {
      registeredPage,
      layout,
      systemLayout,
      props: layoutOutput,
      params: registeredPage.params,
      ...systemLayoutOutput,
      resetLayout
    };

    // Expose layout-consumed fields from the plugin layout's load output
    // at the top level so they end up on page.data (e.g. pageTitle, sidebar).
    if (layoutOutput && typeof layoutOutput === "object") {
      for (const key of ["pageTitle", "breadcrumbs", "sidebar", "sidebarProps"]) {
        if (layoutOutput[key] !== undefined) {
          output[key] = layoutOutput[key];
        }
      }
    }

    return output;
  }
</script>

<script>
  import { mount, unmount, getAllContexts } from 'svelte';
  import { browser } from '$app/environment';

  let { data } = $props();
  const contexts = getAllContexts();

  let layoutContainer = $state();
  let slotContentContainer = $state();
  let layoutInstance = null;
  let activeLayoutComp = null;

  function cleanupLayout() {
    // The slot content was DOM-moved into the layout's anchor. Move it back to its stable parent
    // (the .plugin-content-wrapper -> here, the layout container's host) BEFORE destroying the
    // layout, so Svelte's teardown never unmounts a live <slot> subtree that it doesn't own.
    if (slotContentContainer && layoutContainer && layoutContainer.parentNode) {
      try {
        slotContentContainer.style.display = 'none';
        layoutContainer.parentNode.insertBefore(slotContentContainer, layoutContainer.nextSibling);
      } catch (e) {}
    }
    if (layoutInstance) {
      try {
        if (typeof activeLayoutComp?.unmount === 'function') activeLayoutComp.unmount(layoutInstance);
        else unmount(layoutInstance);
      } catch (e) {}
      layoutInstance = null;
      activeLayoutComp = null;
    }
  }

  // Layout lifecycle: mount the plugin layout into the stable layoutContainer.
  $effect(() => {
    if (!browser || !layoutContainer) return;

    if (!data.layout) {
      cleanupLayout();
      return;
    }

    const layoutComp = data.layout.default || data.layout;
    if (activeLayoutComp !== data.layout) {
      cleanupLayout();
      try {
        if (data.layout.mount) {
          layoutInstance = data.layout.mount({
            target: layoutContainer,
            props: { ...(data.props || {}), panoContexts: contexts },
            context: contexts
          });
        } else {
          layoutInstance = mount(layoutComp, {
            target: layoutContainer,
            props: { ...(data.props || {}), panoContexts: contexts },
            context: contexts
          });
        }
        activeLayoutComp = data.layout;
      } catch (e) {
        console.error('[Layout] Mount failed', e);
      }
    }
  });

  // Teardown on destroy (SSR-safe cleanup pattern for plugin-hosted routes).
  $effect(() => () => cleanupLayout());

  // Slot bridge: move the (stable, un-keyed) slotContentContainer into the layout's anchor, only
  // when it isn't already there, so the live <slot> subtree is never re-parented redundantly.
  $effect(() => {
    const _pageData = data; // dependency: re-run when navigation changes data
    if (!browser) return;

    let rafId;
    const poll = () => {
      if (!slotContentContainer) {
        rafId = requestAnimationFrame(poll);
        return;
      }

      if (!data.layout) {
        slotContentContainer.style.display = '';
        return;
      }

      const anchor = layoutContainer?.querySelector(
        '[data-pano-content], main, .content, .page-content, article',
      );

      if (anchor) {
        if (anchor.lastElementChild !== slotContentContainer) {
          anchor.appendChild(slotContentContainer);
        }
        slotContentContainer.style.display = '';
      } else {
        rafId = requestAnimationFrame(poll);
      }
    };

    poll();
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  });
</script>
