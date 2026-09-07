# Originals — not used by the site

Kept for re-editing, but nothing here is loaded by the page:

- `photos/`        the full-size PNGs. The site loads `assets/img/photos/web/*.jpg`,
                   regenerated from these (max 1000px, JPEG q84).
- `flowers-flat/`  the flower sprites before the drop-shadow was baked in.
                   `assets/img/flowers/*.png` are these with the shadow composited
                   and 22px of padding, so the browser never computes it.
- `source/`        the two artworks everything else was derived from.
- `note-blank.png` the full-size card paper; the site loads `assets/img/ui/note-paper.jpg`.

These add ~35MB. GitHub Pages serves the whole repository, so exclude this
folder from the deploy if you want to keep it out.
