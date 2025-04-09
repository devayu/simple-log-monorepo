"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleLogTracker = void 0;
class SimpleLogTracker {
    // private constructor() {}
    constructor() {
        this.canAutoTrackEvents = false;
        this.isAutoTrackingInitialized = false;
        this.cleanupFn = null;
        this.lastTrackedPath = null;
        this.lastTrackedTime = 0;
        this.deduplicationInterval = 2000; // 2 seconds
        // Restore state from window if available
        if (typeof window !== "undefined" && window.__simpleLogInstance) {
            const cached = window.__simpleLogInstance;
            this.apiKey = cached.apiKey;
            this.endpoint = cached.endpoint;
            this.canAutoTrackEvents = cached.canAutoTrackEvents;
            this.isAutoTrackingInitialized = cached.isAutoTrackingInitialized;
        }
    }
    static getInstance2() {
        if (typeof global !== "undefined" && !global.__simpleLogInstance) {
            global.__simpleLogInstance = new SimpleLogTracker();
        }
        if (!SimpleLogTracker.instance) {
            SimpleLogTracker.instance =
                global.__simpleLogInstance || new SimpleLogTracker();
        }
        return SimpleLogTracker.instance;
    }
    static getInstance() {
        if (!SimpleLogTracker.instance) {
            // Check window first, then global
            if (typeof window !== "undefined" && window.__simpleLogInstance) {
                SimpleLogTracker.instance = window.__simpleLogInstance;
            }
            else if (typeof global !== "undefined" && global.__simpleLogInstance) {
                SimpleLogTracker.instance = global.__simpleLogInstance;
            }
            else {
                SimpleLogTracker.instance = new SimpleLogTracker();
                // Store in both window and global
                if (typeof window !== "undefined") {
                    window.__simpleLogInstance = SimpleLogTracker.instance;
                }
                if (typeof global !== "undefined") {
                    global.__simpleLogInstance = SimpleLogTracker.instance;
                }
            }
        }
        return SimpleLogTracker.instance;
    }
    init(apiKey, initOpts) {
        if (this.apiKey)
            return; // already initialized
        this.apiKey = apiKey;
        this.endpoint = (initOpts === null || initOpts === void 0 ? void 0 : initOpts.endpoint) || "http://localhost:3090";
        this.verifyApiKey().then(() => {
            if ((initOpts === null || initOpts === void 0 ? void 0 : initOpts.autoTrackRoutes) && !this.canAutoTrackEvents) {
                console.info("[SimpleLog SDK] Seems like you are on Basic plan, upgrade to Premium plan to auto track events");
            }
            if ((initOpts === null || initOpts === void 0 ? void 0 : initOpts.autoTrackRoutes) &&
                this.canAutoTrackEvents &&
                !this.isAutoTrackingInitialized) {
                this.cleanupFn = this.setupAutoRouteTracking(initOpts.router);
                this.isAutoTrackingInitialized = true;
            }
        });
    }
    verifyApiKey() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const verifyRes = yield fetch(`${this.endpoint}/verifyProjectKey`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                });
                const res = yield verifyRes.json();
                this.canAutoTrackEvents = res.canAutoTrackEvents;
            }
            catch (err) {
                console.error("[SimpleLog SDK] Failed to verify api key", err);
            }
        });
    }
    trackEvent(event, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.apiKey) {
                console.warn("[SimpleLog SDK] You must call init() first.");
                return;
            }
            const now = Date.now();
            if ((metadata === null || metadata === void 0 ? void 0 : metadata.path) === this.lastTrackedPath &&
                now - this.lastTrackedTime < this.deduplicationInterval) {
                return;
            }
            this.lastTrackedPath = metadata === null || metadata === void 0 ? void 0 : metadata.path;
            this.lastTrackedTime = now;
            const isClient = typeof window !== "undefined" && typeof navigator !== "undefined";
            const body = {
                event: event,
                metadata: metadata,
                timestamp: new Date().toISOString(),
                url: isClient ? window === null || window === void 0 ? void 0 : window.location.href : undefined,
                userAgent: isClient ? navigator.userAgent : undefined,
            };
            try {
                yield fetch(`${this.endpoint}/trackEvent`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    body: JSON.stringify(body),
                });
            }
            catch (err) {
                console.error("[SimpleLog SDK] Failed to track event", err);
            }
        });
    }
    setupAutoRouteTracking(router) {
        let eventName = "changed";
        const navType = performance.getEntriesByType("navigation")[0].type;
        if (navType) {
            eventName = navType;
        }
        const track = (path) => {
            this.trackEvent(`route_${eventName}`, {
                path,
                timestamp: new Date().toISOString(),
            });
        };
        // ✅ Next.js Router
        if (router && "events" in router) {
            const handler = (url) => track(url);
            router.events.on("routeChangeComplete", handler);
            return () => {
                router.events.off("routeChangeComplete", handler);
            };
        }
        // ✅ React Router
        if (router && "listen" in router) {
            const unlisten = router.listen((location) => {
                track(location.pathname);
            });
            return unlisten;
        }
        if (typeof window === "undefined")
            return () => { };
        // ✅ Vanilla
        const trackIfChanged = () => {
            track(window.location.pathname);
        };
        const patchHistoryMethod = (type) => {
            const original = history[type];
            history[type] = function (...args) {
                const result = original.apply(this, args);
                window.dispatchEvent(new Event(type));
                return result;
            };
        };
        patchHistoryMethod("pushState");
        patchHistoryMethod("replaceState");
        window.addEventListener("popstate", trackIfChanged);
        window.addEventListener("pushState", trackIfChanged);
        window.addEventListener("replaceState", trackIfChanged);
        trackIfChanged(); // Initial call
        return () => {
            window.removeEventListener("popstate", trackIfChanged);
            window.removeEventListener("pushState", trackIfChanged);
            window.removeEventListener("replaceState", trackIfChanged);
        };
    }
    destroy() {
        if (this.cleanupFn) {
            this.cleanupFn();
            this.cleanupFn = null;
        }
        this.apiKey = "";
        this.endpoint = "";
        this.isAutoTrackingInitialized = false;
        this.lastTrackedPath = "";
    }
}
exports.SimpleLogTracker = SimpleLogTracker;
SimpleLogTracker.instance = null;
