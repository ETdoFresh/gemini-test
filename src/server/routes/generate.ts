import { Router } from "express";
import multer from "multer";
import { hasCookies } from "../lib/cookies.js";
import { tryRestoreSession } from "../lib/auth.js";
import { generateImages, downloadImageToBuffer } from "../lib/gemini.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/generate — generate images
router.post("/generate", upload.array("images", 10), async (req, res) => {
  const rawPrompt = req.body?.prompt;
  if (!rawPrompt) {
    return res.status(400).json({ error: "Missing 'prompt' field" });
  }

  // Build prompt with image settings
  const aspectRatio = req.body?.aspectRatio;
  const resolution = req.body?.resolution;
  const settings: string[] = [];
  if (aspectRatio) settings.push(`Use a ${aspectRatio} aspect ratio`);
  if (resolution === "2048") {
    settings.push("Output the image at 2K resolution (2048×2048 pixels)");
  } else if (resolution === "1024") {
    settings.push("Output the image at 1K resolution (1024×1024 pixels)");
  }
  const prompt = settings.length > 0
    ? `${rawPrompt}. ${settings.join(". ")}.`
    : rawPrompt;

  // If no cookies in memory, try restoring from Chrome profile
  if (!hasCookies()) {
    const restored = await tryRestoreSession();
    if (!restored) {
      return res
        .status(401)
        .json({ error: "Not authenticated. Call GET /api/login first." });
    }
  }

  try {
    const imageBuffers = ((req.files as Express.Multer.File[]) || []).map(
      (f) => ({
        buffer: f.buffer,
        fileName: f.originalname,
        mimeType: f.mimetype,
      })
    );

    const result = await generateImages(prompt, imageBuffers);

    // Download only PNG images and return as base64
    const pngImages = result.images.filter((img) => img.mime === "image/png");
    const images = [];
    for (const img of pngImages) {
      try {
        const buf = await downloadImageToBuffer(img.url);
        images.push({
          filename: img.filename,
          mime: img.mime,
          dimensions: img.dimensions,
          base64: buf.toString("base64"),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`Failed to download ${img.filename}: ${message}`);
      }
    }

    res.json({
      images,
      metadata: {
        conversationId: result.conversationId,
        responseId: result.responseId,
        modelName: result.modelName,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Generation error:", err);
    res.status(500).json({ error: message });
  }
});

export default router;
