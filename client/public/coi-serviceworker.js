/*! coi-serviceworker v0.1.7 - Modified for selective COI */
/*! Original by Guido Zuidhof and contributors, licensed under MIT */
/*! Modified to skip COI headers for main document to allow third-party iframes */

let coepCredentialless = true;

if (typeof window === 'undefined') {
  // Service Worker context
  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
  
  self.addEventListener("message", (e) => {
    if (e.data) {
      if (e.data.type === "deregister") {
        self.registration.unregister().then(() => self.clients.matchAll()).then((clients) => {
          clients.forEach((client) => client.navigate(client.url));
        });
      } else if (e.data.type === "coepCredentialless") {
        coepCredentialless = e.data.value;
      }
    }
  });
  
  self.addEventListener("fetch", function(e) {
    const request = e.request;
    
    // Skip cache-only requests
    if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
      return;
    }
    
    // Skip navigation requests (main document) - let them load without COI headers
    // This allows third-party iframes like Rumble to work
    if (request.mode === "navigate") {
      return;
    }
    
    // Skip third-party requests
    const requestUrl = new URL(request.url);
    if (requestUrl.origin !== self.location.origin) {
      return;
    }
    
    // Only add COI headers to same-origin non-navigation requests
    const modifiedRequest = coepCredentialless && request.mode === "no-cors" 
      ? new Request(request, { credentials: "omit" }) 
      : request;
    
    e.respondWith(
      fetch(modifiedRequest).then((response) => {
        if (response.status === 0) return response;
        
        const headers = new Headers(response.headers);
        headers.set("Cross-Origin-Embedder-Policy", coepCredentialless ? "credentialless" : "require-corp");
        if (!coepCredentialless) {
          headers.set("Cross-Origin-Resource-Policy", "cross-origin");
        }
        headers.set("Cross-Origin-Opener-Policy", "same-origin");
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: headers
        });
      }).catch((err) => console.error(err))
    );
  });
} else {
  // Window context - registration logic
  const config = {
    shouldRegister: () => true,
    shouldDeregister: () => false,
    coepCredentialless: () => !(window.chrome || window.netscape),
    doReload: () => window.location.reload(),
    quiet: false,
    ...window.coi
  };
  
  const nav = navigator;
  
  if (nav.serviceWorker && nav.serviceWorker.controller) {
    nav.serviceWorker.controller.postMessage({
      type: "coepCredentialless",
      value: config.coepCredentialless()
    });
    
    if (config.shouldDeregister()) {
      nav.serviceWorker.controller.postMessage({ type: "deregister" });
    }
  }
  
  // Only register if not already cross-origin isolated
  if (window.crossOriginIsolated === false && config.shouldRegister()) {
    if (window.isSecureContext) {
      if (nav.serviceWorker) {
        nav.serviceWorker.register(window.document.currentScript.src).then((registration) => {
          if (!config.quiet) {
            console.log("COOP/COEP Service Worker registered", registration.scope);
          }
          
          registration.addEventListener("updatefound", () => {
            if (!config.quiet) {
              console.log("Reloading page to make use of updated COOP/COEP Service Worker.");
            }
            config.doReload();
          });
          
          if (registration.active && !nav.serviceWorker.controller) {
            if (!config.quiet) {
              console.log("Reloading page to make use of COOP/COEP Service Worker.");
            }
            config.doReload();
          }
        }).catch((err) => {
          if (!config.quiet) {
            console.error("COOP/COEP Service Worker registration failed:", err);
          }
        });
      }
    } else if (!config.quiet) {
      console.log("COOP/COEP Service Worker not registered: not in a secure context.");
    }
  }
}
