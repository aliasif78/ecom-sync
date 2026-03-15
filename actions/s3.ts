'use server';

// AWS
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Other Dependencies
import { v4 as uuidv4 } from 'uuid';

// Auth
import { authGuard } from '@/lib/safe-action';

// PostHog
import { S3_UPLOAD_ATTEMPT, S3_UPLOAD_SUCCESS, S3_UPLOAD_FAILED } from '@/lib/posthog/constants';
import { trackEvent } from '@/lib/posthog/helpers';

// Constants
const KEY_PREFIX = 'products';

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.NEXT_PUBLIC_AWS_REGION!,

  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },

  // Tell the SDK to stop calculating checksums for empty presigned payloads
  requestChecksumCalculation: 'WHEN_REQUIRED',
});

export async function getPresignedUploadUrl(fileName: string, fileType: string, fileSize: number) {
  return authGuard<{ url: string; resourceKey: string }>('GET_PRESIGNED_UPLOAD_URL', null, async (userId) => {
    // 1. Validation: Don't let users upload 50GB files to your bucket
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    if (fileSize > maxFileSize) throw new Error('File too large. Max 5MB.');

    // 2. PostHog Tracking
    const s3PostHogData = { fileType, bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME };
    trackEvent(userId, S3_UPLOAD_ATTEMPT, s3PostHogData);

    // 3. Generate a unique key so users don't overwrite each other's images
    const uniqueFileName = `${uuidv4()}-${fileName}`;

    // 4. Create the command
    const command = new PutObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME!,
      Key: `${KEY_PREFIX}/${uniqueFileName}`,
      ContentType: fileType,
    });

    try {
      // 5. Generate the signed URL (Valid for 60 seconds)
      const url = await getSignedUrl(s3Client, command, {
        expiresIn: 60,

        // Tell AWS to only care about the Host and Content-Type
        signableHeaders: new Set(['host', 'content-type']),
      });

      // 6. PostHog Success Tracking
      trackEvent(userId, S3_UPLOAD_SUCCESS, s3PostHogData);

      // 7. Success Response
      return { success: true, message: 'Upload URL generated successfully', url, resourceKey: `${KEY_PREFIX}/${uniqueFileName}` };
    } catch (error) {
      console.error('S3 Signing Error:', error);
      const message = 'Failed to generate upload URL';

      // 1. Post Hog Error Tracking
      trackEvent(userId, S3_UPLOAD_FAILED, { ...s3PostHogData, message });

      // 2. Return Error Response
      return { success: false, message };
    }
  });
}
