import path from "path";
import fs from "fs";
import mime from "mime-types";

/** @type {import("@sveltejs/kit").RequestHandler} */
export async function GET({ params }) {
  const { pluginId, fileName } = params;

  // Ensure pluginId and fileName are safe and sanitize inputs
  if (!pluginId || !fileName || typeof pluginId !== "string" || typeof fileName !== "string") {
    return new Response("Invalid parameters.", { status: 400 });
  }

  // Sanitize pluginId and fileName to prevent directory traversal
  const safePluginId = path.basename(pluginId); // Prevent directory traversal by using only the base name
  const safeFileName = path.basename(fileName); // Same for fileName

  // Construct the absolute file path
  const filePath = path.resolve(`plugins/${safePluginId}/client/${safeFileName}`);

  // Ensure the resolved file is contained within the plugin's client directory. path.resolve
  // strips trailing slashes, so appending path.sep is required — without it, a sibling directory
  // like ".../client-evil" would still satisfy a bare startsWith(".../client") prefix check.
  const baseDir = path.resolve(`plugins/${safePluginId}/client`) + path.sep;
  if (!filePath.startsWith(baseDir)) {
    return new Response("Access to this file is forbidden.", { status: 403 });
  }

  try {
    const data = fs.readFileSync(filePath);

    // Use mime-types to automatically determine the content type
    const contentType = mime.lookup(fileName) || "application/octet-stream"; // Default to 'application/octet-stream' if mime type is unknown

    const headers = { "Content-Type": contentType };

    // Content-hashed chunks (e.g. "Foo-a1b2c3d4.js" / ".mjs") are immutable — their URL changes
    // whenever their content does — so they can be cached forever. The unhashed entrypoint
    // ("client.mjs") must be revalidated each load so a new build is picked up immediately.
    const isHashedChunk = /-[0-9a-f]{6,}\.(?:js|mjs)$/i.test(safeFileName);
    if (isHashedChunk) {
      headers["Cache-Control"] = "public, max-age=31536000, immutable";
    } else {
      headers["Cache-Control"] = "no-cache";
      // Trivial, cheap ETag so revalidation can short-circuit with a 304 when unchanged.
      headers["ETag"] = `"${data.length.toString(16)}-${path.basename(safeFileName)}"`;
    }

    return new Response(data, { headers });
  } catch {
    return new Response("File not found or unable to read.", { status: 404 });
  }
}
