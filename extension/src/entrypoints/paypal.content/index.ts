import { mount, unmount } from "svelte";

import App from "./App.svelte";
import "./style.css";

const SHADOW_ROOT_NAME = "minimum-paypal-example";

export default defineContentScript({
  cssInjectionMode: "ui",
  matches: ["https://*/*"],
  async main(ctx) {
    const shadowRootUi = await createShadowRootUi(ctx, {
      anchor: "body",
      name: SHADOW_ROOT_NAME,
      onMount: container => mount(App, { target: container }),
      onRemove: app => app && void unmount(app),
      position: "inline"
    });

    shadowRootUi.mount();
  }
});
