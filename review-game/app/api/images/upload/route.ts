import { type NextRequest, NextResponse } from 'next/server';
import { promises as dnsPromises } from 'dns';
import { createAdminServerClient, createAdminServiceClient } from '@/lib/admin/auth';
import { canAccessVideoImages } from '@/lib/utils/feature-access';
import { isSafeImageUrl } from '@/lib/utils/url';
import { processImage } from '@/lib/utils/imageProcessing';
import { logger } from '@/lib/logger';
import type { Tables } from '@/types/database.types';
import { IMAGE_STORAGE } from '@/lib/constants/question-banks';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Returns true if the IPv4 address falls in a private, loopback, or reserved range.
 * Checked ranges: 0/8, 10/8, 100.64/10 (CGNAT), 127/8, 169.254/16, 172.16/12,
 * 192.0.2/24, 192.168/16, 198.18/15, 198.51.100/24, 203.0.113/24, 240/4, 255.255.255.255/32
 */
function isPrivateIpv4(ip: string): boolean {
  const parts = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!parts) return false;
  const [a, b, c, d] = parts.slice(1).map(Number);
  const n = ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;

  return (
    (n & 0xff000000) === 0x00000000 || // 0.0.0.0/8
    (n & 0xff000000) === 0x0a000000 || // 10.0.0.0/8
    (n & 0xffc00000) === 0x64400000 || // 100.64.0.0/10 (CGNAT)
    (n & 0xff000000) === 0x7f000000 || // 127.0.0.0/8
    (n & 0xffff0000) === 0xa9fe0000 || // 169.254.0.0/16 (link-local / AWS metadata)
    (n & 0xfff00000) === 0xac100000 || // 172.16.0.0/12
    (n & 0xffffff00) === 0xc0000200 || // 192.0.2.0/24 (TEST-NET-1)
    (n & 0xffff0000) === 0xc0a80000 || // 192.168.0.0/16
    (n & 0xfffe0000) === 0xc6120000 || // 198.18.0.0/15 (benchmark)
    (n & 0xffffff00) === 0xc6336400 || // 198.51.100.0/24 (TEST-NET-2)
    (n & 0xffffff00) === 0xcb007100 || // 203.0.113.0/24 (TEST-NET-3)
    (n & 0xf0000000) === 0xf0000000 || // 240.0.0.0/4 (reserved)
    n === 0xffffffff                    // 255.255.255.255/32
  );
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  return (
    lower === '::1' ||           // loopback
    lower.startsWith('fe80:') || // link-local
    lower.startsWith('fc') ||    // ULA
    lower.startsWith('fd')       // ULA
  );
}

/**
 * Resolves the hostname of a URL via DNS and returns false if any resolved
 * address falls in a private/reserved range (SSRF mitigation).
 *
 * NOTE: DNS rebinding (public IP at check time, private at fetch time) remains
 * a theoretical risk that cannot be fully mitigated without binding to the
 * resolved IP at the socket level. This check eliminates the common cases.
 */
async function isSsrfSafe(url: string): Promise<boolean> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }

  const addresses: string[] = [];
  try {
    const v4 = await dnsPromises.resolve4(hostname);
    addresses.push(...v4);
  } catch { /* no A records — not an error */ }
  try {
    const v6 = await dnsPromises.resolve6(hostname);
    addresses.push(...v6);
  } catch { /* no AAAA records — not an error */ }

  // If DNS yielded nothing, block it
  if (addresses.length === 0) return false;

  // Block if ANY resolved address is private
  return !addresses.some((addr) => isPrivateIpv4(addr) || isPrivateIpv6(addr));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth check
    const supabase = await createAdminServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Feature gate — select only the columns we need for feature check + storage tracking.
    // Safe assertion: canAccessVideoImages only reads id, subscription_tier, subscription_status.
    const { data: rawProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, subscription_tier, subscription_status, image_storage_used_mb')
      .eq('id', user.id)
      .single();

    if (profileError || !rawProfile) {
      return NextResponse.json({ error: 'Failed to verify user profile' }, { status: 500 });
    }

    const profile = rawProfile as unknown as Tables<'profiles'>;

    if (!canAccessVideoImages(profile)) {
      return NextResponse.json(
        { error: 'Image uploads require BASIC or PREMIUM subscription' },
        { status: 403 }
      );
    }

    // Derive storage limit from shared constant
    const tier = (rawProfile.subscription_tier ?? '').toUpperCase();
    const storageLimitMb = tier === 'PREMIUM'
      ? IMAGE_STORAGE.PREMIUM_LIMIT_MB
      : IMAGE_STORAGE.BASIC_LIMIT_MB;

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

      // SSRF protection: resolve hostname and block private/reserved IPs.
      // DNS rebinding is a known limitation of client-side DNS checks.
      if (!(await isSsrfSafe(url))) {
        return NextResponse.json(
          { error: 'URL resolves to a private or reserved address' },
          { status: 400 }
        );
      }

      let fetchResponse: Response;
      try {
        // redirect: 'manual' prevents follow-through to redirect targets that
        // haven't been SSRF-validated (e.g., a 302 to 169.254.169.254).
        fetchResponse = await fetch(url, {
          signal: AbortSignal.timeout(10_000),
          redirect: 'manual',
        });
      } catch {
        return NextResponse.json({ error: 'Failed to fetch image from URL' }, { status: 400 });
      }

      // Reject any redirect — the redirect target has not been SSRF-validated
      if (fetchResponse.type === 'opaqueredirect') {
        return NextResponse.json({ error: 'URL redirects are not permitted' }, { status: 400 });
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

    // 4. Process image → WebP. Return a clear 400 for corrupt or unsupported images.
    let processedBuffer: Buffer;
    try {
      processedBuffer = await processImage(inputBuffer);
    } catch {
      return NextResponse.json(
        { error: 'Image could not be processed — ensure it is a valid JPEG or PNG' },
        { status: 400 }
      );
    }
    const addedMb = processedBuffer.length / (1024 * 1024);

    // 4b. Fast-path pre-check (advisory only — stale read, but avoids pointless uploads)
    if ((rawProfile.image_storage_used_mb ?? 0) + addedMb > storageLimitMb) {
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

    // 6. Get public URL
    const { data: { publicUrl } } = serviceSupabase.storage
      .from('question-images')
      .getPublicUrl(storagePath);

    // 7. Atomically increment storage and enforce limit with a FOR UPDATE row lock.
    //    Returns false if the increment would push the user over their tier limit.
    //    On RPC error, fail closed: roll back the uploaded file and return 500.
    let withinLimit = true;
    let rpcFailed = false;
    try {
      const { data } = await supabase.rpc('add_storage_mb', {
        p_user_id: user.id,
        p_add_mb: addedMb,
        p_limit_mb: storageLimitMb,
      });
      withinLimit = data === true;
    } catch (storageUpdateErr) {
      logger.error('Failed to update storage usage; rolling back upload', storageUpdateErr, {
        operation: 'uploadImage',
        userId: user.id,
      });
      rpcFailed = true;
      withinLimit = false;
    }

    if (!withinLimit) {
      // Roll back the just-uploaded file before returning an error
      await serviceSupabase.storage.from('question-images').remove([storagePath]);

      if (rpcFailed) {
        return NextResponse.json({ error: 'Failed to process upload' }, { status: 500 });
      }
      return NextResponse.json(
        { error: 'This upload would exceed your storage limit', upgradeRequired: true },
        { status: 403 }
      );
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
