export interface Capabilities {
  webgpu: boolean;
  crossOriginIsolated: boolean;
  deviceMemoryGb: number | null;
  /** Low-RAM warning threshold for large model downloads. */
  lowMemory: boolean;
}

/**
 * Feature gate run on load (spec §4.1). WebGPU is required for in-browser
 * generation; cross-origin isolation is required for threaded WASM.
 */
export async function detectCapabilities(): Promise<Capabilities> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const gpu = (nav as Navigator & { gpu?: unknown })?.gpu;
  let webgpu = false;
  if (gpu) {
    try {
      // Requesting an adapter is the only reliable "is it actually usable" check.
      const adapter = await (
        gpu as { requestAdapter(): Promise<unknown> }
      ).requestAdapter();
      webgpu = !!adapter;
    } catch {
      webgpu = false;
    }
  }

  const deviceMemoryGb =
    (nav as Navigator & { deviceMemory?: number })?.deviceMemory ?? null;

  return {
    webgpu,
    crossOriginIsolated:
      typeof crossOriginIsolated !== 'undefined' ? crossOriginIsolated : false,
    deviceMemoryGb,
    lowMemory: deviceMemoryGb !== null && deviceMemoryGb < 4,
  };
}
