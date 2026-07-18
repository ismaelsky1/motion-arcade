Ponte entre os módulos imperativos (canvas, rastreadores) e o React.
Ver seção 9 do `planejamento-motion-arcade.md`.

- `useTracker.ts` — liga/desliga o rastreamento, expõe estado leve
- `useGameHost.ts` — monta o host no canvas via ref (`useEffect`)
- `useHoverPress.ts` — botões acionados por segurar a mão (2 s)
