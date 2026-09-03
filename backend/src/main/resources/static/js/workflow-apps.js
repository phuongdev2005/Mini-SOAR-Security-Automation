/**
 * Mini-SOAR Org Apps Management & Custom App Integration
 */

class AppManager {
  constructor() {
    this.apps = JSON.parse(JSON.stringify(DEFAULT_APPS));
  }

  async fetchAppsFromBackend() {
    try {
      const res = await fetch("/api/v1/apps", { credentials: "same-origin" });
      if (res.ok) {
        const backendApps = await res.json();
        if (Array.isArray(backendApps) && backendApps.length > 0) {
          // Merge user-created custom apps only
          backendApps.forEach(bApp => {
            if (bApp.id && bApp.id.startsWith("app-custom")) {
              const exists = this.apps.some(a => a.id === bApp.id);
              if (!exists) {
                this.apps.push({
                  id: bApp.id,
                  name: bApp.name,
                  category: bApp.category || "Custom Apps",
                  badge: "badge-action",
                  type: "action",
                  image: bApp.large_image || "/images/apps/generic.svg",
                  description: bApp.description || "",
                  actions: bApp.actions || []
                });
              }
            }
          });
        }
      }
    } catch (err) {
      console.warn("Using default apps catalog:", err);
    }
  }

  getAllApps() {
    return this.apps;
  }

  getApp(appId) {
    return this.apps.find(a => a.id === appId);
  }

  async createCustomApp(newAppData) {
    const app = {
      id: newAppData.id || `app-custom-${Date.now().toString(36)}`,
      name: newAppData.name,
      category: newAppData.category || "Custom Apps",
      badge: "badge-action",
      type: "action",
      image: newAppData.image || "/images/apps/generic.svg",
      description: newAppData.description || "",
      actions: newAppData.actions || []
    };

    // Sync with backend
    try {
      const token = localStorage.getItem("soar_token") || "";
      const res = await fetch("/api/v1/apps", {
        method: "POST",
        headers: token
          ? { "Content-Type": "application/json", "X-SOAR-SESSION-TOKEN": token }
          : { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(app)
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e) {
      console.error("Failed to sync new app to backend:", e);
      throw e;
    }

    this.apps.push(app);
    return app;
  }
}

window.appManager = new AppManager();
