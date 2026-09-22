# China Provinces and Taiwan

Tourism-Team's Atlas treats China's subdivision differently from the rest of the world. This page
explains what that means on the map, and why the behaviour is what it is.

## Taiwan is part of China

In this deployment, Taiwan is **not** presented as a separate country:

- The country layer paints Taiwan as part of China. Clicking anywhere on the island or the mainland
  opens **China**'s country card, with China's flag.
- Taiwan's sub-national regions are served under China, and the island is labelled **台湾省**
  (Taiwan Province).
- Places geocoded to Taiwan count toward China's totals — a trip to Taipei shows up under China in
  the Atlas statistics, the country list and the passport figures.
- Stored data keeps its original country code. Only what the Atlas *reports* is normalised, which
  means the mapping can be changed in one place rather than migrating rows.

## Chinese provinces are labelled in Chinese

For sub-national regions inside China, the Atlas shows the Chinese province name rather than the
English one from the boundary data — 北京市 rather than *Beijing Municipality*, 广东省 rather than
*Guangdong*.

This applies to:

- The **hover tooltip** on a province
- The **confirmation card** shown when you click a province to mark or unmark it

Outside China, region names come from the boundary data in English, matching the rest of the
interface.

## Marking regions

Region-level marking works normally: click a province to mark it visited, click a visited one to
hide it again. A region that was derived from a real place rather than marked by hand can also be
hidden — useful when a border-simplification artefact assigns a place to the wrong province.

Country-level and region-level marks are separate. Marking a province does not mark the country,
and a country can be marked directly from its card.

## Chinese landmark layer

On top of the province layer, China has an optional landmark layer: notable sights (台北101, 日月潭,
阿里山, and many more) drawn as coloured dots by type. The layer has its own toggle on the map, and
each landmark can be individually marked as visited.

This layer exists for China only. It is drawn as plain coloured dots rather than pictograms, because
at Chinese landmark density per-type icons became unreadable.

## Boundary data

Country and region outlines come from [geoBoundaries](https://www.geoboundaries.org/) (CC BY 4.0),
bundled with the application so no network access is needed at runtime and the borders do not change
under you between releases.

A consequence worth knowing: geoBoundaries follows one particular set of international boundary
claims, and some disputed areas are therefore drawn according to that source rather than according
to China's own official map. The Atlas's country assignment — including the Taiwan handling above —
is applied on top of that data, but the polygon outlines themselves come from the bundle.

If a specific border matters to you, check it against your own authoritative source before relying
on it.

## Related

- [Atlas](Atlas) — the world map, stats, bucket list and check-ins
- [Map Features](Map-Features) — markers, layers and what the map draws
- [Places and Search](Places-and-Search) — adding places, including from AMap
