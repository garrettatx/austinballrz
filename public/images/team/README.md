# Team Photos

There are two ways to add photos:

1. **Photo form** — Go to [austinballrz.com/admin/photo/](https://www.austinballrz.com/admin/photo/) and submit. It creates a pull request for review. Merge to publish.
2. **Manual** — Edit `photos.json` in this folder and push.

---

## Folder structure

Photos are organized by year:

```
public/images/team/
├── 2013/
├── 2015/
├── 2016/
├── ...
├── 2026/
├── photos.json
└── README.md
```

## File naming convention

```
{name}-{context}-{season}-{year}.jpg
```

**Rules:**
- All lowercase, hyphens only, no spaces or underscores
- `.jpg` extension always (never `.JPG`, `.jpeg`, `.png`)
- Person photos: first name first (`albert-d-team-fall-2016.jpg`)
- Group photos: use `team` as the name (`team-d-team-fall-2016.jpg`)
- Two people: both names (`johng-tim-d-team-fall-2016.jpg`)
- Duplicates: append a number (`garrett-d-team-fall-2016-2.jpg`)
- Context: team or event (`d-team`, `e-team`, `gsws`, `hoedown`)
- Season/event: `fall`, `spring`, `gsws`, `hoedown`, `social`
- Year always last before extension

**Examples:**
- `albert-d-team-fall-2016.jpg` (individual player)
- `team-d-team-fall-2016.jpg` (group shot)
- `team-gsws-minneapolis-2023.jpg` (tournament)
- `team-e-team-spring-2026.jpg` (E team group)

## Image specs

- JPG format, 1200-1600px on the longest edge
- Landscape (4:3 or 16:9) works best in carousels
- Target file size under 500KB (resize and compress if larger)
- Photos submitted via the form are automatically resized

## photos.json format

Array of year groups. Each group has a year and a list of photos.
The `src` field includes the year subfolder path:

```json
{
  "year": "2016",
  "description": "D Team - Fall 2016",
  "photos": [
    {
      "src": "2016/team-d-team-fall-2016.jpg",
      "alt": "D Team group photo on the field, Fall 2016 season",
      "caption": "D Team - Fall 2016",
      "team": "d"
    },
    {
      "src": "2016/albert-d-team-fall-2016.jpg",
      "alt": "Albert on the softball field, D Team Fall 2016",
      "caption": "Albert",
      "team": "d"
    }
  ]
}
```

## Fields

| Field | Required | Default | What it does |
|-------|----------|---------|--------------|
| `src` | Yes | — | Year subfolder + filename (e.g. `2016/albert-d-team-fall-2016.jpg`) |
| `alt` | Yes | — | Descriptive text for screen readers (see alt text rules below) |
| `caption` | No | — | Short display caption (e.g. "Albert", "GSWS Minneapolis 2023") |
| `team` | No | — | `"d"` or `"e"` — omit for whole-team photos |
| `featured` | No | `true` | Set `false` to hide from carousels on other pages |
| `hero` | No | `false` | Set `true` for homepage hero rotation |

## Where photos show up

| Location | Which photos |
|----------|-------------|
| Photos page (`/photos/`) | All photos, grouped by year |
| Carousels (all other pages) | All unless `"featured": false` |
| Homepage hero | Randomly picks from `"hero": true` |

## Alt text rules

Alt text is read aloud by screen readers. It should describe what is in the image, not just label it.

**Pattern:** `{who} {doing what or where}, {context}`

**Good examples:**
- `"D Team group photo on the field, Fall 2016 season"`
- `"Albert on the softball field, D Team Fall 2016"`
- `"John G and Tim on the softball field, D Team Fall 2016"`
- `"Austin Ball'rz at the Gay Softball World Series in Minneapolis, 2023"`

**Bad examples:**
- `"D Team"` (too vague, doesn't describe the image)
- `"photo.jpg"` (filename, not a description)
- `"Albert - D Team Fall 2016"` (reads like a label, not a description)

**Caption** is separate from alt. Caption is the short text shown on screen (e.g. "Albert"). Alt is the full description for accessibility.
