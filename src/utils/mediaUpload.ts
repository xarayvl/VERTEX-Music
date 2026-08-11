const AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
};

function uploadMimeType(file: File, kind: 'audio' | 'image'): string {
  if (file.type) return file.type.toLowerCase();
  if (kind === 'audio') {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return AUDIO_MIME_BY_EXTENSION[extension] || '';
  }
  return '';
}

export async function uploadMediaFile(file: File, kind: 'audio' | 'image'): Promise<string> {
  const mimeType = uploadMimeType(file, kind);
  if (!mimeType) throw new Error('The selected file type could not be determined.');

  let uploadId = '';
  try {
    const presignResponse = await fetch('/api/uploads/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, fileName: file.name, mimeType, size: file.size }),
    });
    const presign = await presignResponse.json().catch(() => null);
    if (!presignResponse.ok || !presign?.uploadUrl || !presign?.uploadId) {
      throw new Error(presign?.error || 'Could not prepare the media upload.');
    }
    uploadId = presign.uploadId;

    const putResponse = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: presign.requiredHeaders || { 'Content-Type': mimeType },
      body: file,
    });
    if (!putResponse.ok) throw new Error(`Media upload failed (${putResponse.status}).`);

    const completeResponse = await fetch('/api/uploads/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId }),
    });
    const completed = await completeResponse.json().catch(() => null);
    if (!completeResponse.ok || !completed?.url) {
      throw new Error(completed?.error || 'The uploaded media could not be verified.');
    }
    return completed.url;
  } catch (error) {
    if (uploadId) {
      await fetch(`/api/uploads/${encodeURIComponent(uploadId)}`, { method: 'DELETE' }).catch(() => undefined);
    }
    throw error;
  }
}
