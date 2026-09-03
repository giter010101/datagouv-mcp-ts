import { UnsupportedCapabilityError } from "../core/errors.js";
import type { AccessContext, ResourceAccessor, ResourceCapability } from "./types.js";

/**
 * Registry of `ResourceAccessor`s. Resolution walks the capability report in
 * order (best capability first) and returns the first registered accessor that
 * declares the capability and accepts the context.
 */
export class AccessorRegistry {
  private readonly accessors: ResourceAccessor[] = [];

  register(accessor: ResourceAccessor): this {
    if (this.accessors.some((a) => a.id === accessor.id)) {
      throw new Error(`Accessor already registered: ${accessor.id}`);
    }
    this.accessors.push(accessor);
    return this;
  }

  list(): readonly ResourceAccessor[] {
    return this.accessors;
  }

  forCapability(capability: ResourceCapability): ResourceAccessor[] {
    return this.accessors.filter((a) => a.capabilities.includes(capability));
  }

  /** Best accessor for the context, or `undefined` when none applies. */
  tryResolve(ctx: AccessContext): ResourceAccessor | undefined {
    for (const capability of ctx.report.capabilities) {
      for (const accessor of this.forCapability(capability)) {
        if (accessor.supports(ctx)) return accessor;
      }
    }
    return undefined;
  }

  resolve(ctx: AccessContext): ResourceAccessor {
    const accessor = this.tryResolve(ctx);
    if (accessor) return accessor;
    throw new UnsupportedCapabilityError(
      `No data accessor can handle resource ${ctx.resource.id} (format "${ctx.report.detectedFormat}", capabilities: ${ctx.report.capabilities.join(", ")})`,
      {
        details: { resourceId: ctx.resource.id, capabilities: ctx.report.capabilities },
        hint: "Use get_resource_info for metadata and the download URL, or pick another resource of the dataset.",
      },
    );
  }
}

export function createAccessorRegistry(accessors: ResourceAccessor[] = []): AccessorRegistry {
  const registry = new AccessorRegistry();
  for (const accessor of accessors) registry.register(accessor);
  return registry;
}
