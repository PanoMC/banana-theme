import fs from "fs";
import path from "path";

/** @type {import("@sveltejs/kit").RequestHandler} */
export async function GET({ params }) {
  const { language } = params;

  // The [language] route param is attacker-controlled and unauthenticated. Strip any path
  // components so it can only ever name a file inside the lang directory, then confirm the
  // resolved path is still contained within that directory before reading it.
  const safe = path.basename(language) + ".json";

  const primaryDir = path.resolve("lang");
  let filePath = path.resolve(primaryDir, safe);
  if (!filePath.startsWith(primaryDir + path.sep)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!fs.existsSync(filePath)) {
    const fallbackDir = path.resolve(path.dirname(process.argv[1]), "lang");
    filePath = path.resolve(fallbackDir, safe);
    if (!filePath.startsWith(fallbackDir + path.sep)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    return new Response(fileContent, {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } else {
    return new Response(JSON.stringify({ error: "Language file not found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
}
