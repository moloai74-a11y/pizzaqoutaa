/**
 * سيرفر محلي بسيط لمعاينة موقع بيتزا قوطة.
 * لا يحتاج إلى أي حزم خارجية: node server.js
 */
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const rootDirectory = __dirname;
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8"
};

function sendNotFound(response) {
  response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
  response.end("<!doctype html><html lang='ar' dir='rtl'><meta charset='utf-8'><title>غير موجود</title><body style='font-family:sans-serif;padding:40px'><h1>الصفحة غير موجودة</h1><p><a href='/'>ارجع للموقع</a></p></body></html>");
}

const server = http.createServer((request, response) => {
  if (!["GET", "HEAD"].includes(request.method || "GET")) {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8", Allow: "GET, HEAD" });
    response.end("Method Not Allowed");
    return;
  }

  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  let pathname;

  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch (error) {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad Request");
    return;
  }

  if (pathname === "/") {
    pathname = "/index.html";
  }

  const filePath = path.resolve(rootDirectory, `.${pathname}`);
  const rootPrefix = rootDirectory.endsWith(path.sep) ? rootDirectory : rootDirectory + path.sep;

  if (filePath !== rootDirectory && !filePath.startsWith(rootPrefix)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendNotFound(response);
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extension] || "application/octet-stream";
    const headers = {
      "Content-Type": contentType,
      "Content-Length": stats.size,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    };

    response.writeHead(200, headers);

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on("error", () => {
      if (!response.headersSent) {
        response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      }
      response.end("Server Error");
    });
    stream.pipe(response);
  });
});

server.listen(port, host, () => {
  console.log(`بيتزا قوطة شغال على: http://${host}:${port}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`المنفذ ${port} مشغول. جرّب PORT=4180 npm start`);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
