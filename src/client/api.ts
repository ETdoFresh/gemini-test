export interface AuthStatus {
  authenticated: boolean;
  loginInProgress: boolean;
}

export interface GeneratedImage {
  filename: string;
  mime: string;
  dimensions: number[] | null;
  base64: string;
}

export interface GenerateResult {
  images: GeneratedImage[];
  metadata: {
    conversationId: string | null;
    responseId: string | null;
    modelName: string | null;
  };
}

export async function checkAuth(): Promise<AuthStatus> {
  const res = await fetch("/api/status");
  return res.json();
}

export async function doLogin(): Promise<{ success?: boolean; error?: string }> {
  const res = await fetch("/api/login");
  return res.json();
}

export async function generate(
  prompt: string,
  files: FileList | null,
  aspectRatio?: string,
  resolution?: string
): Promise<GenerateResult> {
  const form = new FormData();
  form.append("prompt", prompt);
  if (aspectRatio) form.append("aspectRatio", aspectRatio);
  if (resolution) form.append("resolution", resolution);
  if (files) {
    for (const file of files) {
      form.append("images", file);
    }
  }
  const res = await fetch("/api/generate", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }
  return data;
}
