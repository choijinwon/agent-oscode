# npm release

The package already exposes `oscode` through `bin/oscode.js`.
Version 0.9.0 is published as `@choijinwon/oscode`. Users
can run `npx @choijinwon/oscode --demo` or `npx @choijinwon/oscode --agent frontend --model MODEL`.
The unscoped name was rejected by npm for similarity to existing packages.

Publisher steps (Node.js 22 or newer):

```sh
npm login --registry=https://registry.npmjs.org
npm whoami --registry=https://registry.npmjs.org
npm publish
```

`publishConfig` fixes the public npm registry and public access. `prepublishOnly`
runs syntax checks and the full test suite before normal publication. Tests need
Playwright Chromium; see the development setup in the README. npm may require
additional browser/2FA verification at publish time. Never commit or share tokens.

Verify the published package rather than assuming a successful login published it:

```sh
npm view @choijinwon/oscode version repository.url --registry=https://registry.npmjs.org
npx @choijinwon/oscode --demo
```

Each published version is immutable. Future releases require an updated version
and lockfile. The documented GitHub-package npx command also remains available.
