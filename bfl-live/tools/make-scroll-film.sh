#!/usr/bin/env bash
# Turns a filmed clip into files that scrub smoothly with scroll.
#
# Usage:   bash tools/make-scroll-film.sh path/to/clip.mp4 [start_seconds] [length_seconds]
# Example: bash tools/make-scroll-film.sh ~/Downloads/jory-pullups.mov 2 7
#
# Needs ffmpeg (Mac: brew install ffmpeg · Windows: winget install ffmpeg).
#
# Makes:
#   assets/film.mp4               landscape, every frame a keyframe (smooth forwards and backwards)
#   assets/film-mobile.mp4        9:16 crop from the centre, for phones
#   assets/film/frame_0001.jpg…   optional image sequence (smoothest; switch on in js/main.js)
set -euo pipefail

IN="${1:?Give the clip to convert, e.g. bash tools/make-scroll-film.sh clip.mp4}"
START="${2:-0}"
LEN="${3:-}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/assets"
mkdir -p "$DIR/film" "$DIR/film-mobile"

TRIM=(-ss "$START")
[ -n "$LEN" ] && TRIM+=(-t "$LEN")

# -g 1 makes every frame a keyframe, which is what lets the browser jump to any point instantly
ENC=(-c:v libx264 -pix_fmt yuv420p -preset slow -crf 23 -g 1 -keyint_min 1 -sc_threshold 0 -an -movflags +faststart)

echo "→ Desktop video"
ffmpeg -y -loglevel error "${TRIM[@]}" -i "$IN" -vf "fps=25,scale=1920:-2" "${ENC[@]}" "$DIR/film.mp4"

echo "→ Phone video (portrait crop)"
ffmpeg -y -loglevel error "${TRIM[@]}" -i "$IN" -vf "fps=25,crop='min(iw,ih*9/16)':ih,scale=720:-2" "${ENC[@]}" "$DIR/film-mobile.mp4"

echo "→ Image sequences"
rm -f "$DIR/film/"*.jpg "$DIR/film-mobile/"*.jpg
ffmpeg -y -loglevel error "${TRIM[@]}" -i "$IN" -vf "fps=25,scale=1600:-2" -q:v 4 "$DIR/film/frame_%04d.jpg"
ffmpeg -y -loglevel error "${TRIM[@]}" -i "$IN" -vf "fps=25,crop='min(iw,ih*9/16)':ih,scale=720:-2" -q:v 4 "$DIR/film-mobile/frame_%04d.jpg"

COUNT=$(ls "$DIR/film/" | wc -l | tr -d ' ')
MCOUNT=$(ls "$DIR/film-mobile/" | wc -l | tr -d ' ')
du -sh "$DIR/film.mp4" "$DIR/film-mobile.mp4" "$DIR/film" "$DIR/film-mobile"
echo
echo "Done. The videos are picked up automatically."
echo "For the image sequence (smoothest), set this in js/main.js:"
echo "  frames:       { path: \"assets/film/frame_\", digits: 4, ext: \".jpg\", count: $COUNT },"
echo "  mobileFrames: { path: \"assets/film-mobile/frame_\", digits: 4, ext: \".jpg\", count: $MCOUNT },"
