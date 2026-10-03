/**
 * Probe every route on the local production server over a raw socket.
 *
 * `curl` to localhost is unreliable in this environment, so this speaks HTTP/1.1
 * directly and asserts the status line for each route.
 */
import { request } from "node:http";

const PORT = Number(process.argv[2] ?? 3123);
const ROUTES = ["/", "/tcp", "/udp", "/http", "/https", "/i2c", "/can"];
const EXPECTED_404 = ["/bogus", "/protocol", "/protocol/tcp"];

function probe(path) {
  return new Promise((resolve) => {
    const req = request(
      { host: "127.0.0.1", port: PORT, path, method: "GET", headers: { Host: "localhost" } },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body, headers: res.headers }));
      },
    );
    req.on("error", (e) => resolve({ status: 0, body: "", error: e.message }));
    req.end();
  });
}

let fails = 0;
console.log(`Probing http://127.0.0.1:${PORT}\n`);

for (const route of ROUTES) {
  const res = await probe(route);
  const ok = res.status === 200;
  if (!ok) fails += 1;
  const bytes = res.body.length;
  console.log(`${ok ? "PASS" : "FAIL"}  ${String(res.status).padEnd(4)} ${route.padEnd(9)} ${bytes} bytes`);
}

console.log("");
for (const route of EXPECTED_404) {
  const res = await probe(route);
  const ok = res.status === 404;
  if (!ok) fails += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${String(res.status).padEnd(4)} ${route.padEnd(16)} (expect 404 - no such route)`,
  );
}

// The served CSS must be reachable at the origin root.
console.log("");
const home = await probe("/");
const cssHref = /href="(\/_next\/static\/css\/[^"]+)"/.exec(home.body)?.[1];
if (!cssHref) {
  fails += 1;
  console.log("FAIL  could not find a stylesheet link in /");
} else {
  const css = await probe(cssHref);
  const ok = css.status === 200 && css.body.length > 10_000;
  if (!ok) fails += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${String(css.status).padEnd(4)} ${cssHref} (${css.body.length} bytes)`);
}

console.log(`\n${fails === 0 ? "OK" : `${fails} FAILURE(S)`}`);
process.exit(fails === 0 ? 0 : 1);
