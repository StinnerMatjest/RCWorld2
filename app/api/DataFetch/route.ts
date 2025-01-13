import { GetObjectCommand } from '@aws-sdk/client-s3';
import chalk from 'chalk';
import { r2 } from '@/app/library/r2';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fileId = url.searchParams.get('fileId');
  const fileType = url.searchParams.get('fileType');

  if (!fileId || !fileType) {
    return new Response('Missing fileId or fileType', { status: 400 });
  }

  let fileExtension = '';
  let contentType = '';

  if (fileType === 'pdf') {
    fileExtension = '.pdf';
    contentType = 'application/pdf';
  } else if (fileType === 'mp4') {
    fileExtension = '.mp4';
    contentType = 'video/mp4';
  } else {
    return new Response('Unsupported file type', { status: 400 });
  }

  const fileKey = `${fileId}${fileExtension}`;

  try {
    console.log(chalk.yellow(`Retrieving ${fileType.toUpperCase()} from R2!`));

    const file = await r2.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileKey,
      })
    );

    if (!file || !file.Body) {
      throw new Error(`${fileType.toUpperCase()} not found.`);
    }

    return new Response(file.Body.transformToWebStream(), {
      headers: {
        'Content-Type': contentType,
      },
    });
  } catch (err) {
    console.error(chalk.red(`Error fetching ${fileType.toUpperCase()} from R2:`), err);
    return new Response(`Error fetching ${fileType.toUpperCase()}.`, { status: 500 });
  }
}