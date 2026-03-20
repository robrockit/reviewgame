import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient, createAdminServiceClient } from '@/lib/admin/auth';
import { canAccessVideoImages } from '@/lib/utils/feature-access';
import { isSafeImageUrl } from '@/lib/utils/url';
import { processImage } from '@/lib/utils/imageProcessing';
import { logger } from '@/lib/logger';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth check
    const supabase = await createAdminServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Feature gate
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Failed to verify user profile' }, { status: 500 });
    }

    if (!canAccessVideoImages(profile)) {
      return NextResponse.json(
        { error: 'Image uploads require BASIC or PREMIUM subscription' },
        { status: 403 }
      );
    }

    // Derive storage limit once — used both for the pre-check and post-process check below
    const tier = (profile.subscription_tier ?? '').toUpperCase();
    const storageLimitMb = tier === 'PREMIUM' ? 500 : 100; // BASIC = 100 MB, PREMIUM = 500 MB

    // 3. Parse form data
    const formData = await req.formData();
    const bankId = formData.get('bankId');

    if (!bankId || typeof bankId !== 'string') {
      return NextResponse.json({ error: 'bankId is required' }, { status: 400 });
    }

    const file = formData.get('file');
    const url = formData.get('url');

    let inputBuffer: Buffer;

    if (file instanceof File) {
      // File upload mode
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: 'Only JPEG and PNG images are allowed' },
          { status: 400 }
        );
      }
      if (file.size > MAX_SIZE_BYTES) {
        return NextResponse.json(
          { error: 'File size must not exceed 5MB' },
          { status: 400 }
        );
      }
      inputBuffer = Buffer.from(await file.arrayBuffer());
    } else if (url && typeof url === 'string') {
      // URL fetch mode
      if (!isSafeImageUrl(url)) {
        return NextResponse.json({ error: 'Only HTTPS URLs are allowed' }, { status: 400 });
      }

      let fetchResponse: Response;
      try {
        fetchResponse = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      } catch {
        return NextResponse.json({ error: 'Failed to fetch image from URL' }, { status: 400 });
      }

      if (!fetchResponse.ok) {
        return NextResponse.json({ error: 'Failed to fetch image from URL' }, { status: 400 });
      }

      const contentType = fetchResponse.headers.get('content-type') ?? '';
      if (!ALLOWED_MIME_TYPES.some((t) => contentType.startsWith(t))) {
        return NextResponse.json(
          { error: 'URL must point to a JPEG or PNG image' },
          { status: 400 }
        );
      }

      const contentLength = fetchResponse.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_SIZE_BYTES) {
        return NextResponse.json({ error: 'Image must not exceed 5MB' }, { status: 400 });
      }

      inputBuffer = Buffer.from(await fetchResponse.arrayBuffer());
      if (inputBuffer.length > MAX_SIZE_BYTES) {
        return NextResponse.json({ error: 'Image must not exceed 5MB' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Either file or url is required' }, { status: 400 });
    }

    // 4. Process image → WebP
    const processedBuffer = await processImage(inputBuffer);

    // 4b. Storage limit check — performed after processing so we know the real WebP size
    const addedMb = processedBuffer.length / (1024 * 1024);
    if ((profile.image_storage_used_mb ?? 0) + addedMb > storageLimitMb) {
      return NextResponse.json(
        { error: 'This upload would exceed your storage limit', upgradeRequired: true },
        { status: 403 }
      );
    }

    // 5. Upload to Supabase Storage
    const serviceSupabase = createAdminServiceClient();
    const storagePath = `${user.id}/${bankId}/${crypto.randomUUID()}.webp`;

    const { error: uploadError } = await serviceSupabase.storage
      .from('question-images')
      .upload(storagePath, processedBuffer, {
        contentType: 'image/webp',
        upsert: false,
      });

    if (uploadError) {
      logger.error('Failed to upload image to storage', uploadError, {
        operation: 'uploadImage',
        userId: user.id,
      });
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // 6. Return public URL
    const { data: { publicUrl } } = serviceSupabase.storage
      .from('question-images')
      .getPublicUrl(storagePath);

    // 7. Atomically increment storage usage via RPC (non-fatal if it fails)
    try {
      await supabase.rpc('add_storage_mb', { p_user_id: user.id, p_add_mb: addedMb });
    } catch (storageUpdateErr) {
      logger.error('Failed to update storage usage after upload', storageUpdateErr, {
        operation: 'uploadImage',
        userId: user.id,
      });
    }

    logger.info('Image uploaded successfully', {
      operation: 'uploadImage',
      userId: user.id,
      bankId,
      storagePath,
    });

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    logger.error('Image upload failed', error, { operation: 'uploadImage' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
