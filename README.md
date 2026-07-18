# Motion Arcade

Plataforma web de mini-jogos controlados por câmera. Todo o processamento de visão computacional acontece no navegador — nenhum vídeo é enviado a servidor.

Ver [`planejamento-motion-arcade.md`](./planejamento-motion-arcade.md) para a visão geral, arquitetura e roadmap completos.

## Stack

React + Vite + TypeScript. O loop de jogo e o rastreamento rodam fora do React (módulos imperativos em `src/core/`, `src/tracking/` e `src/games/`); a pasta `src/hooks/` é a ponte com a UI declarativa em `src/ui/`.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Deploy (Vercel)

Projeto Vite puro, sem rotas — nenhum `vercel.json` é necessário, a Vercel detecta o framework
automaticamente (`npm run build`, saída em `dist/`). `getUserMedia` exige HTTPS, que a Vercel
fornece por padrão.

1. Suba o repositório para o GitHub (ou GitLab/Bitbucket).
2. Em vercel.com → "Add New Project" → importe o repositório.
3. Deploy automático a cada push na branch principal.
