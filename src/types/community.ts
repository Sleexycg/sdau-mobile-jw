export type CommunityType = "bug" | "chat";
export type CommunityStatus = "open" | "in_progress" | "resolved" | "closed";

export interface CommunityComment {
  id: string;
  topicId: string;
  content: string;
  authorName: string;
  authorId: string;
  createdAt: string;
}

export interface CommunityTopic {
  id: string;
  type: CommunityType;
  title: string;
  content: string;
  authorName: string;
  authorId: string;
  anonymous: boolean;
  status: CommunityStatus;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  comments: CommunityComment[];
}

export interface CommunityPayload {
  topics: CommunityTopic[];
}
