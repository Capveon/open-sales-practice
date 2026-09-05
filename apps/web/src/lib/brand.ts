export function publicBrand() {
  const appName =
    process.env.NEXT_PUBLIC_OSP_APP_NAME?.trim() ||
    process.env.OSP_APP_NAME?.trim() ||
    "Open Sales Practice";
  return {
    appName,
    product: process.env.NEXT_PUBLIC_OSP_PRODUCT?.trim() || "Practice",
    tagline:
      process.env.NEXT_PUBLIC_OSP_TAGLINE?.trim() ||
      "Live buyer calls. YAML personas. Scored tapes.",
    mark: process.env.NEXT_PUBLIC_OSP_MARK === "arch" ? ("arch" as const) : ("none" as const),
  };
}
