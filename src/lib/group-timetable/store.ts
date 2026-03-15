import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { GroupMemberTimetable } from "@/types/group-timetable";

interface GroupMemberStore {
  members: GroupMemberTimetable[];
}

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "group_timetable_members.json");

let writeQueue: Promise<void> = Promise.resolve();

function normalizeNickname(nickname: string): string {
  return nickname.trim();
}

function nicknameCompareKey(nickname: string): string {
  return normalizeNickname(nickname).toLocaleLowerCase();
}

async function ensureStore(): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    const initial: GroupMemberStore = { members: [] };
    await writeFile(dataFile, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<GroupMemberStore> {
  await ensureStore();
  const raw = await readFile(dataFile, "utf8");
  const parsed = JSON.parse(raw) as GroupMemberStore;
  if (!parsed || !Array.isArray(parsed.members)) {
    return { members: [] };
  }
  return parsed;
}

function queueWrite(mutator: (data: GroupMemberStore) => void | Promise<void>): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const data = await readStore();
    await mutator(data);
    await writeFile(dataFile, JSON.stringify(data, null, 2), "utf8");
  });
  return writeQueue;
}

export async function listGroupMembers(): Promise<GroupMemberTimetable[]> {
  const data = await readStore();
  return [...data.members].sort((a, b) => (a.importedAt < b.importedAt ? 1 : -1));
}

export async function getGroupMemberByNickname(nickname: string): Promise<GroupMemberTimetable | null> {
  const key = nicknameCompareKey(nickname);
  if (!key) return null;
  const data = await readStore();
  const found = data.members.find((m) => nicknameCompareKey(m.nickname) === key);
  return found ?? null;
}

export async function upsertGroupMember(member: GroupMemberTimetable): Promise<GroupMemberTimetable> {
  const nickname = normalizeNickname(member.nickname);
  const compareKey = nicknameCompareKey(member.nickname);
  if (!nickname || !compareKey) {
    throw new Error("NICKNAME_REQUIRED");
  }

  const normalized: GroupMemberTimetable = {
    ...member,
    nickname,
    importedAt: member.importedAt || new Date().toISOString(),
  };

  await queueWrite((data) => {
    const idx = data.members.findIndex((m) => nicknameCompareKey(m.nickname) === compareKey);
    if (idx >= 0) {
      data.members[idx] = normalized;
    } else {
      data.members.push(normalized);
    }
  });

  return normalized;
}

export async function deleteGroupMemberByNickname(nickname: string): Promise<void> {
  const key = nicknameCompareKey(nickname);
  if (!key) return;

  await queueWrite((data) => {
    const idx = data.members.findIndex((m) => nicknameCompareKey(m.nickname) === key);
    if (idx >= 0) {
      data.members.splice(idx, 1);
    }
  });
}
