import { getWebContainer } from '../agent/webcontainer';
import { topicApi, topicGitApi } from '../services/api';
import { createTarball } from './tarUtils';
import { readDistFiles } from './readDistFiles';

export type PublishPhase = 'building' | 'uploading';

export async function publishTopic(
  topicId: string,
  onProgress?: (phase: PublishPhase) => void
): Promise<{ publishedUrl: string; shareLink: string }> {
  const wc = await getWebContainer();

  onProgress?.('building');
  const buildProcess = await wc.spawn('npm', ['run', 'build'], { cwd: '/home/project' });
  const buildOutput: string[] = [];
  const outputPromise = buildProcess.output.pipeTo(
    new WritableStream({
      write: (data) => {
        buildOutput.push(data);
      },
    })
  );
  const exitCode = await buildProcess.exit;
  await outputPromise.catch(() => undefined);
  if (exitCode !== 0) {
    throw new Error(`Build failed (exit code: ${exitCode})\n${buildOutput.join('')}`);
  }

  const distFiles = await readDistFiles();
  if (Object.keys(distFiles).length === 0) {
    throw new Error('Build produced no output files');
  }

  onProgress?.('uploading');
  const tarball = createTarball(distFiles);
  const { url } = await topicGitApi.getPresign(topicId, 'publish');

  const uploadResponse = await fetch(url, {
    method: 'PUT',
    body: new Blob([tarball], { type: 'application/gzip' }),
  });
  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: ${uploadResponse.status}`);
  }

  const updatedTopic = await topicApi.updateStatus(topicId, { status: 'published' });
  const fallbackShareLink = `${window.location.origin}/p/${topicId}`;

  return {
    publishedUrl: updatedTopic.publishedUrl ?? '',
    shareLink: updatedTopic.shareLink || fallbackShareLink,
  };
}
