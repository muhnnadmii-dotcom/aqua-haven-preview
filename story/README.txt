AQUA HAVEN — LIVING ROOM TO AQUARIUM

Separate interactive homepage prototype, 2026-11-05.

Confirmed brief:
Bright elegant living room in daylight; a planted freshwater tank on a table.
Native page scrolling takes the camera toward the tank, through the glass,
and inside. Further scrolling introduces substrate, plants and filtration.
Scrolling backward reverses the camera journey.

This folder is the editable frontend source. Serve it over HTTP as /story/
under the existing static preview so ../shop/, ../products/ and ../designer/
keep their established routes. Open index.html through a local HTTP server;
ES modules do not reliably work when opened using file://.

The preview does not connect this page to the WordPress checkout. Its links
open the existing public frontend catalog preview. No payments are taken.
The working local WordPress/WooCommerce store and earlier visual concept
are preserved separately.

Artwork:
Original room, portrait room, underwater scene and isolated tetra artwork
were generated with the built-in image tool, without a paid API.
WebP assets are encoded from preserved original PNGs. Product thumbnails
are actual existing catalog photographs, used as examples, not an exact
equipment or planting list for the inspirational scene. Prices/availability
are intentionally not copied into this standalone homepage.
The local production prompts are saved in work/realistic-scroll-v11/image-prompts.json.

Controls:
Scroll normally to control the camera, or use the chapter buttons.
Skip the journey to browse components immediately.
Pause shows a static scene and shortens the journey. Reduced-motion device
settings also provide a static experience with product links available.
If JavaScript is unavailable, the room and component links remain usable.
