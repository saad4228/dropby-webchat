// Local-only Supabase contract fixture. Never use its dummy key for a real project.
import http from "node:http";
import { randomUUID } from "node:crypto";
const objects = new Map(),
  transfers = new Map(),
  signatures = new Map();
let failDelete = false;
async function bytes(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1:7799"),
      path = decodeURIComponent(url.pathname);
    const send = (status, data, headers = {}) => {
      response.writeHead(status, {
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...headers,
      });
      response.end(data ? JSON.stringify(data) : undefined);
    };
    if (path === "/__fixture") {
      if (request.method === "POST") {
        const body = JSON.parse((await bytes(request)).toString());
        failDelete = !!body.failDelete;
      }
      send(200, { objects: objects.size, transfers: transfers.size });
      return;
    }
    const root = "/storage/v1";
    if (path === root + "/bucket/dropby-media") {
      send(200, { id: "dropby-media", public: false });
      return;
    }
    if (path.startsWith(root + "/object/upload/sign/")) {
      const object = path.slice(
        (root + "/object/upload/sign/dropby-media/").length,
      );
      const token = randomUUID();
      signatures.set(token, object);
      send(200, {
        url: "/object/upload/sign/dropby-media/" + object + "?token=" + token,
      });
      return;
    }
    if (path === root + "/upload/resumable" && request.method === "POST") {
      const metadata = Object.fromEntries(
        String(request.headers["upload-metadata"])
          .split(",")
          .map((value) => {
            const [k, v] = value.split(" ");
            return [k, Buffer.from(v, "base64").toString()];
          }),
      );
      const id = randomUUID();
      transfers.set(id, {
        path: metadata.objectName,
        mime: metadata.contentType,
        size: Number(request.headers["upload-length"]),
        bytes: Buffer.alloc(0),
      });
      send(201, null, {
        Location: "http://127.0.0.1:7799/transfers/" + id,
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": "0",
      });
      return;
    }
    if (path.startsWith("/transfers/")) {
      const id = path.split("/").at(-1),
        transfer = transfers.get(id);
      if (!transfer) {
        send(404);
        return;
      }
      if (request.method === "DELETE") {
        transfers.delete(id);
        send(204);
        return;
      }
      if (request.method === "HEAD") {
        send(200, null, {
          "Upload-Offset": String(transfer.bytes.length),
          "Upload-Length": String(transfer.size),
        });
        return;
      }
      if (request.method === "PATCH") {
        if (
          Number(request.headers["upload-offset"]) !== transfer.bytes.length
        ) {
          send(409);
          return;
        }
        transfer.bytes = Buffer.concat([transfer.bytes, await bytes(request)]);
        if (transfer.bytes.length === transfer.size)
          objects.set(transfer.path, {
            bytes: transfer.bytes,
            mime: transfer.mime,
          });
        send(204, null, { "Upload-Offset": String(transfer.bytes.length) });
        return;
      }
    }
    const info = root + "/object/info/authenticated/dropby-media/",
      download = root + "/object/authenticated/dropby-media/",
      objectRoot = root + "/object/dropby-media";
    if (path.startsWith(info)) {
      const object = objects.get(path.slice(info.length));
      send(
        object ? 200 : 400,
        object
          ? { size: object.bytes.length, contentType: object.mime }
          : { code: "NoSuchKey", statusCode: "404" },
      );
      return;
    }
    if (path.startsWith(root + "/object/sign/dropby-media/")) {
      send(200, { signedURL: path.slice(root.length) + "?token=fixture-read" });
      return;
    }
    if (path === objectRoot && request.method === "DELETE") {
      if (failDelete) {
        send(503, { error: "Simulated provider outage" });
        return;
      }
      const body = JSON.parse((await bytes(request)).toString());
      for (const prefix of body.prefixes) objects.delete(prefix);
      send(200, []);
      return;
    }
    if (path.startsWith(objectRoot + "/") && request.method === "POST") {
      const key = path.slice(objectRoot.length + 1);
      if (objects.has(key)) {
        send(409, { error: "Already exists" });
        return;
      }
      objects.set(key, {
        bytes: await bytes(request),
        mime: request.headers["content-type"],
      });
      send(200, { Key: key });
      return;
    }
    if (path.startsWith(download)) {
      const object = objects.get(path.slice(download.length));
      if (!object) {
        send(400, { code: "NoSuchKey", statusCode: "404" });
        return;
      }
      const range = /bytes=(\d+)-(\d*)/.exec(String(request.headers.range));
      const start = range ? Number(range[1]) : 0,
        end =
          range && range[2]
            ? Math.min(Number(range[2]), object.bytes.length - 1)
            : object.bytes.length - 1;
      response.writeHead(range ? 206 : 200, {
        "Content-Type": object.mime,
        "Content-Length": end - start + 1,
        ...(range
          ? { "Content-Range": `bytes ${start}-${end}/${object.bytes.length}` }
          : {}),
      });
      response.end(object.bytes.subarray(start, end + 1));
      return;
    }
    send(404, { error: "Fixture route not found" });
  } catch {
    response.writeHead(500);
    response.end("Fixture error");
  }
});
server.listen(7799, "127.0.0.1", () =>
  console.log("Local storage fixture ready on port 7799."),
);
