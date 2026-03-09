import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CommunityComment, CommunityPayload, CommunityStatus, CommunityTopic, CommunityType } from "@/types/community";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "community.json");

let writeQueue: Promise<void> = Promise.resolve();

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureStore(): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    const initial: CommunityPayload = { topics: [] };
    await writeFile(dataFile, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<CommunityPayload> {
  await ensureStore();
  const raw = await readFile(dataFile, "utf8");
  const parsed = JSON.parse(raw) as CommunityPayload;
  if (!parsed || !Array.isArray(parsed.topics)) return { topics: [] };
  return parsed;
}

function queueWrite(mutator: (data: CommunityPayload) => void | Promise<void>): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const data = await readStore();
    await mutator(data);
    await writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
  });
  return writeQueue;
}

export async function listTopics(type?: CommunityType): Promise<CommunityTopic[]> {
  const data = await readStore();
  const topics = (type ? data.topics.filter((t) => t.type === type) : data.topics).map((t) => ({
    ...t,
    anonymous: Boolean(t.anonymous),
  }));
  return [...topics].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export async function createTopic(input: {
  type: CommunityType;
  title: string;
  content: string;
  authorName: string;
  authorId: string;
  anonymous: boolean;
}): Promise<CommunityTopic> {
  const createdAt = nowIso();
  const topic: CommunityTopic = {
    id: uid("topic"),
    type: input.type,
    title: input.title,
    content: input.content,
    authorName: input.authorName,
    authorId: input.authorId,
    anonymous: input.anonymous,
    status: "open",
    pinned: false,
    createdAt,
    updatedAt: createdAt,
    comments: [],
  };

  await queueWrite((data) => {
    data.topics.push(topic);
  });

  return topic;
}

export async function addComment(input: {
  topicId: string;
  content: string;
  authorName: string;
  authorId: string;
}): Promise<CommunityComment> {
  const comment: CommunityComment = {
    id: uid("comment"),
    topicId: input.topicId,
    content: input.content,
    authorName: input.authorName,
    authorId: input.authorId,
    createdAt: nowIso(),
  };

  await queueWrite((data) => {
    const topic = data.topics.find((t) => t.id === input.topicId);
    if (!topic) throw new Error("TOPIC_NOT_FOUND");
    topic.comments.push(comment);
    topic.updatedAt = nowIso();
  });

  return comment;
}

export async function getComment(topicId: string, commentId: string): Promise<CommunityComment> {
  const data = await readStore();
  const topic = data.topics.find((t) => t.id === topicId);
  if (!topic) throw new Error("TOPIC_NOT_FOUND");
  const comment = topic.comments.find((c) => c.id === commentId);
  if (!comment) throw new Error("COMMENT_NOT_FOUND");
  return comment;
}

export async function deleteComment(topicId: string, commentId: string): Promise<void> {
  await queueWrite((data) => {
    const topic = data.topics.find((t) => t.id === topicId);
    if (!topic) throw new Error("TOPIC_NOT_FOUND");
    const idx = topic.comments.findIndex((c) => c.id === commentId);
    if (idx < 0) throw new Error("COMMENT_NOT_FOUND");
    topic.comments.splice(idx, 1);
    topic.updatedAt = nowIso();
  });
}

export async function updateTopic(input: {
  topicId: string;
  status?: CommunityStatus;
  pinned?: boolean;
}): Promise<CommunityTopic> {
  let updated: CommunityTopic | null = null;

  await queueWrite((data) => {
    const topic = data.topics.find((t) => t.id === input.topicId);
    if (!topic) throw new Error("TOPIC_NOT_FOUND");
    if (input.status) topic.status = input.status;
    if (typeof input.pinned === "boolean") topic.pinned = input.pinned;
    topic.updatedAt = nowIso();
    updated = { ...topic, comments: [...topic.comments], anonymous: Boolean(topic.anonymous) };
  });

  if (!updated) throw new Error("TOPIC_NOT_FOUND");
  return updated;
}

export async function deleteTopic(topicId: string): Promise<void> {
  await queueWrite((data) => {
    const idx = data.topics.findIndex((t) => t.id === topicId);
    if (idx < 0) throw new Error("TOPIC_NOT_FOUND");
    data.topics.splice(idx, 1);
  });
}
