import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// The plugin builds against the local dsh v0.1.5-rc.1 checkout: every
// @deepseek-ai import resolves through the linked devDependencies (junctions
// into the dsh source tree — see the README Development section), whose lib
// entries are plain ESM.
const local = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      // The test graph imports these /client entries at runtime; their lib
      // entries are window.__ModuleLoader__ browser closures, so point the
      // subpaths at the linked packages' TypeScript sources instead.
      { find: /^@deepseek-ai\/dsh-client-ui-renderer\/client$/, replacement: local('../dsh/packages/client/ui-renderer/src/client/index.ts') },
      { find: /^@deepseek-ai\/dsh-client-ui-session\/client$/, replacement: local('../dsh/packages/client/ui-session/src/client/index.ts') },
      { find: /^@deepseek-ai\/dsh-client-ui-conversation\/client$/, replacement: local('../dsh/packages/client/ui-conversation/src/client/index.ts') },
      { find: /^@deepseek-ai\/dsh-client-ui-chat\/client$/, replacement: local('../dsh/packages/client/ui-chat/src/client/index.ts') },
      { find: /^@deepseek-ai\/dsh-client-locale\/client$/, replacement: local('../dsh/packages/client/locale/src/client/index.ts') },
      { find: /^@deepseek-ai\/dsh-client-connection\/client$/, replacement: local('../dsh/packages/client/connection/src/client/index.ts') },
      { find: /^@deepseek-ai\/dsh-api-session-controller\/client$/, replacement: local('../dsh/packages/api/session-controller/src/client/index.ts') },
      { find: /^@deepseek-ai\/dsh-api-workspace-controller\/client$/, replacement: local('../dsh/packages/api/workspace-controller/src/client/index.ts') },
      { find: /^@deepseek-ai\/dsh-api-remotes\/client$/, replacement: local('../dsh/packages/api/remotes/src/client/index.ts') },
      { find: /^@deepseek-ai\/dsh-api-gateway\/client$/, replacement: local('../dsh/packages/api/gateway/src/client/index.ts') },
      // The linked dsh packages and this package's own modules must share one
      // cordis instance (cosmokit resolves naturally from each importer's own
      // dependency closure).
      { find: /^@deepseek-ai\/cordis$/, replacement: local('node_modules/@deepseek-ai/cordis') },
      // Pin the react family (and its uSES shim) to this package's instances
      // so the test runtime and the rendered components share one React.
      { find: /^react$/, replacement: local('node_modules/react') },
      { find: /^react\/jsx-runtime$/, replacement: local('node_modules/react/jsx-runtime') },
      { find: /^react-dom$/, replacement: local('node_modules/react-dom') },
      { find: /^react-dom\/client$/, replacement: local('node_modules/react-dom/client') },
      { find: /^use-sync-external-store$/, replacement: local('node_modules/use-sync-external-store') },
      { find: /^use-sync-external-store\/shim/, replacement: local('node_modules/use-sync-external-store/shim') },
    ],
  },
  server: {
    fs: {
      // The linked @deepseek-ai packages resolve into the dsh source tree;
      // let vite serve and transform them.
      allow: [local('../dsh')],
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    server: {
      deps: {
        // Inline the @deepseek-ai packages so vite resolves them through the
        // aliases above and the react-family pins apply inside the inlined
        // graph (one React instance).
        inline: [/@deepseek-ai\//],
      },
    },
  },
})
