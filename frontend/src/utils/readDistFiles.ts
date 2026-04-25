import { getWebContainer } from '../agent/webcontainer';

const DIST_PATH = '/home/project/dist';

export async function readDistFiles(): Promise<Record<string, Uint8Array>> {
  const wc = await getWebContainer();
  const files: Record<string, Uint8Array> = {};

  async function walk(dir: string) {
    const entries = await wc.fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      const content = await wc.fs.readFile(fullPath);
      const relativePath = fullPath.replace(`${DIST_PATH}/`, '');
      files[relativePath] = content instanceof Uint8Array ? content : new Uint8Array(content);
    }
  }

  await walk(DIST_PATH);
  return files;
}
