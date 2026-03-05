export type CampusName = "岱宗校区" | "泮河校区" | "西北片区";

export type SectionCode = "0102" | "0304" | "中午" | "0506" | "0708" | "0910" | "晚间";

export interface EmptyRoomQuery {
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  sectionCode: SectionCode;
  campus: CampusName;
}

export interface EmptyRoomItem {
  id: string;
  campus: CampusName;
  roomName: string;
}

export interface EmptyRoomResponse {
  query: EmptyRoomQuery;
  term: string;
  week: number;
  total: number;
  rooms: EmptyRoomItem[];
}
