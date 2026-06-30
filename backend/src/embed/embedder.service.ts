import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';

/**
 * Server-side embeddings for `fat-server` mode ONLY. Uses Transformers.js with
 * the SAME model id as the browser (mean-pool + L2-normalize) so vectors are
 * interchangeable — mismatched models silently break retrieval (spec §1, §5).
 *
 * The `@huggingface/transformers` package is an optionalDependency: in
 * thin-server mode it need not be installed and is never imported.
 */
@Injectable()
export class EmbedderService implements OnModuleInit {
  private readonly logger = new Logger(EmbedderService.name);
  private readonly enabled: boolean;
  private readonly modelId: string;
  // Loaded lazily; typed loosely to avoid a hard type dependency.
  private extractor:
    ((texts: string[], opts: object) => Promise<unknown>) | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {
    this.enabled =
      this.config.get('embedMode', { infer: true }) === 'fat-server';
    this.modelId = this.config.get('embedModel', { infer: true });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async onModuleInit() {
    if (!this.enabled) return;
    await this.load();
  }

  private async load(): Promise<void> {
    if (this.extractor) return;
    try {
      // Dynamic import via a non-literal specifier keeps the dep optional for
      // thin-server deployments (TS won't try to statically resolve it).
      const pkg = '@huggingface/transformers';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- optional dep, untyped here
      const mod: any = await import(pkg);
      const pipe = await mod.pipeline('feature-extraction', this.modelId);
      this.extractor = pipe;
      this.logger.log(`Embedding model loaded: ${this.modelId}`);
    } catch (err) {
      this.logger.error(
        `Failed to load embedding model '${this.modelId}'. Install ` +
          `@huggingface/transformers or switch EMBED_MODE=thin-server. ` +
          `Cause: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  /** Embed a batch of texts → array of L2-normalized float vectors. */
  async embed(texts: string[]): Promise<number[][]> {
    if (!this.enabled) {
      throw new Error('EmbedderService.embed called while in thin-server mode');
    }
    await this.load();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tensor type from optional dep
    const output: any = await this.extractor!(texts, {
      pooling: 'mean',
      normalize: true,
    });
    // Transformers.js returns a Tensor [n, dim]; tolist() → number[][].
    return output.tolist() as number[][];
  }
}
