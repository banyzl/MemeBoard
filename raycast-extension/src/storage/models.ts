export interface Meme {
  id: string;
  name: string;
  fileName: string;
  originalExtension: string;
  aliases: string[];
  tags: string[];
  triggers: string[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}
export interface MemeDatabase {
  schemaVersion: 1;
  memes: Meme[];
}
export interface MemeInput {
  name: string;
  aliases?: string[];
  tags?: string[];
  triggers?: string[];
  favorite?: boolean;
}
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
