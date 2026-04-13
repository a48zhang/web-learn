import { Response } from 'express';
import { AuthenticatedRequest as AuthRequest } from '@web-learn/shared';
import { Topic } from '../models';
import { getStorageService } from '../services/storageService';
import { config } from '../utils/config';

const OSS_PREFIX = 'topics';

export const getGitPresign = async (req: AuthRequest, res: Response) => {
  try {
    const topicId = req.params.id;
    const op = req.query.op as string;

    if (!['upload', 'download', 'publish'].includes(op)) {
      return res.status(400).json({ success: false, error: 'op must be "upload", "download", or "publish"' });
    }

    const topic = await Topic.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }

    if (op !== 'publish' && !req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const isEditor = req.user
      ? topic.editors?.includes(String(req.user.id)) || req.user.role === 'admin'
      : false;
    const isPublished = topic.status === 'published';

    if (op === 'download' && !isPublished && !isEditor) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (op === 'upload' && !isEditor) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (op === 'publish' && !isPublished && !isEditor) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const ossKey =
      op === 'publish'
        ? `${OSS_PREFIX}/${topicId}-published.tar.gz`
        : `${OSS_PREFIX}/${topicId}.tar.gz`;
    const storageService = getStorageService();
    const expiresIn = config.storage.azure.sasExpiryHours;

    if (op === 'upload' || (op === 'publish' && isEditor)) {
      const result = await storageService.getPresignedUrl(ossKey, 'PUT', 'application/gzip', expiresIn);
      return res.json({ success: true, data: { ...result, contentType: 'application/gzip' } });
    } else {
      const result = await storageService.getPresignedUrl(ossKey, 'GET', undefined, expiresIn);
      return res.json({ success: true, data: result });
    }
  } catch (error) {
    console.error('getGitPresign error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
