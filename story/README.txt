AQUA HAVEN — LIVING ROOM TO AQUARIUM

Separate interactive homepage prototype V12, 2026-11-05.

Confirmed brief:
Bright elegant living room in daylight; a planted freshwater tank on a table.
Native page scrolling takes the camera toward the tank, through the glass,
and inside. Ten coherent photographic camera views reveal a filter intake
behind planting, a hidden tetra and a small cherry shrimp on a leaf edge.
The camera finishes looking up at shimmering rippled water and a long
sunlike reflection. Scrolling backward reverses the camera journey.
The previous repeated zoom-in/zoom-out pulses have been removed.

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
V12 camera and discovery prompts are preserved under work/realistic-scroll-v12;
each shipped image has its exact prompt/origin in its .webp.json sidecar.
Unused earlier experiments and original PNGs remain in the local work folder.
Active sequence: assets-manifest.json / sequenceFrames, ten distinct images.
Two image elements blend neighboring views; only nearby frames are prefetched.
Portrait crops aim at the discovered object instead of losing it off-screen.

The water ending uses a small optional WebGL refraction layer. It is loaded
only near the ending, capped near 30fps, and stops offscreen, while hidden,
or when motion is paused/reduced. The complete photograph remains the fallback.

Controls:
Scroll normally to control the camera, or use the chapter buttons.
Skip the journey to browse components immediately.
Pause shows static discovery views and shortens the journey. Reduced-motion
device settings provide the same accessible chapter navigation without loops.
If JavaScript is unavailable, the room and component links remain usable.

Catalog truth:
The current imported preview has no live fish or shrimp listing. Fish scenes
lead to food and feeding; the shrimp scene leads to a real shrimp-food item.
Illustrated creatures are not represented as available live-animal stock.
The original V11 source backup and earlier concept remain saved separately.
