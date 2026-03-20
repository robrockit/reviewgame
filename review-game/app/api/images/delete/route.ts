import { type NextRequest, NextResponse } from 'next/server';
import { createAdminServerClient, createAdminServiceClient } from '@/lib/admin/auth';
import { logger } from '@/lib/logger';

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth check
    const supabase = await createAdminServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || !('url' in body) || typeof (body as { url: unknown }).url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }

    const { url } = body as { url: string };

    // 3. Extract storage path
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const prefix = `${supabaseUrl}/storage/v1/object/public/question-images/`;

    if (!url.startsWith(prefix)) {
      return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
    }

    const storagePath = url.slice(prefix.length);

    // 4. Ownership guard — path must start with {userId}/
    if (!storagePath.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 5. Determine file size for storage decrement.
    //    Primary: look up image_size_mb from the questions row (written at save time).
    //    Fallback: Storage list() metadata, which can return size=0 due to eventual consistency.
    const serviceSupabase = createAdminServiceClient();
    let fileSizeMb = 0;

    const { data: questionRow } = await supabase
      .from('questions')
      .select('image_size_mb')
      .eq('image_url', url)
      .maybeSingle();

    if (questionRow?.image_size_mb != null) {
      fileSizeMb = questionRow.image_size_mb;
    } else {
      // Fallback path: question row not found (image uploaded but not yet saved)
      try {
        const dir = storagePath.split('/').slice(0, -1).join('/');
        const filename = storagePath.split('/').pop()!;
        const { data: objects } = await serviceSupabase.storage
          .from('question-images').list(dir, { search: filename });
        fileSizeMb = (objects?.[0]?.metadata?.size ?? 0) / (1024 * 1024);
        if (fileSizeMb === 0) {
          logger.warn('File size is zero (storage fallback); storage counter will not be decremented', {
            operation: 'deleteImage',
            userId: user.id,
            storagePath,
          });
        }
      } catch {
        logger.warn('Failed to get file size (storage fallback); storage counter may drift', {
          operation: 'deleteImage',
          userId: user.id,
          storagePath,
        });
      }
    }

    // 6. Delete from storage
    const { error: deleteError } = await serviceSupabase.storage
      .from('question-images')
      .remove([storagePath]);

    if (deleteError) {
      logger.error('Failed to delete image from storage', deleteError, {
        operation: 'deleteImage',
        userId: user.id,
        storagePath,
      });
      return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
    }

    // 7. Atomically decrement storage usage via RPC (non-fatal)
    try {
      await supabase.rpc('subtract_storage_mb', { p_user_id: user.id, p_subtract_mb: fileSizeMb });
    } catch (storageUpdateErr) {
      logger.error('Failed to update storage usage after delete', storageUpdateErr, {
        operation: 'deleteImage',
        userId: user.id,
      });
    }

    logger.info('Image deleted successfully', {
      operation: 'deleteImage',
      userId: user.id,
      storagePath,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error('Image delete failed', error, { operation: 'deleteImage' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
