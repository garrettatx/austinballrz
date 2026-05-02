/**
 * Photo data — reads from public/images/team/photos.json
 *
 * To add/edit photos, edit the JSON file in the photos folder.
 * This file just reads it and exports typed helpers for the site.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface Photo {
  src: string;
  alt: string;
  caption?: string;
  team?: 'd' | 'e';
  featured?: boolean;
  hero?: boolean;
}

export interface PhotoYear {
  year: string;
  heading?: string;
  description?: string;
  photos: Photo[];
}

// Read the JSON at build time
const jsonPath = path.resolve('public/images/team/photos.json');
const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as PhotoYear[];

// Prefix src paths with /images/team/ so JSON only needs filenames
export const photoYears: PhotoYear[] = raw.map(group => ({
  ...group,
  photos: group.photos.map(p => ({
    ...p,
    src: p.src.startsWith('/') ? p.src : `/images/team/${p.src}`,
  })),
}));

/** All photos flattened (newest first) */
export const allPhotos = photoYears.flatMap(y => y.photos);

/** Featured photos — all unless explicitly excluded (featured: false) */
export const featuredPhotos = photoYears.flatMap(y =>
  y.photos.filter(p => p.featured !== false)
);

/** Hero photos — for homepage hero rotation */
export const heroPhotos = allPhotos.filter(p => p.hero);
