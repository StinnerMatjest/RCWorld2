import { S3Client } from '@aws-sdk/client-s3'

export const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev`,
    credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
})