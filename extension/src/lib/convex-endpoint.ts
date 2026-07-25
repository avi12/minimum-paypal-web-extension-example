const CONVEX_CLOUD_SUFFIX = ".convex.cloud";
const CONVEX_SITE_SUFFIX = ".convex.site";

export function getConvexSiteUrl(convexUrl: string) {
  const url = new URL(convexUrl);

  if (url.hostname.endsWith(CONVEX_CLOUD_SUFFIX)) {
    url.hostname = `${url.hostname.slice(0, -CONVEX_CLOUD_SUFFIX.length)}${CONVEX_SITE_SUFFIX}`;
    return url.origin;
  }

  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
    if (url.port !== "3210") {
      throw new Error("Local Convex URL must use port 3210");
    }
    url.port = "3211";
    return url.origin;
  }

  throw new Error("WXT_CONVEX_URL must be a Convex cloud or local deployment URL");
}
