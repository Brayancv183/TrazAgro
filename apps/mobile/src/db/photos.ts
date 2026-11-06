import type { SQLiteDatabase } from "expo-sqlite";
import { randomUUID } from "expo-crypto";

/** A photo kept on this phone (not synced yet): of an animal, optionally tied to one of its events. */
export interface Photo {
  id: string;
  farmId: string;
  animalId?: string;
  eventId?: string;
  uri: string;
  note?: string;
  createdAt: string;
}

const toPhoto = (r: Record<string, any>): Photo => ({
  id: r.id, farmId: r.farm_id, animalId: r.animal_id ?? undefined, eventId: r.event_id ?? undefined, uri: r.uri, note: r.note ?? undefined, createdAt: r.created_at,
});

export async function listPhotos(db: SQLiteDatabase, farmId: string, animalId?: string): Promise<Photo[]> {
  const rows = animalId
    ? await db.getAllAsync<Record<string, any>>("SELECT * FROM photos WHERE farm_id = ? AND animal_id = ? ORDER BY created_at DESC", farmId, animalId)
    : await db.getAllAsync<Record<string, any>>("SELECT * FROM photos WHERE farm_id = ? ORDER BY created_at DESC", farmId);
  return rows.map(toPhoto);
}

export async function addPhoto(db: SQLiteDatabase, p: Omit<Photo, "id" | "createdAt">): Promise<Photo> {
  const photo: Photo = { ...p, id: randomUUID(), createdAt: new Date().toISOString() };
  await db.runAsync("INSERT INTO photos (id,farm_id,animal_id,event_id,uri,note,created_at) VALUES (?,?,?,?,?,?,?)",
    photo.id, photo.farmId, photo.animalId ?? null, photo.eventId ?? null, photo.uri, photo.note ?? null, photo.createdAt);
  return photo;
}

export async function deletePhoto(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync("DELETE FROM photos WHERE id = ?", id);
}
