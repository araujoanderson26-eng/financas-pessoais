/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { advisorApi } from "./advisor";

import { financeApi, backupApi } from "./finance";
import { authenticate, authorize, type IdentityEnv } from "./identity";
import { apiFailure, privateResponse } from "./http";

interface Env extends Cloudflare.Env, IdentityEnv {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  AI_PROVIDER?: string;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const imageFormat = format === "image/avif" || format === "image/webp" || format === "image/png" ? format : "image/jpeg";
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format: imageFormat, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (url.pathname.startsWith("/api/")) {
      try {
        const principal = await authenticate(request, env);
        authorize(principal, url.pathname === "/api/backup" ? "finance:export" : url.pathname === "/api/advisor" ? "finance:advisor" : request.method === "GET" ? "finance:read" : "finance:write");
        let response: Response;
        if (url.pathname === "/api/finance") response = await financeApi(request, env, principal.owner);
        else if (url.pathname === "/api/backup") response = await backupApi(request, env, principal.owner);
        else if (url.pathname === "/api/advisor") response = await advisorApi(request, env, principal.owner);
        else response = Response.json({ error: "Rota não encontrada." }, { status: 404 });
        return privateResponse(response);
      } catch (error) { return privateResponse(apiFailure(error)); }
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
