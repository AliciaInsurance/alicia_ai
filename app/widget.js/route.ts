import { NextResponse } from "next/server";
import { getPublicAppUrl } from "@/lib/env";

export async function GET() {
  const appUrl = getPublicAppUrl().replace(/\/$/, "");

  const script = `
(function () {
  var current = document.currentScript;
  if (!current) return;
  var assistant = current.getAttribute("data-assistant");
  if (!assistant) {
    console.error("[Alicia AI] Missing data-assistant attribute");
    return;
  }
  var primary = current.getAttribute("data-primary-color") || "";
  var appUrl = ${JSON.stringify(appUrl)};

  if (document.getElementById("alicia-ai-root")) return;

  var root = document.createElement("div");
  root.id = "alicia-ai-root";
  document.body.appendChild(root);

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Open Alicia chat");
  launcher.style.cssText =
    "position:fixed;bottom:20px;right:20px;width:56px;height:56px;border-radius:9999px;border:none;cursor:pointer;box-shadow:0 8px 24px rgba(15,23,42,0.18);background:#0f766e;color:#fff;font-weight:600;z-index:2147483000;";
  launcher.textContent = "A";

  var panel = document.createElement("iframe");
  panel.title = "Alicia AI chat";
  panel.style.cssText =
    "position:fixed;bottom:88px;right:20px;width:min(400px,calc(100vw - 24px));height:min(560px,calc(100vh - 120px));border:none;border-radius:16px;box-shadow:0 16px 40px rgba(15,23,42,0.22);display:none;z-index:2147483000;background:#fff;";
  panel.src = appUrl + "/embed/chat?assistant=" + encodeURIComponent(assistant) +
    (primary ? "&primary=" + encodeURIComponent(primary) : "");

  launcher.addEventListener("click", function () {
    var open = panel.style.display !== "none";
    panel.style.display = open ? "none" : "block";
  });

  root.appendChild(panel);
  root.appendChild(launcher);
})();
`.trim();

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
