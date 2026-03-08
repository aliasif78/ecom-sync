'use server';

// AWS
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Other Dependencies
import { v4 as uuidv4 } from 'uuid';

// Constants
const KEY_PREFIX = 'products';

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,

  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function getPresignedUploadUrl(fileName: string, fileType: string, fileSize: number) {
  // 1. Validation: Don't let users upload 50GB files to your bucket
  const maxFileSize = 5 * 1024 * 1024; // 5MB
  if (fileSize > maxFileSize) throw new Error('File too large. Max 5MB.');

  // 2. Generate a unique key so users don't overwrite each other's images
  const uniqueFileName = `${uuidv4()}-${fileName}`;

  // 3. Create the command
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: `${KEY_PREFIX}/${uniqueFileName}`,
    ContentType: fileType,
  });

  // 4. Generate the signed URL (Valid for 60 seconds)
  try {
    const url = await getSignedUrl(s3Client, command, { expiresIn: 60 });
    return { success: true, url, resourceKey: `${KEY_PREFIX}/${uniqueFileName}` };
  } catch (error) {
    console.error('S3 Signing Error:', error);
    return { success: false, message: 'Failed to generate upload URL' };
  }
}
