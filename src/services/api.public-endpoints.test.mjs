import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadApiModule() {
  const filePath = path.join(__dirname, "api.ts");
  const source = fs.readFileSync(filePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const apiExports = {};
  const context = vm.createContext({
    exports: apiExports,
    console,
    Headers,
    Error,
    JSON,
    Promise,
    TypeError,
    atob,
    btoa,
    fetch: (...args) => context.fetch(...args),
    localStorage: {
      values: new Map(),
      getItem(key) {
        return this.values.get(key) ?? null;
      },
      setItem(key, value) {
        this.values.set(key, String(value));
      },
      removeItem(key) {
        this.values.delete(key);
      },
    },
    window: {
      location: {
        pathname: "/login",
        replace() {},
      },
    },
  });

  vm.runInContext(outputText, context, { filename: filePath });

  return { apiModule: apiExports, context };
}

test("login skips stale session refresh and posts credentials directly", async () => {
  const { apiModule, context } = loadApiModule();
  const calls = [];

  context.localStorage.setItem("token", "expired-token");
  context.localStorage.setItem("refreshToken", "stale-refresh-token");
  context.fetch = async (url, init) => {
    calls.push({ url, init });

    if (url.endsWith("/users/refresh")) {
      return new Response(JSON.stringify({ message: "refresh rejected" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.endsWith("/users/login")) {
      return new Response(
        JSON.stringify({
          token: "new-access-token",
          refreshToken: "new-refresh-token",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const result = await apiModule.api("/users/login", "POST", {
    email: "admin@gmail.com",
    password: "secret",
  });

  assert.equal(result.token, "new-access-token");
  assert.deepEqual(
    calls.map((call) => call.url),
    ["http://localhost:3000/users/login"],
  );
});

test("login shows backend credential error instead of session-expired message", async () => {
  const { apiModule, context } = loadApiModule();

  context.fetch = async (url) => {
    assert.equal(url, "http://localhost:3000/users/login");

    return new Response(
      JSON.stringify({ message: "Email hoặc mật khẩu không đúng" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  await assert.rejects(
    () =>
      apiModule.api("/users/login", "POST", {
        email: "admin@gmail.com",
        password: "wrong-password",
      }),
    /Email hoặc mật khẩu không đúng/,
  );
});
