# Team Photos

There are two ways to add photos:

1. **Photo form** — Go to [austinballrz.com/admin/photo/](https://www.austinballrz.com/admin/photo/) and submit. It creates a pull request for review. Merge to publish.
2. **Manual** — Edit `photos.json` in this folder and push.

---

## photos.json format

Array of year groups. Each group has a year and a list of photos:

```json
{
  "year": "2024",
  "description": "Optional note about this year",
  "photos": [
    {
      "src": "my-photo.jpg",
      "alt": "D team after the Dallas tournament",
      "team": "d",
      "hero": true
    }
  ]
}
```

## Fields

| Field | Required | Default | What it does |
|-------|----------|---------|--------------|
| `src` | Yes | — | Just the filename |
| `alt` | Yes | — | Description — shown as caption and used for accessibility |
| `team` | No | — | `"d"` or `"e"` — omit for whole-team photos |
| `featured` | No | `true` | Set `false` to hide from carousels on other pages |
| `hero` | No | `false` | Set `true` for homepage hero rotation |

## Where photos show up

| Location | Which photos |
|----------|-------------|
| Photos page (`/photos/`) | All photos, grouped by year |
| Carousels (all other pages) | All unless `"featured": false` |
| Homepage hero | Randomly picks from `"hero": true` (if only one, stays fixed) |

## Image tips

- JPG format, 1200-1600px wide
- Landscape (4:3 or 16:9) works best in carousels
- Name clearly: `dallas-2024-d-team.jpg` not `IMG_4532.jpg`
- Photos submitted via the form are automatically resized
