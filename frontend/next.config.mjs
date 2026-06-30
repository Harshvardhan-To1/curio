/** @type {import('next').NextConfig} */

// Cross-origin isolation is REQUIRED for WebGPU + threaded WASM (WebLLM).
// We use COEP `credentialless` (Chromium) rather than `require-corp` so the
// model/runtime assets fetched cross-origin from the HF / jsDelivr / MLC CDNs
// load without every one of them needing to send CORP headers. Both values
// satisfy `crossOriginIsolated === true`. Swap to require-corp if you proxy
// all model assets through your own origin.
const crossOriginIsolation = [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: crossOriginIsolation }];
  },
  webpack: (config, { isServer }) => {
    // WASM modules (voy-search, transformers.js, web-llm) need async WASM.
    config.experiments = { ...config.experiments, asyncWebAssembly: true };

    // Transformers.js is loaded from a CDN at runtime inside the embed worker
    // (see lib/workers/embed.worker.ts) to avoid bundling onnxruntime's native
    // node assets through webpack. These aliases neutralize any stray
    // server-only deps that could otherwise be pulled in.
    config.resolve.alias = {
      ...config.resolve.alias,
      'onnxruntime-node': false,
      sharp$: false,
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
