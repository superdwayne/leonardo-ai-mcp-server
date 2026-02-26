import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  getUserInfo,
  listPlatformModels,
  createGeneration,
  getGenerationById,
  getGenerationsByUserId,
  deleteGeneration,
  createVariation,
  upscaleImage,
  waitForGeneration,
  downloadImage,
  downloadGenerationImages,
} from "./leonardo-client.js";

/**
 * Resolve the Leonardo API key.
 * Priority:
 *   1. x-leonardo-api-key header (passed by the MCP client)
 *   2. LEONARDO_API_KEY environment variable (set in Vercel)
 */
function getApiKey(headers?: Record<string, string>): string {
  const fromHeader = headers?.["x-leonardo-api-key"];
  if (fromHeader) return fromHeader;

  const fromEnv = process.env.LEONARDO_API_KEY;
  if (fromEnv) return fromEnv;

  throw new Error(
    "Leonardo API key not found. Set LEONARDO_API_KEY env var or pass x-leonardo-api-key header.",
  );
}

function extractApiKey(extra: unknown): string {
  const headers = (extra as Record<string, any>)?.requestInfo?.headers as
    | Record<string, string>
    | undefined;
  return getApiKey(headers);
}

// ─── MCP Server ─────────────────────────────────────────────────

const handler = createMcpHandler(
  (server) => {
    // ── Tool: get_user_info ──────────────────────────────────────
    server.tool(
      "get_user_info",
      "Get the current authenticated Leonardo AI user's information including username, subscription tokens, and API quota.",
      {},
      async (_params: Record<string, never>, extra: unknown) => {
        const apiKey = extractApiKey(extra);
        try {
          const user = await getUserInfo(apiKey);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(user, null, 2),
              },
            ],
          };
        } catch (err: unknown) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: ${(err as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // ── Tool: list_models ────────────────────────────────────────
    server.tool(
      "list_models",
      "List all available Leonardo AI platform models. Returns model IDs, names, and descriptions. Use the model ID when generating images.",
      {},
      async (_params: Record<string, never>, extra: unknown) => {
        const apiKey = extractApiKey(extra);
        try {
          const models = await listPlatformModels(apiKey);
          const summary = models.map((m) => ({
            id: m.id,
            name: m.name,
            description: m.description,
          }));
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(summary, null, 2),
              },
            ],
          };
        } catch (err: unknown) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: ${(err as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // ── Tool: generate_image ─────────────────────────────────────
    server.tool(
      "generate_image",
      "Generate images using Leonardo AI. Provide a prompt and optional parameters like model ID, dimensions, number of images, and style presets. The tool will start the generation and poll for results (up to 30 seconds). Returns the generation status and image URLs when complete.",
      {
        prompt: z.string().describe("The text prompt describing the image to generate"),
        model_id: z
          .string()
          .optional()
          .describe(
            "Leonardo model ID to use. Call list_models to see available options.",
          ),
        negative_prompt: z
          .string()
          .optional()
          .describe("What to avoid in the generated image"),
        width: z
          .number()
          .int()
          .min(32)
          .max(2048)
          .optional()
          .describe("Image width in pixels (default: 1024)"),
        height: z
          .number()
          .int()
          .min(32)
          .max(2048)
          .optional()
          .describe("Image height in pixels (default: 1024)"),
        num_images: z
          .number()
          .int()
          .min(1)
          .max(8)
          .optional()
          .describe("Number of images to generate (default: 1, max: 8)"),
        guidance_scale: z
          .number()
          .min(1)
          .max(20)
          .optional()
          .describe("How strictly to follow the prompt (default: 7)"),
        seed: z.number().int().optional().describe("Random seed for reproducibility"),
        alchemy: z
          .boolean()
          .optional()
          .describe("Enable Alchemy pipeline for higher quality"),
        photo_real: z
          .boolean()
          .optional()
          .describe("Enable PhotoReal for photorealistic results"),
        preset_style: z
          .string()
          .optional()
          .describe(
            "Style preset (e.g. CINEMATIC, CREATIVE, VIBRANT, NONE, ANIME, DYNAMIC, ENVIRONMENT, GENERAL, ILLUSTRATION, PHOTOGRAPHY, RAYTRACED, RENDER_3D, SKETCH_BW, SKETCH_COLOR, STOCK_PHOTO)",
          ),
        ultra: z
          .boolean()
          .optional()
          .describe("Enable Ultra mode for the highest quality generation"),
        wait_for_completion: z
          .boolean()
          .optional()
          .describe(
            "Whether to poll and wait for the generation to complete (default: true, max 30s)",
          ),
      },
      async (params: {
        prompt: string;
        model_id?: string;
        negative_prompt?: string;
        width?: number;
        height?: number;
        num_images?: number;
        guidance_scale?: number;
        seed?: number;
        alchemy?: boolean;
        photo_real?: boolean;
        preset_style?: string;
        ultra?: boolean;
        wait_for_completion?: boolean;
      }, extra: unknown) => {
        const apiKey = extractApiKey(extra);
        try {
          const { generationId } = await createGeneration(apiKey, {
            prompt: params.prompt,
            modelId: params.model_id,
            negative_prompt: params.negative_prompt,
            width: params.width,
            height: params.height,
            num_images: params.num_images,
            guidance_scale: params.guidance_scale,
            seed: params.seed,
            alchemy: params.alchemy,
            photoReal: params.photo_real,
            presetStyle: params.preset_style,
            ultra: params.ultra,
          });

          const shouldWait = params.wait_for_completion !== false;

          if (shouldWait) {
            const generation = await waitForGeneration(apiKey, generationId);
            const imageUrls = generation.generated_images?.map(
              (img) => img.url,
            );

            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      generationId: generation.id,
                      status: generation.status,
                      prompt: generation.prompt,
                      images: imageUrls ?? [],
                      imageDetails: generation.generated_images ?? [],
                      width: generation.width,
                      height: generation.height,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    generationId,
                    status: "PENDING",
                    message:
                      "Generation started. Use get_generation to check status.",
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (err: unknown) {
          const error = err as Error & { body?: unknown };
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: ${error.message}${error.body ? "\n" + JSON.stringify(error.body, null, 2) : ""}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // ── Tool: get_generation ─────────────────────────────────────
    server.tool(
      "get_generation",
      "Get the status and results of a Leonardo AI image generation job by its ID. Returns the generation status, prompt, and image URLs when complete.",
      {
        generation_id: z
          .string()
          .describe("The generation job ID to look up"),
      },
      async ({ generation_id }: { generation_id: string }, extra: unknown) => {
        const apiKey = extractApiKey(extra);
        try {
          const generation = await getGenerationById(apiKey, generation_id);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(generation, null, 2),
              },
            ],
          };
        } catch (err: unknown) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: ${(err as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // ── Tool: get_user_generations ────────────────────────────────
    server.tool(
      "get_user_generations",
      "Get recent image generation jobs for a Leonardo AI user. Returns a list of generations with their status, prompts, and image URLs.",
      {
        user_id: z
          .string()
          .describe(
            "The user ID to look up generations for. Use get_user_info to find your user ID.",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Maximum number of generations to return (default: 10)"),
        offset: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Offset for pagination (default: 0)"),
      },
      async ({ user_id, limit, offset }: { user_id: string; limit?: number; offset?: number }, extra: unknown) => {
        const apiKey = extractApiKey(extra);
        try {
          const generations = await getGenerationsByUserId(
            apiKey,
            user_id,
            limit ?? 10,
            offset ?? 0,
          );
          const summary = generations.map((g) => ({
            id: g.id,
            status: g.status,
            prompt: g.prompt,
            imageCount: g.generated_images?.length ?? 0,
            images: g.generated_images?.map((img) => img.url) ?? [],
            createdAt: g.createdAt,
          }));
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(summary, null, 2),
              },
            ],
          };
        } catch (err: unknown) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: ${(err as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // ── Tool: create_variation ────────────────────────────────────
    server.tool(
      "create_variation",
      "Create a variation of an existing Leonardo AI generated image. You can also use this for outpainting, inpainting, or unzooming.",
      {
        image_id: z
          .string()
          .describe(
            "The ID of the generated image to create a variation of (this is the image ID, not the generation ID)",
          ),
        transform_type: z
          .enum(["OUTPAINT", "INPAINT", "UPSCALE", "UNZOOM"])
          .optional()
          .describe(
            "The type of transformation to apply (default: variation)",
          ),
      },
      async ({ image_id, transform_type }: { image_id: string; transform_type?: "OUTPAINT" | "INPAINT" | "UPSCALE" | "UNZOOM" }, extra: unknown) => {
        const apiKey = extractApiKey(extra);
        try {
          const result = await createVariation(apiKey, {
            id: image_id,
            isVariation: true,
            transformType: transform_type,
          });
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err: unknown) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: ${(err as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // ── Tool: upscale_image ──────────────────────────────────────
    server.tool(
      "upscale_image",
      "Upscale a Leonardo AI generated image to higher resolution.",
      {
        image_id: z
          .string()
          .describe(
            "The ID of the generated image to upscale (this is the image ID, not the generation ID)",
          ),
        upscale_multiplier: z
          .number()
          .min(1)
          .max(4)
          .optional()
          .describe("Upscale multiplier (e.g. 2 for 2x resolution)"),
      },
      async ({ image_id, upscale_multiplier }: { image_id: string; upscale_multiplier?: number }, extra: unknown) => {
        const apiKey = extractApiKey(extra);
        try {
          const result = await upscaleImage(apiKey, {
            id: image_id,
            upscaleMultiplier: upscale_multiplier,
          });
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err: unknown) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: ${(err as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // ── Tool: download_image ────────────────────────────────────
    server.tool(
      "download_image",
      "Download a Leonardo AI generated image by its URL. Returns the image as base64 data that can be saved locally. Use this after generate_image to get the actual image file.",
      {
        image_url: z
          .string()
          .url()
          .describe("The URL of the image to download (from generate_image or get_generation results)"),
      },
      async ({ image_url }: { image_url: string }, _extra: unknown) => {
        try {
          const image = await downloadImage(image_url);
          return {
            content: [
              {
                type: "image" as const,
                data: image.base64,
                mimeType: image.mimeType,
              },
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    filename: image.filename,
                    mimeType: image.mimeType,
                    url: image.url,
                    sizeBytes: Math.round((image.base64.length * 3) / 4),
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (err: unknown) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: ${(err as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // ── Tool: download_generation ─────────────────────────────────
    server.tool(
      "download_generation",
      "Download all images from a completed Leonardo AI generation. Returns each image as base64 data that can be saved locally. Provide a generation ID to download all its images at once.",
      {
        generation_id: z
          .string()
          .describe("The generation ID to download all images from"),
      },
      async ({ generation_id }: { generation_id: string }, extra: unknown) => {
        const apiKey = extractApiKey(extra);
        try {
          const images = await downloadGenerationImages(apiKey, generation_id);
          const content: Array<{ type: "image"; data: string; mimeType: string } | { type: "text"; text: string }> = [];

          for (let i = 0; i < images.length; i++) {
            const img = images[i];
            content.push({
              type: "image" as const,
              data: img.base64,
              mimeType: img.mimeType,
            });
            content.push({
              type: "text" as const,
              text: `Image ${i + 1}/${images.length}: ${img.filename} (${img.mimeType})`,
            });
          }

          content.push({
            type: "text" as const,
            text: JSON.stringify(
              {
                generationId: generation_id,
                totalImages: images.length,
                files: images.map((img) => ({
                  filename: img.filename,
                  mimeType: img.mimeType,
                  url: img.url,
                  sizeBytes: Math.round((img.base64.length * 3) / 4),
                })),
              },
              null,
              2,
            ),
          });

          return { content };
        } catch (err: unknown) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: ${(err as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    // ── Tool: delete_generation ──────────────────────────────────
    server.tool(
      "delete_generation",
      "Delete a Leonardo AI generation by its ID. This permanently removes the generation and all its images.",
      {
        generation_id: z
          .string()
          .describe("The generation ID to delete"),
      },
      async ({ generation_id }: { generation_id: string }, extra: unknown) => {
        const apiKey = extractApiKey(extra);
        try {
          await deleteGeneration(apiKey, generation_id);
          return {
            content: [
              {
                type: "text" as const,
                text: `Successfully deleted generation ${generation_id}`,
              },
            ],
          };
        } catch (err: unknown) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: ${(err as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      },
    );
  },
  {
    serverInfo: {
      name: "leonardo-ai-mcp",
      version: "1.0.0",
    },
  },
);

export { handler as GET, handler as POST, handler as DELETE };
