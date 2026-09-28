import { handleFeedback } from "./feedback.js";

function isFeedbackPath(pathname) {
  return pathname === "/api/feedback" || pathname === "/api/feedback/";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (isFeedbackPath(url.pathname)) {
      return handleFeedback(request, env);
    }

    if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return new Response("Not found", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
