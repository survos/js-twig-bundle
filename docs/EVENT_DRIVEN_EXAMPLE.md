# Event-Driven Example (ScanStation pattern)

This pattern comes from a real integration where multiple page regions update from events:

- tree/controller selects a container
- image grid re-renders from Twig blocks in JS
- detail panel re-renders when image selection changes

## Event contract

Use explicit `window` events as the boundary between controllers:

- `station:instance-selected` `{ id }`
  - emitted by container/tree controller
  - consumed by image-grid controller to load/render new instance images
- `show-pages:image-selected` `{ id, img, instanceId }`
  - emitted by image-grid controller when user clicks a tile
  - consumed by station/detail controller to render right panel context
- `station:image-selected` `{ id, img, instanceId }` (optional)
  - emitted by station/detail controller when selection starts there
  - consumed by image-grid controller to keep tile highlight/detail in sync

## Twig side

Define reusable blocks once in Twig:

- `imageGrid`
- `imageTile`
- `imageThumbnail`
- `imageDetail`
- `detailContextHeader`

Extract them from the caller template and emit block JSON in a script tag:

```twig
<script type="application/json" id="show-pages-blocks">
    {{ this.blocks|json_encode|raw }}
</script>
```

## Controller setup

Both controllers compile the same registry from `#show-pages-blocks`:

```js
this.tpl = {};
installTwigAPI({ Routing, StimAttrs, blockRegistry: this.tpl });
compileTwigBlocks(this.tpl, 'show-pages-blocks');
```

Render by block name only:

```js
const html = twigRender(this.tpl, 'imageDetail', { img, container, globals });
```

## Why this works well

- Twig remains the source of markup truth.
- Controllers pass data, not HTML strings.
- Different page regions can re-render independently from events.
- You can migrate one region at a time without rewriting all UI logic.

## Common pitfalls

- Missing event listener wiring (emit exists, but no consumer).
- Mismatched event payload keys (`id` vs `instanceId`).
- Using Twig syntax unsupported by twig.js 1.x in client-rendered blocks.
- Compiling blocks before the JSON script tag exists in DOM.
