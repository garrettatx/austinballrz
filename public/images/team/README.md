# Team Photos

**To add or update photos, edit `photos.json` in this folder.** That's the only file you need to touch.

---

## How to add a photo

1. Drop the image file in this folder (`public/images/team/`)
2. Open `photos.json` and add an entry under the right year

That's it. The site reads from `photos.json` at build time.

---

## photos.json format

The file is an array of year groups. Each group has a year and a list of photos:

```json
{
  "year": "2024",
  "description": "Optional note about this year",
  "photos": [
    {
      "src": "my-photo.jpg",
      "alt": "Describe what's in the photo",
      "caption": "Short label for carousels",
      "team": "d",
      "hero": true
    }
  ]
}
```

---

## Fields

| Field | Required | Default | What it does |
|-------|----------|---------|--------------|
| `src` | Yes | — | Just the filename (e.g. `my-photo.jpg`) |
| `alt` | Yes | — | Description for screen readers — be specific |
| `caption` | No | — | Short text shown below the photo in carousels |
| `team` | No | — | `"d"` or `"e"` — leave out for whole-team photos |
| `featured` | No | `true` | Set `false` to hide from carousels on other pages |
| `hero` | No | `false` | Set `true` for homepage hero rotation |

---

## Where photos show up

| Location | Which photos |
|----------|-------------|
| Photos page (`/photos/`) | All photos, grouped by year |
| Carousels (homepage, etc.) | All unless `"featured": false` |
| Homepage hero | Randomly picks from `"hero": true` photos (if only one, it stays fixed) |

---

## Image tips

- Use `.jpg` for photos
- Aim for 1200-1600px wide
- Landscape orientation (4:3 or 16:9) works best
- Name files clearly: `gsws-2024-group.jpg` not `IMG_4532.jpg`
