# npm release

The package already exposes `oscode` through `bin/oscode.js`.
Once version 0.9.0 is successfully published to the public npm registry, users
can run `npx oscode --demo` or `npx oscode --agent frontend --model MODEL`.
These short commands are not available until publication is confirmed.

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
npm view oscode version repository.url --registry=https://registry.npmjs.org
npx oscode --demo
```

Each published version is immutable. Future releases require an updated version
and lockfile. Until initial publication, the documented GitHub-package npx command
remains available.
