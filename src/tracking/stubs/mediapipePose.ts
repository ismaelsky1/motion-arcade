// Stub pra @mediapipe/pose: o @tensorflow-models/pose-detection importa `Pose` estaticamente
// pro runtime BlazePose-MediaPipe (não usado aqui, só MoveNet), mas o pacote real só funciona
// carregado via <script> global, não como módulo ESM — quebra o bundler em build de produção.
// Aliasado no vite.config.ts; esse código nunca roda de verdade.
export class Pose {}
