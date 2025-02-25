// @ts-check
const EagerlyLoadChunksRuntimeModule = require('./RuntimeModules/EagerlyLoadChunks')
module.exports = class MV3ServiceWorkerPlugin {
  /** @param {import('../..').BackgroundOptions} options */
  constructor(options) {
    this.options = options
  }
  /** @param {import('webpack').Compiler} compiler */
  apply(compiler) {
    // Set chunkLoading to import-scripts
    compiler.hooks.entryOption.tap(MV3ServiceWorkerPlugin.name, (context, entries) => {
      if (typeof entries === 'function') {
        if (this.options.noWarningDynamicEntry) return
        console.warn(`[webpack-extension-target] Dynamic entry points not supported yet.
You must manually set the chuck loading of entry point ${this.options.entry} to "import-scripts".

See https://webpack.js.org/configuration/entry-context/#entry-descriptor

Set serviceWorker.noWarningDynamicEntry to true to disable this warning.
    `)
      }
      const selectedEntry = entries[this.options.entry]
      if (!selectedEntry) throw new Error(`[webpack-extension-target] There is no entry called ${this.options.entry}.`)
      selectedEntry.chunkLoading = 'import-scripts'
    })

    // Set all lazy chunks to eagerly loaded
    // See https://bugs.chromium.org/p/chromium/issues/detail?id=1198822
    if (this.options.eagerChunkLoading !== false) {
      compiler.hooks.compilation.tap(MV3ServiceWorkerPlugin.name, (compilation) => {
        compilation.hooks.afterOptimizeChunkIds.tap(MV3ServiceWorkerPlugin.name, () => {
          const entryPoint = compilation.entrypoints.get(this.options.entry)
          if (!entryPoint) return

          const children = entryPoint.getChildren()
          /** @typedef {typeof children[0]} ChunkGroup */
          /** @type {Set<ChunkGroup>} */
          const visitedChunkGroups = new Set()
          /** @type {Set<import('webpack').Chunk>} */
          const reachableChunks = new Set(entryPoint.chunks)
          collectAllChildren(entryPoint)

          if (reachableChunks.size) {
            compilation.addRuntimeModule(
              entryPoint.getEntrypointChunk(),
              EagerlyLoadChunksRuntimeModule(compiler.webpack, [...reachableChunks].map(x => x.id))
            )
          }
          /** @param {ChunkGroup} chunkGroup */
          function collectAllChildren(chunkGroup) {
            for (const x of chunkGroup.getChildren()) {
              if (visitedChunkGroups.has(x)) continue
              else {
                visitedChunkGroups.add(x)
                x.chunks.forEach(x => reachableChunks.add(x))
                collectAllChildren(x)
              }
            }
          }
        })
      })
    }
  }
}
