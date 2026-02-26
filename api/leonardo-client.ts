/**
 * Leonardo AI REST API Client
 *
 * Base URL: https://cloud.leonardo.ai/api/rest/v1
 * Auth: Bearer token via Authorization header
 */

const LEONARDO_API_BASE = "https://cloud.leonardo.ai/api/rest/v1";

export interface LeonardoModel {
  id: string;
  name: string;
  description: string;
  nsfw?: boolean;
  featured?: boolean;
  generated_image?: {
    id: string;
    url: string;
  } | null;
}

export interface GeneratedImage {
  id: string;
  url: string;
  nsfw: boolean;
  likeCount: number;
  motionMP4URL?: string | null;
}

export interface Generation {
  id: string;
  status: "PENDING" | "COMPLETE" | "FAILED";
  prompt: string;
  negativePrompt?: string;
  modelId?: string;
  width: number;
  height: number;
  numImages: number;
  seed?: number;
  createdAt: string;
  generated_images: GeneratedImage[];
  generation_elements?: any[];
}

export interface UserInfo {
  id: string;
  username: string;
  tokenRenewalDate?: string;
  subscriptionTokens?: number;
  subscriptionGptTokens?: number;
  subscriptionModelTokens?: number;
  apiConcurrencySlots?: number;
  apiPlanTokenRenewalDate?: string;
  apiSubscriptionTokens?: number;
}

export interface CreateGenerationParams {
  prompt: string;
  modelId?: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_images?: number;
  guidance_scale?: number;
  seed?: number;
  public?: boolean;
  alchemy?: boolean;
  photoReal?: boolean;
  photoRealVersion?: string;
  presetStyle?: string;
  scheduler?: string;
  num_inference_steps?: number;
  contrastRatio?: number;
  highResolution?: boolean;
  expandedDomain?: boolean;
  fantasyAvatar?: boolean;
  transparency?: string;
  ultra?: boolean;
}

export interface CreateVariationParams {
  id: string;
  isVariation?: boolean;
  transformType?: "OUTPAINT" | "INPAINT" | "UPSCALE" | "UNZOOM";
}

export interface UpscaleParams {
  id: string;
  upscaleMultiplier?: number;
}

class LeonardoApiError extends Error {
  status: number;
  body: any;

  constructor(message: string, status: number, body: any) {
    super(message);
    this.name = "LeonardoApiError";
    this.status = status;
    this.body = body;
  }
}

async function request(
  apiKey: string,
  method: string,
  path: string,
  body?: any,
): Promise<any> {
  const url = `${LEONARDO_API_BASE}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseBody = await res.json().catch(() => null);

  if (!res.ok) {
    throw new LeonardoApiError(
      `Leonardo API error: ${res.status} ${res.statusText}`,
      res.status,
      responseBody,
    );
  }

  return responseBody;
}

// ─── API Functions ──────────────────────────────────────────────

/**
 * Get the authenticated user's info
 */
export async function getUserInfo(apiKey: string): Promise<UserInfo> {
  const data = await request(apiKey, "GET", "/me");
  return data.user_details?.[0] ?? data;
}

/**
 * List available platform models
 */
export async function listPlatformModels(
  apiKey: string,
): Promise<LeonardoModel[]> {
  const data = await request(apiKey, "GET", "/platformModels");
  return (data.custom_models ?? []).map((m: any) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    nsfw: m.nsfw,
    featured: m.featured,
    generated_image: m.generated_image,
  }));
}

/**
 * Create an image generation job
 */
export async function createGeneration(
  apiKey: string,
  params: CreateGenerationParams,
): Promise<{ generationId: string }> {
  const body: Record<string, any> = {
    prompt: params.prompt,
    width: params.width ?? 1024,
    height: params.height ?? 1024,
    num_images: params.num_images ?? 1,
  };

  if (params.modelId) body.modelId = params.modelId;
  if (params.negative_prompt) body.negative_prompt = params.negative_prompt;
  if (params.guidance_scale !== undefined)
    body.guidance_scale = params.guidance_scale;
  if (params.seed !== undefined) body.seed = params.seed;
  if (params.public !== undefined) body.public = params.public;
  if (params.alchemy !== undefined) body.alchemy = params.alchemy;
  if (params.photoReal !== undefined) body.photoReal = params.photoReal;
  if (params.photoRealVersion)
    body.photoRealVersion = params.photoRealVersion;
  if (params.presetStyle) body.presetStyle = params.presetStyle;
  if (params.scheduler) body.scheduler = params.scheduler;
  if (params.num_inference_steps !== undefined)
    body.num_inference_steps = params.num_inference_steps;
  if (params.contrastRatio !== undefined)
    body.contrastRatio = params.contrastRatio;
  if (params.highResolution !== undefined)
    body.highResolution = params.highResolution;
  if (params.expandedDomain !== undefined)
    body.expandedDomain = params.expandedDomain;
  if (params.fantasyAvatar !== undefined)
    body.fantasyAvatar = params.fantasyAvatar;
  if (params.transparency) body.transparency = params.transparency;
  if (params.ultra !== undefined) body.ultra = params.ultra;

  const data = await request(apiKey, "POST", "/generations", body);
  return {
    generationId:
      data.sdGenerationJob?.generationId ?? data.generationId ?? data.id,
  };
}

/**
 * Get a generation by ID (includes status and generated images)
 */
export async function getGenerationById(
  apiKey: string,
  generationId: string,
): Promise<Generation> {
  const data = await request(apiKey, "GET", `/generations/${generationId}`);
  return data.generations_by_pk ?? data;
}

/**
 * Get generations by user ID
 */
export async function getGenerationsByUserId(
  apiKey: string,
  userId: string,
  limit: number = 10,
  offset: number = 0,
): Promise<Generation[]> {
  const data = await request(
    apiKey,
    "GET",
    `/generations/user/${userId}?limit=${limit}&offset=${offset}`,
  );
  return data.generations ?? [];
}

/**
 * Delete a generation by ID
 */
export async function deleteGeneration(
  apiKey: string,
  generationId: string,
): Promise<void> {
  await request(apiKey, "DELETE", `/generations/${generationId}`);
}

/**
 * Create a variation / unzoom / upscale of an image via the variations endpoint
 */
export async function createVariation(
  apiKey: string,
  params: CreateVariationParams,
): Promise<any> {
  const body: Record<string, any> = {
    id: params.id,
  };
  if (params.isVariation !== undefined) body.isVariation = params.isVariation;
  if (params.transformType) body.transformType = params.transformType;

  const data = await request(apiKey, "POST", "/variations", body);
  return data;
}

/**
 * Upscale an image via the variations/upscale endpoint
 */
export async function upscaleImage(
  apiKey: string,
  params: UpscaleParams,
): Promise<any> {
  const body: Record<string, any> = {
    id: params.id,
  };
  if (params.upscaleMultiplier !== undefined) {
    body.upscaleMultiplier = params.upscaleMultiplier;
  }

  const data = await request(apiKey, "POST", "/variations/upscale", body);
  return data;
}

export interface DownloadedImage {
  base64: string;
  mimeType: string;
  filename: string;
  url: string;
}

/**
 * Download an image from a URL and return it as base64
 */
export async function downloadImage(imageUrl: string): Promise<DownloadedImage> {
  const res = await fetch(imageUrl);

  if (!res.ok) {
    throw new Error(`Failed to download image: ${res.status} ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  // Extract filename from URL
  const urlPath = new URL(imageUrl).pathname;
  const filename = urlPath.split("/").pop() ?? "image.jpg";

  return {
    base64,
    mimeType: contentType,
    filename,
    url: imageUrl,
  };
}

/**
 * Download all images from a generation
 */
export async function downloadGenerationImages(
  apiKey: string,
  generationId: string,
): Promise<DownloadedImage[]> {
  const generation = await getGenerationById(apiKey, generationId);

  if (generation.status !== "COMPLETE") {
    throw new Error(`Generation ${generationId} is not complete (status: ${generation.status})`);
  }

  if (!generation.generated_images?.length) {
    throw new Error(`Generation ${generationId} has no images`);
  }

  const downloads = await Promise.all(
    generation.generated_images.map((img) => downloadImage(img.url)),
  );

  return downloads;
}

/**
 * Poll a generation until it completes or fails (max wait)
 */
export async function waitForGeneration(
  apiKey: string,
  generationId: string,
  maxWaitMs: number = 30000,
  pollIntervalMs: number = 2000,
): Promise<Generation> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const gen = await getGenerationById(apiKey, generationId);

    if (gen.status === "COMPLETE" || gen.status === "FAILED") {
      return gen;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Return last status even if not complete
  return getGenerationById(apiKey, generationId);
}
