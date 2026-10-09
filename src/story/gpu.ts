export async function preflight(): Promise<string> {
  const gpu = (
    navigator as Navigator & {
      gpu?: {
        requestAdapter: () => Promise<{
          features: Set<string>;
          limits: {
            maxStorageBufferBindingSize: number;
            maxBufferSize: number;
          };
        } | null>;
      };
    }
  ).gpu;
  if (!gpu)
    return "This browser has no WebGPU. The authored sample and evidence desk still work.";
  const adapter = await gpu.requestAdapter();
  if (!adapter)
    return "No usable GPU adapter was found. Use the authored sample.";
  if (!adapter.features.has("shader-f16"))
    return "This model requires the shader-f16 GPU feature. Use the authored sample.";
  if (
    adapter.limits.maxStorageBufferBindingSize < 134217728 ||
    adapter.limits.maxBufferSize < 134217728
  )
    return "GPU buffer limits are too small for this model. Use the authored sample.";
  const estimate = await navigator.storage?.estimate();
  if (
    estimate?.quota &&
    estimate.usage !== undefined &&
    estimate.quota - estimate.usage < 650_000_000
  )
    return "The browser reports too little storage headroom (650 MB required). Free space or use the sample.";
  return "";
}
