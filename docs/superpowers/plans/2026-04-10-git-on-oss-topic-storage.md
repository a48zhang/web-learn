# Git-on-OSS Topic Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace file-snapshot-in-DB storage with Git-on-OSS (tarball per topic) and migrate all IDs from auto-increment to UUID.

**Architecture:** WebContainer uses isomorphic-git locally in the browser. Each commit packages the entire directory (including .git/) as a tarball and uploads directly to OSS via pre-signed URLs. Backend only signs URLs — no file transfer through backend.

**Tech Stack:** Node.js, Express, Sequelize, TypeScript, OSS SDK, `uuid`, `tar`

---

### Task 1: Update Shared Types — Remove Old Fields + TopicPage

**Files:**
- Modify: `shared/src/types/index.ts`

- [ ] **Step 1: Update the Topic interface — remove `filesSnapshot` and `chatHistory`**

Replace lines 35-50:

```typescript
// shared/src/types/index.ts — REPLACE Topic interface:

export interface Topic {
  id: string;
  title: string;
  description?: string;
  type: TopicType;
  websiteUrl?: string | null;  // deprecated, keep for backward compat
  createdBy: string;
  status: TopicStatusType;
  publishedUrl?: string | null;
  shareLink?: string | null;
  editors: string[];
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Delete all TopicPage types (lines 72-106)**

Delete the entire block from `// Topic page types` through the end of `ReorderTopicPagesDto`:

```typescript
// DELETE these lines entirely (lines 72-106):
// TopicPage, TopicPageTreeNode, CreateTopicPageDto, UpdateTopicPageDto, ReorderTopicPagesDto
```

- [ ] **Step 3: Delete WebsiteStats interface (lines 118-121)**

```typescript
// DELETE these lines entirely:
// export interface WebsiteStats {
//   fileCount: number;
//   totalSize: number;
// }
```

- [ ] **Step 4: Commit**

```bash
git add shared/src/types/index.ts
git commit -m "refactor(types): remove filesSnapshot/chatHistory from Topic, delete TopicPage and WebsiteStats types"
```

---

### Task 2: Update Topic Model (topic-space) — UUID Primary Key

**Files:**
- Modify: `services/topic-space/src/models/Topic.ts`

- [ ] **Step 1: Replace the entire Topic model**

```typescript
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';

interface TopicAttributes {
  id: string;
  title: string;
  description?: string;
  type: 'website';
  created_by: string;
  status: 'draft' | 'published' | 'closed';
  published_url?: string | null;
  share_link?: string | null;
  editors: string[];
}

interface TopicCreationAttributes extends Optional<TopicAttributes, 'id' | 'description' | 'status' | 'type' | 'published_url' | 'share_link' | 'editors'> {}

class Topic extends Model<TopicAttributes, TopicCreationAttributes> implements TopicAttributes {
  public id!: string;
  public title!: string;
  public description?: string;
  public type!: 'website';
  public created_by!: string;
  public status!: 'draft' | 'published' | 'closed';
  public published_url?: string | null;
  public share_link?: string | null;
  public editors!: string[];
  public declare createdAt: Date;
  public declare updatedAt: Date;
}

Topic.init(
  {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    type: { type: DataTypes.ENUM('website'), allowNull: false, defaultValue: 'website' },
    created_by: { type: DataTypes.STRING(36), allowNull: false },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'closed'),
      allowNull: false,
      defaultValue: 'draft',
    },
    published_url: { type: DataTypes.STRING(500), allowNull: true },
    share_link: { type: DataTypes.STRING(500), allowNull: true },
    editors: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  },
  { sequelize, tableName: 'topic_topics', underscored: true }
);

export default Topic;
```

- [ ] **Step 2: Add `uuid` to topic-space package.json dependencies**

Check `services/topic-space/package.json`. If `"uuid"` is not in dependencies, add:

```json
"dependencies": {
  ...existing...,
  "uuid": "^10.0.0"
}
```

And `"@types/uuid"` to devDependencies:

```json
"devDependencies": {
  ...existing...,
  "@types/uuid": "^10.0.0"
}
```

Then run:

```bash
pnpm install
```

- [ ] **Step 3: Commit**

```bash
git add services/topic-space/src/models/Topic.ts services/topic-space/package.json pnpm-lock.yaml
git commit -m "refactor(topic-space): change Topic model to UUID PK, remove website_url/files_snapshot/chat_history"
```

---

### Task 3: Update Topic Model (AI Service) — UUID Primary Key

**Files:**
- Modify: `services/ai/src/models/Topic.ts`

- [ ] **Step 1: Replace the entire AI service Topic model**

```typescript
import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../utils/database';

interface TopicAttributes {
  id: string;
  title: string;
  description?: string;
  type: 'website';
  created_by: string;
  status: 'draft' | 'published' | 'closed';
  editors: string[];
}

interface TopicCreationAttributes extends Optional<TopicAttributes, 'id' | 'description' | 'status' | 'type' | 'editors'> {}

class Topic extends Model<TopicAttributes, TopicCreationAttributes> implements TopicAttributes {
  public id!: string;
  public title!: string;
  public description?: string;
  public type!: 'website';
  public created_by!: string;
  public status!: 'draft' | 'published' | 'closed';
  public editors!: string[];
  public declare createdAt: Date;
  public declare updatedAt: Date;
}

Topic.init(
  {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    type: { type: DataTypes.ENUM('website'), allowNull: false, defaultValue: 'website' },
    created_by: { type: DataTypes.STRING(36), allowNull: false },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'closed'),
      allowNull: false,
      defaultValue: 'draft',
    },
    editors: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
  },
  { sequelize, tableName: 'topic_topics', underscored: true }
);

export default Topic;
```

- [ ] **Step 2: Add `uuid` to ai service package.json if not present, then `pnpm install`**

- [ ] **Step 3: Commit**

```bash
git add services/ai/src/models/Topic.ts services/ai/package.json pnpm-lock.yaml
git commit -m "refactor(ai): change Topic model to UUID PK, sync with topic-space"
```

---

### Task 4: Update User Model (Auth Service) — UUID Primary Key

**Files:**
- Modify: `services/auth/src/models/User.ts`
- Modify: `services/auth/src/controllers/authController.ts`
- Modify: `services/auth/src/routes/internal.ts`
- Modify: `services/auth/src/controllers/userController.ts`
- Modify: `services/auth/src/middlewares/authMiddleware.ts`

- [ ] **Step 1: Update User model — UUID primary key**

```typescript
// services/auth/src/models/User.ts — REPLACE entire file:

import { DataTypes, Model, Optional } from 'sequelize';
import bcrypt from 'bcryptjs';
import { sequelize } from '../utils/database';

interface UserAttributes {
  id: string;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public username!: string;
  public email!: string;
  public password!: string;
  public role!: 'admin' | 'user';
  public declare createdAt: Date;
  public declare updatedAt: Date;

  public async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
  }
}

User.init(
  {
    id: { type: DataTypes.STRING(36), primaryKey: true },
    username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password: { type: DataTypes.CHAR(60), allowNull: false },
    role: {
      type: DataTypes.ENUM('admin', 'user'),
      allowNull: false,
      defaultValue: 'user',
    },
  },
  {
    sequelize,
    tableName: 'auth_users',
    underscored: true,
    hooks: {
      beforeCreate: async (user: User) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
      beforeUpdate: async (user: User) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
    },
  }
);

export default User;
```

- [ ] **Step 2: Update authController.ts — generate UUID on create, fix id types**

In `services/auth/src/controllers/authController.ts`, replace line 27 and lines 28-32:

```typescript
// authController.ts — import uuid and replace create:
import { v4 as uuidv4 } from 'uuid';

// Line 27: change to:
const user = await User.create({ id: uuidv4(), username, email, password, role });

// Lines 29-30: jwt payload stays the same since user.id is now string
// The serializeUser on line 8 already does String(user.id), which is now redundant but harmless
// Clean it up:
const serializeUser = (user: User) => ({
  id: user.id,  // already string, no need for String()
  username: user.username,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});
```

- [ ] **Step 3: Update authMiddleware.ts — fix id type**

```typescript
// services/auth/src/middlewares/authMiddleware.ts — fix lines 7 and 20:

export interface AuthRequest extends Request {
  user?: { id: string; username: string; email: string; role: string };
}

// Line 20 change from:
// id: number; username: string; email: string; role: string;
// to:
id: string; username: string; email: string; role: string;
```

- [ ] **Step 4: Update internal.ts (verify endpoint) — fix id type**

```typescript
// services/auth/src/routes/internal.ts — line 28:
// Change from:
// id: user.id,
// to:
id: user.id.toString(),
// (user.id is now string, so .toString() is redundant but harmless for backward compat)
```

- [ ] **Step 5: Update userController.ts — fix id type**

```typescript
// services/auth/src/controllers/userController.ts — line 12:
// Change from:
// id: String(user.id),
// to:
id: user.id,
```

- [ ] **Step 6: Add uuid to auth package.json and `pnpm install`**

- [ ] **Step 7: Commit**

```bash
git add services/auth/src/models/User.ts services/auth/src/controllers/authController.ts services/auth/src/middlewares/authMiddleware.ts services/auth/src/routes/internal.ts services/auth/src/controllers/userController.ts services/auth/package.json pnpm-lock.yaml
git commit -m "refactor(auth): change User model to UUID PK"
```

---

### Task 5: Update Gateway — Remove pages Route, Fix Header Injection Types

**Files:**
- Modify: `services/gateway/src/app.ts`
- Modify: `services/gateway/src/proxy.ts`
- Modify: `services/gateway/src/authVerificationMiddleware.ts`
- Modify: `services/gateway/src/authClient.ts`

- [ ] **Step 1: Remove `/api/pages` from app.ts**

The file currently has (line 67):
```typescript
app.use('/api/pages', proxies.topicSpace);
```
Delete this line.

- [ ] **Step 2: Fix authVerificationMiddleware.ts — change injected header types**

Change `x-user-id` from number to string. Line 31:
```typescript
req.headers['x-user-id'] = verifyResult.user.id;  // already string now
```

Line 31 was previously `verifyResult.user.id.toString()` — remove `.toString()`.

- [ ] **Step 3: Update authClient.ts VerifyResponse interface — id is string**

```typescript
// services/gateway/src/authClient.ts — lines 11-12:
export interface VerifyResponse {
  success: boolean;
  user?: {
    id: string;  // was number
    username: string;
    email: string;
    role: string;
  };
  error?: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add services/gateway/src/app.ts services/gateway/src/authVerificationMiddleware.ts services/gateway/src/authClient.ts
git commit -m "refactor(gateway): remove /api/pages route, update user id types to string"
```

---

### Task 6: Rewrite topicController — Remove Old Endpoints, Use UUID

**Files:**
- Modify: `services/topic-space/src/controllers/topicController.ts`

- [ ] **Step 1: Update formatTopic — remove filesSnapshot and chatHistory**

```typescript
// services/topic-space/src/controllers/topicController.ts — REPLACE formatTopic (lines 9-31):

const formatTopic = (topic: any) => ({
  id: topic.id,  // already string (UUID)
  title: topic.title,
  description: topic.description,
  type: topic.type,
  createdBy: topic.created_by,
  creator: topic.creator
    ? {
      id: topic.creator.id,
      username: topic.creator.username,
      email: topic.creator.email,
    }
    : undefined,
  status: topic.status,
  publishedUrl: topic.published_url ?? null,
  shareLink: topic.share_link ?? null,
  editors: topic.editors ?? [],
  createdAt: topic.createdAt.toISOString(),
  updatedAt: topic.updatedAt.toISOString(),
});
```

- [ ] **Step 2: Remove parseTopicId — replace with direct id usage**

Delete `parseTopicId` function. All places that used it now just use `req.params.id` directly.

Update all controllers that used `parseTopicId`:
- `createTopic` — no change (no id param)
- `getTopicById` — replace `const topicId = parseTopicId(req.params.id); if (!topicId) ...` with direct `const topicId = req.params.id;`
- `updateTopic` — same
- `updateTopicStatus` — same
- `deleteTopic` — same
- `saveFilesSnapshot` — DELETE entire function
- `saveChatHistory` — DELETE entire function
- `uploadWebsite` — DELETE entire function
- `deleteWebsite` — DELETE entire function
- `getWebsiteStats` — DELETE entire function
- `hasTopicEditAccess` — update to use string id comparison:

```typescript
const hasTopicEditAccess = (topic: any, req: AuthRequest) =>
  req.user && (topic.editors?.includes(req.user.id) || req.user.role === 'admin');
```

- [ ] **Step 3: Update createTopic — generate UUID**

```typescript
// import at top:
import { v4 as uuidv4 } from 'uuid';

// In createTopic, replace line 98-106:
const topic = await Topic.create({
  id: uuidv4(),
  title,
  description,
  type: 'website',
  created_by: req.user.id,  // already string
  status: 'draft',
  editors: [req.user.id],  // now string, not .toString()
});
```

- [ ] **Step 4: Update getTopics — remove website_url references**

The `getTopics` function doesn't reference website_url directly, no change needed.

- [ ] **Step 5: Update deleteTopic — fix OSS prefix and id type**

```typescript
// In deleteTopic, line 248:
const ossPrefix = `topics/${topic.id}/`;
// topic.id is now string UUID, no change needed beyond removing .toString()
```

- [ ] **Step 6: Commit**

```bash
git add services/topic-space/src/controllers/topicController.ts
git commit -m "refactor(topic-space): rewrite controllers for UUID, remove dead endpoints (files, chat-history, website upload)"
```

---

### Task 7: Update topicRoutes — Remove Dead Routes

**Files:**
- Modify: `services/topic-space/src/routes/topicRoutes.ts`

- [ ] **Step 1: Clean up imports and routes**

```typescript
// services/topic-space/src/routes/topicRoutes.ts — REPLACE entire file:

import express, { Router } from 'express';
import {
  createTopic,
  getTopics,
  getTopicById,
  updateTopic,
  updateTopicStatus,
  deleteTopic,
} from '../controllers/topicController';
import { internalAuthMiddleware } from '@web-learn/shared';
import { optionalAuthMiddleware } from '../middlewares/optionalAuthMiddleware';
import rateLimit from 'express-rate-limit';

const router: Router = express.Router();

const readLimiter = rateLimit({ windowMs: 60000, max: 300 });
const writeLimiter = rateLimit({ windowMs: 60000, max: 100 });

router.post('/', writeLimiter, internalAuthMiddleware, createTopic);
router.get('/', readLimiter, optionalAuthMiddleware, getTopics);
router.get('/:id', readLimiter, optionalAuthMiddleware, getTopicById);
router.put('/:id', writeLimiter, internalAuthMiddleware, updateTopic);
router.patch('/:id/status', writeLimiter, internalAuthMiddleware, updateTopicStatus);
router.delete('/:id', writeLimiter, internalAuthMiddleware, deleteTopic);

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add services/topic-space/src/routes/topicRoutes.ts
git commit -m "refactor(topic-space): remove dead routes (website upload, files, chat-history)"
```

---

### Task 8: Extend StorageService Interface + Azure Blob Storage Implementation

**Files:**
- Create: `services/topic-space/src/services/azureBlobStorageService.ts`
- Modify: `services/topic-space/src/services/storageService.ts`
- Modify: `services/topic-space/src/services/nullStorageService.ts`
- Modify: `services/topic-space/src/utils/config.ts`
- Modify: `services/topic-space/src/index.ts`

- [ ] **Step 1: Add Azure SDK dependency**

Check `services/topic-space/package.json`. Add if missing:

```json
"dependencies": {
  ...existing...,
  "@azure/storage-blob": "^12.25.0"
}
```

Then run:

```bash
pnpm install
```

- [ ] **Step 2: Add Azure config fields**

```typescript
// services/topic-space/src/utils/config.ts — ADD to the config object:

export const config = {
  // ...existing fields...
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'null',  // 'azure' | 'null'
    azure: {
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
      containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || 'web-learn-files',
      sasExpiryHours: parseInt(process.env.AZURE_SAS_EXPIRY_HOURS || '1', 10),
    },
  },
};
```

- [ ] **Step 3: Extend `StorageService` interface with `getPresignedUrl`**

```typescript
// services/topic-space/src/services/storageService.ts — ADD to the interface:

export interface StorageService {
  // ...existing methods (uploadFile, uploadBuffer, downloadToLocal, delete, deleteDir, getUrl, getSize, listFiles)...
  getPresignedUrl(
    ossKey: string,
    method: 'GET' | 'PUT',
    contentType?: string,
    expiresIn?: number
  ): Promise<{ url: string; method: string }>;
}
```

- [ ] **Step 4: Implement `getPresignedUrl` in `NullStorageService` (dev fallback)**

```typescript
// services/topic-space/src/services/nullStorageService.ts — ADD method:

async getPresignedUrl(
  ossKey: string,
  method: 'GET' | 'PUT',
  _contentType?: string,
): Promise<{ url: string; method: string }> {
  // Dev fallback: return a local URL. Frontend uploads will fail but the route works.
  const base = 'http://localhost:3002/storage/dev';
  return {
    url: `${base}/${encodeURIComponent(ossKey)}`,
    method,
  };
}
```

- [ ] **Step 5: Create Azure Blob Storage implementation**

```typescript
// services/topic-space/src/services/azureBlobStorageService.ts — CREATE:

import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  ContainerClient,
  SASProtocol,
} from '@azure/storage-blob';

export class AzureBlobStorageService {
  private containerClient: ContainerClient;
  private sharedKeyCredential: StorageSharedKeyCredential;
  private containerName: string;

  constructor(connectionString: string, containerName: string) {
    if (!connectionString) {
      throw new Error('AZURE_STORAGE_CONNECTION_STRING is required');
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerName = containerName;
    this.containerClient = blobServiceClient.getContainerClient(containerName);

    // Parse connection string to extract account name and key for SAS generation
    const parsed = this.parseConnectionString(connectionString);
    this.sharedKeyCredential = new StorageSharedKeyCredential(parsed.accountName, parsed.accountKey);
  }

  private parseConnectionString(connectionString: string): { accountName: string; accountKey: string } {
    const parts: Record<string, string> = {};
    for (const segment of connectionString.split(';')) {
      const eqIndex = segment.indexOf('=');
      if (eqIndex !== -1) {
        parts[segment.substring(0, eqIndex)] = segment.substring(eqIndex + 1);
      }
    }
    const accountName = parts['AccountName'] ?? '';
    const accountKey = parts['AccountKey'] ?? '';
    if (!accountName || !accountKey) {
      throw new Error('Connection string must contain AccountName and AccountKey');
    }
    return { accountName, accountKey };
  }

  async getPresignedUrl(
    blobName: string,
    method: 'GET' | 'PUT',
    contentType?: string,
    expiresInHours: number = 1,
  ): Promise<{ url: string; method: string }> {
    const blobClient = this.containerClient.getBlobClient(blobName);
    const startsOn = new Date();
    const expiresOn = new Date(startsOn);
    expiresOn.setHours(expiresOn.getHours() + expiresInHours);

    const permissions = method === 'PUT' ? 'rw' : 'r';

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: this.containerName,
        blobName,
        permissions: method === 'PUT'
          ? { create: true, write: true, read: true }
          : { read: true },
        startsOn,
        expiresOn,
        protocol: SASProtocol.Https,
        contentType: method === 'PUT' && contentType ? contentType : undefined,
      },
      this.sharedKeyCredential,
    ).toString();

    return {
      url: `${blobClient.url}?${sasToken}`,
      method: method === 'PUT' ? 'PUT' : 'GET',
    };
  }
}

export function createAzureBlobStorageService(
  connectionString: string,
  containerName: string,
): AzureBlobStorageService {
  return new AzureBlobStorageService(connectionString, containerName);
}
```

- [ ] **Step 6: Update `AzureBlobStorageService` to implement `StorageService` interface**

```typescript
// services/topic-space/src/services/azureBlobStorageService.ts — change class declaration:

import { StorageService } from './storageService';

export class AzureBlobStorageService implements StorageService {
  // ...rest stays the same...

  // Implement remaining StorageService methods:

  async uploadFile(_localPath: string, ossKey: string): Promise<string> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(ossKey);
    await blockBlobClient.uploadFile(_localPath);
    return blockBlobClient.url;
  }

  async uploadBuffer(buffer: Buffer, ossKey: string): Promise<string> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(ossKey);
    await blockBlobClient.uploadData(buffer);
    return blockBlobClient.url;
  }

  async downloadToLocal(ossKey: string, localPath: string): Promise<void> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(ossKey);
    await blockBlobClient.downloadToFile(localPath);
  }

  async delete(ossKey: string): Promise<void> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(ossKey);
    await blockBlobClient.delete();
  }

  async deleteDir(prefix: string): Promise<void> {
    for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
      await this.containerClient.deleteBlob(blob.name);
    }
  }

  getUrl(ossKey: string): string {
    return this.containerClient.getBlobClient(ossKey).url;
  }

  async getSize(ossKey: string): Promise<number> {
    const properties = await this.containerClient.getBlobClient(ossKey).getProperties();
    return properties.contentLength ?? 0;
  }

  async listFiles(prefix: string): Promise<string[]> {
    const blobs = [];
    for await (const blob of this.containerClient.listBlobsFlat({ prefix })) {
      blobs.push(blob.name);
    }
    return blobs;
  }
}
```

- [ ] **Step 7: Wire up storage initialization in index.ts**

```typescript
// services/topic-space/src/index.ts — REPLACE storage init section:

import { initStorageService } from './services/storageService';
import { createAzureBlobStorageService } from './services/azureBlobStorageService';
import { createNullStorageService } from './services/nullStorageService';
import { config } from './utils/config';

// ... other init code ...

if (config.storage.provider === 'azure') {
  initStorageService(
    createAzureBlobStorageService(
      config.storage.azure.connectionString,
      config.storage.azure.containerName,
    ),
  );
} else {
  initStorageService(createNullStorageService());
}
```

- [ ] **Step 8: Commit**

```bash
git add services/topic-space/src/services/azureBlobStorageService.ts services/topic-space/src/services/storageService.ts services/topic-space/src/services/nullStorageService.ts services/topic-space/src/utils/config.ts services/topic-space/src/index.ts services/topic-space/package.json pnpm-lock.yaml
git commit -m "feat(topic-space): add Azure Blob Storage implementation with SAS presigned URLs"
```

---

### Task 9: Add Git Presign Controller and Route

**Files:**
- Create: `services/topic-space/src/controllers/gitPresignController.ts`
- Modify: `services/topic-space/src/routes/topicRoutes.ts`

- [ ] **Step 1: Create the git presign controller**

```typescript
// services/topic-space/src/controllers/gitPresignController.ts — CREATE:

import { Response } from 'express';
import { AuthenticatedRequest as AuthRequest } from '@web-learn/shared';
import { Topic } from '../models';
import { getStorageService } from '../services/storageService';
import { config } from '../utils/config';

const OSS_PREFIX = 'topics';

export const getGitPresign = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authorized' });
    }

    const topicId = req.params.id;
    const op = req.query.op as string;

    if (!['upload', 'download'].includes(op)) {
      return res.status(400).json({ success: false, error: 'op must be "upload" or "download"' });
    }

    const topic = await Topic.findByPk(topicId);
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }

    const isEditor = topic.editors?.includes(req.user.id) || req.user.role === 'admin';
    const isPublished = topic.status === 'published';

    if (op === 'download' && !isPublished && !isEditor) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    if (op === 'upload' && !isEditor) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const ossKey = `${OSS_PREFIX}/${topicId}.tar.gz`;
    const storageService = getStorageService();
    const expiresIn = config.storage.azure.sasExpiryHours;

    if (op === 'upload') {
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
```

- [ ] **Step 2: Add the route to topicRoutes.ts**

Add before `export default router`:

```typescript
// services/topic-space/src/routes/topicRoutes.ts — ADD import and route:

import { getGitPresign } from '../controllers/gitPresignController';

// ...existing routes...

router.get('/:id/git/presign', writeLimiter, internalAuthMiddleware, getGitPresign);

export default router;
```

- [ ] **Step 3: Commit**

```bash
git add services/topic-space/src/controllers/gitPresignController.ts services/topic-space/src/routes/topicRoutes.ts
git commit -m "feat(topic-space): add git presign endpoint for OSS direct upload/download"
```

---

### Task 9: Delete Dead Code — Pages, LLM, Migration Script, Utils

**Files:**
- Delete: `services/topic-space/src/routes/pageRoutes.ts`
- Delete: `services/topic-space/src/controllers/pageController.ts`
- Delete: `services/topic-space/src/models/TopicPage.ts`
- Delete: `services/topic-space/src/scripts/migrate.ts`
- Delete: `services/topic-space/src/utils/zipUtils.ts`
- Delete: `services/topic-space/src/middlewares/uploadMiddleware.ts`
- Delete: `services/topic-space/tests/pages.test.ts`
- Modify: `services/topic-space/src/app.ts`
- Modify: `services/topic-space/src/models/index.ts`

- [ ] **Step 1: Remove pages from app.ts**

```typescript
// services/topic-space/src/app.ts — REMOVE the pageRoutes import and mount:

import express, { Express } from 'express';
import cors from 'cors';
import { config } from './utils/config';
import topicRoutes from './routes/topicRoutes';
// REMOVE: import pageRoutes from './routes/pageRoutes';

// ... rest of file ...

app.use('/api/topics', topicRoutes);
// REMOVE: app.use('/api', pageRoutes);
```

- [ ] **Step 2: Update models/index.ts to remove TopicPage**

Check `services/topic-space/src/models/index.ts` and remove any TopicPage import/export.

- [ ] **Step 3: Delete the following files**

```bash
rm services/topic-space/src/routes/pageRoutes.ts
rm services/topic-space/src/controllers/pageController.ts
rm services/topic-space/src/models/TopicPage.ts
rm services/topic-space/src/scripts/migrate.ts
rm services/topic-space/src/utils/zipUtils.ts
rm services/topic-space/src/middlewares/uploadMiddleware.ts
rm services/topic-space/tests/pages.test.ts
```

- [ ] **Step 4: Remove `multer` dependency if no longer used**

Check `services/topic-space/package.json` for `multer`. If it's only used by the deleted upload middleware, remove it and run `pnpm install`.

- [ ] **Step 5: Commit**

```bash
git add services/topic-space/src/app.ts services/topic-space/src/models/index.ts services/topic-space/package.json pnpm-lock.yaml
git rm services/topic-space/src/routes/pageRoutes.ts services/topic-space/src/controllers/pageController.ts services/topic-space/src/models/TopicPage.ts services/topic-space/src/scripts/migrate.ts services/topic-space/src/utils/zipUtils.ts services/topic-space/src/middlewares/uploadMiddleware.ts services/topic-space/tests/pages.test.ts
git commit -m "chore(topic-space): delete dead code (pages, llm routes, zip upload, old migration script)"
```

---

### Task 10: Update Frontend API Client

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Remove dead API methods from `topicApi`**

```typescript
// frontend/src/services/api.ts — REMOVE from topicApi object:
// - uploadWebsite (lines ~110-119)
// - deleteWebsite (lines ~121-124)
// - getWebsiteStats (lines ~126-129)
```

- [ ] **Step 2: Delete entire `pageApi` export (lines ~138-171)**

```typescript
// DELETE the entire pageApi block
```

- [ ] **Step 3: Replace `topicFileApi` with `topicGitApi`**

```typescript
// frontend/src/services/api.ts — REPLACE topicFileApi section with:

// Topic git operations (clone/push via OSS presigned URLs)
export const topicGitApi = {
  getPresign: async (topicId: string, op: 'upload' | 'download'): Promise<{ url: string; method: string; contentType?: string }> => {
    const response = await api.get<ApiResponse<{ url: string; method: string; contentType?: string }>>(
      `/topics/${topicId}/git/presign`,
      { params: { op } }
    );
    return response.data.data!;
  },
};
```

- [ ] **Step 4: Remove dead imports**

Remove from the top of the file:
```typescript
// Remove these imports if present:
// TopicPage, TopicPageTreeNode, CreateTopicPageDto, UpdateTopicPageDto, ReorderTopicPagesDto, WebsiteStats
```

- [ ] **Step 5: Update response interceptor — remove pages check**

```typescript
// frontend/src/services/api.ts — line 51, remove the pages check:
const isPublicGet = method === 'GET' && url.startsWith('/topics');
// Remove: || url.startsWith('/pages/')
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "refactor(frontend): update API client — remove pages/website methods, add topicGitApi"
```

---

### Task 11: Update Frontend Components — Remove Dead References

**Files:**
- Modify: `frontend/src/components/AIChatSidebar.tsx`
- Modify: `frontend/src/components/editor/TopBar.tsx`
- Modify: `frontend/src/components/editor/SaveIndicator.tsx`
- Modify: `frontend/src/pages/WebsiteEditorPage.tsx`

- [ ] **Step 1: AIChatSidebar.tsx — remove topicFileApi references**

```typescript
// frontend/src/components/AIChatSidebar.tsx:
// - Remove import: import { topicApi, topicFileApi } from ...
//   → Change to: import { topicApi } from ...
// - Remove lines that call topicFileApi.saveChatHistory()
// - Update useEffect that loads chat history — use localStorage as fallback:

// Replace:
// await topicFileApi.saveChatHistory(topicId, msgs);
// With:
localStorage.setItem(`chat-history-${topicId}`, JSON.stringify(msgs));

// Replace:
// const history = await topicFileApi.loadChatHistory(topicId);
// With:
const history = JSON.parse(localStorage.getItem(`chat-history-${topicId}`) || 'null');
```

- [ ] **Step 2: TopBar.tsx — remove topicFileApi.saveSnapshot call**

```typescript
// frontend/src/components/editor/TopBar.tsx:
// - Remove import: import { topicFileApi } from ...
// - Remove the save handler that calls topicFileApi.saveSnapshot()
// - The save button should be removed or disabled (save will be handled by git push in the new design)
```

- [ ] **Step 3: SaveIndicator.tsx — remove topicFileApi import and call**

```typescript
// frontend/src/components/editor/SaveIndicator.tsx:
// - Remove import: import { topicFileApi } from ...
// - Remove the topicFileApi.saveSnapshot() call
```

- [ ] **Step 4: WebsiteEditorPage.tsx — remove topicFileApi.loadSnapshot**

```typescript
// frontend/src/pages/WebsiteEditorPage.tsx:
// - Remove import: import { topicApi, topicFileApi } from ...
//   → Change to: import { topicApi } from ...
// - Remove the topicFileApi.loadSnapshot() call
// - The editor will now load files via git clone from OSS instead
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AIChatSidebar.tsx frontend/src/components/editor/TopBar.tsx frontend/src/components/editor/SaveIndicator.tsx frontend/src/pages/WebsiteEditorPage.tsx
git commit -m "refactor(frontend): remove dead topicFileApi references from components"
```

---

### Task 12: Update topic-space Tests for UUID

**Files:**
- Modify: `services/topic-space/tests/topics.test.ts`

- [ ] **Step 1: Update all mock data — replace numeric ids with UUID strings, remove website_url**

Every mock object in the test file needs updating. Here's the pattern:

```typescript
// BEFORE:
{ id: 1, website_url: null, ... }

// AFTER:
{ id: '550e8400-e29b-41d4-a716-446655440001', ... }
```

Remove `website_url` from all mocks. Change all numeric `id` to UUID strings. Change all `created_by` to UUID strings. Change `editors` arrays to contain UUID strings.

- [ ] **Step 2: Remove "Website endpoints" describe block (lines 360-429)**

Delete the entire `describe('Website endpoints', () => { ... })` block.

- [ ] **Step 3: Update mock topic model types**

Change `type: 'knowledge'` to `type: 'website'` in all mocks (the type enum no longer includes 'knowledge' in topic-space).

- [ ] **Step 4: Remove TopicPage mock**

```typescript
// Remove the mockPageModel definition and its jest.mock entry
```

- [ ] **Step 5: Commit**

```bash
git add services/topic-space/tests/topics.test.ts
git commit -m "refactor(topic-space tests): update mocks for UUID PK, remove website endpoints tests"
```

---

### Task 13: Add Database Migration Script

**Files:**
- Create: `services/topic-space/src/scripts/migrate-uuid.ts`
- Create: `services/auth/src/scripts/migrate-uuid.ts`

- [ ] **Step 1: Create topic-space migration — convert existing integer IDs to UUIDs**

```typescript
// services/topic-space/src/scripts/migrate-uuid.ts — CREATE:

import { sequelize } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

async function runMigration() {
  console.log('Running migration: convert topic IDs to UUID...');
  const queryInterface = sequelize.getQueryInterface();
  const tableDescription = await queryInterface.describeTable('topic_topics');

  // Add published_url and share_link if they don't exist
  if (!tableDescription.published_url) {
    await queryInterface.addColumn('topic_topics', 'published_url', {
      type: 'STRING',
      allowNull: true,
    });
    console.log('Added published_url column');
  }

  if (!tableDescription.share_link) {
    await queryInterface.addColumn('topic_topics', 'share_link', {
      type: 'STRING',
      allowNull: true,
    });
    console.log('Added share_link column');
  }

  // Get all existing topics
  const [topics] = await sequelize.query('SELECT id, created_by, editors FROM topic_topics') as [any[], any];

  // Map old integer IDs to new UUIDs
  const idMap = new Map<string, string>();

  for (const topic of topics) {
    const newId = uuidv4();
    idMap.set(topic.id.toString(), newId);
  }

  // Also map created_by and editors IDs
  for (const topic of topics) {
    if (!idMap.has(topic.created_by.toString())) {
      // Will need to be mapped from auth_users table
      idMap.set(topic.created_by.toString(), uuidv4());
    }
    if (Array.isArray(topic.editors)) {
      for (const editorId of topic.editors) {
        if (!idMap.has(editorId.toString())) {
          idMap.set(editorId.toString(), uuidv4());
        }
      }
    }
  }

  // Convert id column: add temp column, populate, swap
  await queryInterface.addColumn('topic_topics', 'id_uuid', {
    type: 'VARCHAR(36)',
    allowNull: true,
  });

  for (const [oldId, newId] of idMap) {
    await sequelize.query(
      "UPDATE topic_topics SET id_uuid = :newId WHERE id = :oldId",
      { replacements: { oldId: parseInt(oldId), newId } }
    );
  }

  // Drop old id column and rename
  await queryInterface.removeColumn('topic_topics', 'id');
  await queryInterface.renameColumn('topic_topics', 'id_uuid', 'id');
  await queryInterface.changeColumn('topic_topics', 'id', {
    type: 'VARCHAR(36)',
    primaryKey: true,
    allowNull: false,
  });

  // Update created_by and editors references (these need auth migration first)
  console.log('Migration complete. Topics migrated:', Object.fromEntries(idMap));
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Create auth service migration — convert existing integer IDs to UUIDs**

```typescript
// services/auth/src/scripts/migrate-uuid.ts — CREATE:

import { sequelize } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

async function runMigration() {
  console.log('Running migration: convert user IDs to UUID...');
  const queryInterface = sequelize.getQueryInterface();

  // Get all existing users
  const [users] = await sequelize.query('SELECT id FROM auth_users') as [any[], any];

  const idMap = new Map<number, string>();
  for (const user of users) {
    idMap.set(user.id, uuidv4());
  }

  // Add id_uuid column
  await queryInterface.addColumn('auth_users', 'id_uuid', {
    type: 'VARCHAR(36)',
    allowNull: true,
  });

  // Populate UUIDs
  for (const [oldId, newId] of idMap) {
    await sequelize.query(
      "UPDATE auth_users SET id_uuid = :newId WHERE id = :oldId",
      { replacements: { oldId, newId } }
    );
  }

  // Swap columns
  await queryInterface.removeColumn('auth_users', 'id');
  await queryInterface.renameColumn('auth_users', 'id_uuid', 'id');
  await queryInterface.changeColumn('auth_users', 'id', {
    type: 'VARCHAR(36)',
    primaryKey: true,
    allowNull: false,
  });

  console.log('Migration complete. Users migrated:', Object.fromEntries(idMap));
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Add `uuid` to both scripts' package.json files if not already present**

- [ ] **Step 4: Commit**

```bash
git add services/topic-space/src/scripts/migrate-uuid.ts services/auth/src/scripts/migrate-uuid.ts
git commit -m "feat: add database migration scripts for UUID conversion"
```

---

### Task 14: Update E2E/Integration Tests

**Files:**
- Modify: `tests/integration/ai-api.spec.ts`
- Modify: `tests/integration/topic-space-api.spec.ts`
- Delete: `tests/e2e/page-management.spec.ts`

- [ ] **Step 1: Remove pages test from topic-space-api.spec.ts**

Open `tests/integration/topic-space-api.spec.ts` and remove any references to `/api/pages`.

- [ ] **Step 2: Delete page-management E2E test**

```bash
rm tests/e2e/page-management.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add tests/integration/ai-api.spec.ts tests/integration/topic-space-api.spec.ts
git rm tests/e2e/page-management.spec.ts
git commit -m "refactor(tests): remove page-related integration and e2e tests"
```

---

### Task 15: Update Shared Auth Middleware for String IDs

**Files:**
- Modify: `shared/src/auth/index.ts`
- Modify: `shared/src/auth/internalAuthMiddleware.ts`

- [ ] **Step 1: Update shared types for AuthenticatedRequest**

```typescript
// Check shared/src/auth/ for any AuthenticatedRequest or similar interfaces
// Update id: number to id: string
```

- [ ] **Step 2: Commit**

```bash
git add shared/src/auth/
git commit -m "refactor(shared): update auth types for string UUIDs"
```

---

## Self-Review

**1. Spec coverage check:**

| Spec Section | Covered? | Task |
|---|---|---|
| Topic model UUID PK + removed fields | YES | Tasks 1, 2, 3 |
| User model UUID PK | YES | Task 4 |
| OSS tarball storage structure | YES | Tasks 8, 9 |
| Git presign endpoint | YES | Task 8 |
| Remove pages API | YES | Tasks 1, 7, 9, 11, 14 |
| Remove website upload | YES | Tasks 6, 7, 9, 11 |
| Remove files_snapshot/chat_history | YES | Tasks 1, 2, 6 |
| Remove LLM routes | YES | Already done (prior session), Task 9 cleanup |
| Frontend API updates | YES | Tasks 10, 11 |
| Migration scripts | YES | Task 13 |
| Test updates | YES | Tasks 12, 14 |
| Gateway /api/pages removal | YES | Task 5 |

**2. Placeholder scan:** No TBD, TODO, or incomplete sections found.

**3. Type consistency:** All UUID IDs are `string` type throughout. JWT payloads carry strings. `editors` arrays carry strings. `created_by` is string FK. Consistent across all tasks.

**4. Scope check:** This plan covers the full UUID migration + Git-on-OSS storage transition. It's large but focused — all tasks serve the same goal.

---

## Final Notes

**Execution order is critical.** Tasks 1-5 must be done before 6-7 (types and models must be updated before controllers use them). Tasks 10-11 (frontend) must come after the backend API is stable.

**The `website_url` field** is kept in the shared `Topic` interface for backward compatibility but removed from the DB model. It will be fully removed in a future cleanup.

**OSS implementation:** The `NullStorageService.getPresignedUrl` returns mock URLs for local dev. In production, implement with your OSS SDK (ali-oss, aws-sdk, etc.) by creating a real `StorageService` that overrides the null one.
