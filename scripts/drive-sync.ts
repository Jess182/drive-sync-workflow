import { emptyDir } from 'https://deno.land/std/fs/mod.ts';
import { google } from 'npm:googleapis';
import { join } from 'https://deno.land/std/path/mod.ts';

const CLIENT_ID = Deno.env.get('CLIENT_ID')!;
const CLIENT_SECRET = Deno.env.get('CLIENT_SECRET')!;
const REFRESH_TOKEN = Deno.env.get('REFRESH_TOKEN')!;

const FOLDER_ID = Deno.env.get('FOLDER_ID')!;
const OUTPUT_DIR = Deno.env.get('OUTPUT_DIR')!;

const REDIRECT_URL = 'https://developers.google.com/oauthplayground';

class DriveAdapter {
  private encoder = new TextEncoder();
  private driveClient;

  constructor() {
    const client = new google.auth.OAuth2(
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URL,
    );

    client.setCredentials({
      refresh_token: REFRESH_TOKEN,
    });

    this.driveClient = google.drive({
      version: 'v3',
      auth: client,
    });
  }

  async getRoot(): Promise<Record<string, any>> {
    const { data: root } = await this.driveClient.files.get({
      fileId: 'root',
      fields: 'name, id',
    });

    return root;
  }

  async getFiles(parentId: string): Promise<Record<string, any>[]> {
    const {
      data: { files },
    } = await this.driveClient.files.list({
      q: `'${parentId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType)',
    });

    return files!;
  }

  async getDepthFolder(
    currentFolder: Record<string, any>,
    childFolders: string[],
  ): Promise<Record<string, any>> {
    if (!childFolders.length) return currentFolder;

    const nextFolderName = childFolders.shift();

    const files = await this.getFiles(currentFolder.id);

    const nextFolder = files.find((it) => it.name == nextFolderName);

    if (!nextFolder) {
      throw new Error(
        `${nextFolderName}/ not found. Folders on this level: ${files
          .map((it) => it.name)
          .join(', ')}`,
      );
    }

    return this.getDepthFolder(nextFolder, childFolders);
  }

  async downloadFolder(folderId: string, downloadPath: string) {
    const folderFiles = await this.getFiles(folderId);

    emptyDir(downloadPath);

    for (const file of folderFiles) {
      const mimeType = file.mimeType;

      if (mimeType === 'application/vnd.google-apps.folder') {
        await this.downloadFolder(file.id, `${downloadPath}/${file.name}`);
      } else {
        console.log(`Downloading file "${file.name}"...`);

        const { data } = await this.driveClient.files.get(
          {
            fileId: file.id,
            alt: 'media',
          },
          // { responseType: 'stream' }
        );

        await Deno.writeFile(
          join(downloadPath, file.name),
          this.encoder.encode(data as string),
        );

        // console.log(`Download finished.`);
      }
    }
  }
}

async function main(): Promise<void> {
  try {
    const paths = FOLDER_ID.replace(/\/+/g, '/')
      .replace(/^\/|\/$/g, '')
      .split('/');

    const driveAdapter = new DriveAdapter();

    const root = await driveAdapter.getRoot();

    const folder = await driveAdapter.getDepthFolder(root, paths);

    await driveAdapter.downloadFolder(folder.id, OUTPUT_DIR);
  } catch (e) {
    console.error(e);
  }
}
main();
