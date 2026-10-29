import { Meme } from "../storage/models";
export interface MemeSearchProvider {
  search(query: string, memes: Meme[]): Meme[];
  keywords(meme: Meme): string[];
}
export class LocalSearchProvider implements MemeSearchProvider {
  keywords(meme: Meme): string[] {
    return [meme.name, ...meme.aliases, ...meme.tags, ...meme.triggers];
  }
  // Used by non-Raycast callers. The Grid delegates fuzzy ranking to Raycast.
  search(query: string, memes: Meme[]): Meme[] {
    const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return memes.filter((m) =>
      words.every((w) => this.keywords(m).some((v) => v.toLocaleLowerCase().includes(w))),
    );
  }
}
