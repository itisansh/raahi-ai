import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

it("keeps SQL and Worker adapters out of the Node runtime import graph", () => {
  const visited = new Set<string>();
  const externals = new Set<string>();
  function walk(file: string) {
    if (visited.has(file)) return;
    visited.add(file);
    expect(file).not.toMatch(/\/legacy\/|\/repositories\/(sql\/|pool\.|prisma\.)|\.db\.ts$/);
    const output = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, fileName: file,
    }).outputText;
    const ast = ts.createSourceFile(file, output, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
    function visit(node: ts.Node) {
      const specifier = (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) ? node.moduleSpecifier
        : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : undefined;
      if (specifier && ts.isStringLiteral(specifier)) {
        const name = specifier.text;
        if (!name.startsWith(".")) externals.add(name);
        else {
          const base = resolve(dirname(file), name);
          const target = [base + ".ts", base + "/index.ts", base].find(existsSync);
          if (!target) throw new Error(`Unresolved runtime import: ${name} in ${file}`);
          walk(target);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  walk(resolve("src/server.ts"));
  expect(visited.size).toBeGreaterThan(50);
  expect([...externals].filter(name => /^(hono|@hono\/|@prisma\/|pg$|mysql2|@sentry\/(hono|cloudflare)|cloudflare:)/.test(name))).toEqual([]);
});
