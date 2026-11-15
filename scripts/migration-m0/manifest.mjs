import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const sourcePath = 'apps/api/src/interfaces/http/app.ts';
const source = readFileSync(sourcePath, 'utf8');
const ast = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true);
const prefixes = { app: '', guard: '/api', agent: '/api/trips/:tripId/agent' };
const routes = [];
function visit(node) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const receiver = node.expression.expression.getText(ast);
    const method = node.expression.name.text;
    if (receiver in prefixes && ['get', 'post', 'put', 'patch', 'delete', 'on'].includes(method)) {
      const path = node.arguments[method === 'on' ? 1 : 0];
      if (!path || !ts.isStringLiteral(path)) throw new Error('Unresolved route path');
      const methods = method === 'on' ? node.arguments[0].elements.map(e => e.text) : [method.toUpperCase()];
      for (const verb of methods) routes.push({ method: verb, path: prefixes[receiver] + path.text,
        source: sourcePath, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1,
        authentication: receiver === 'app' ? 'handler-specific' : 'session-required' });
    }
  }
  ts.forEachChild(node, visit);
}
visit(ast);
routes.push({ method: 'GET', path: '/api/trips/:tripId/realtime', source: 'apps/api/src/legacy/worker.ts',
  authentication: 'origin/session/membership on WebSocket upgrade', runtime: 'Cloudflare only' });
const schema = readFileSync('apps/api/prisma/schema.prisma', 'utf8');
const models = [...schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)].map(([, name, body]) => ({
  name, definitions: body.split('\n').map(line => line.trim()).filter(Boolean),
}));
const migrations = readdirSync('apps/api/prisma/migrations', { withFileTypes: true })
  .filter(entry => entry.isDirectory()).map(entry => {
    const path = `apps/api/prisma/migrations/${entry.name}/migration.sql`;
    const sql = readFileSync(path, 'utf8');
    return { path, sha256: createHash('sha256').update(sql).digest('hex'),
      statements: sql.replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(Boolean) };
  });
const manifest = { sourceSha256: createHash('sha256').update(source).digest('hex'),
  schemaSha256: createHash('sha256').update(schema).digest('hex'),
  scope: 'Static HTTP registrations and committed Prisma snapshot; auth wildcard delegates to Better Auth. Live catalog and SQL-only constraints require separate inspection.',
  routes, models, migrations };
writeFileSync('docs/raahi/M0_ROUTE_DATA_MANIFEST.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`Recorded ${routes.length} method/path entries and ${models.length} schema models`);
