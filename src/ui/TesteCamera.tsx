import { useEffect, useRef, useState } from 'react'
import { useTracker } from '../hooks/useTracker'
import './TesteCamera.css'

const LARGURA = 640
const ALTURA = 480

export default function TesteCamera({ aoVoltar }: { aoVoltar: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { trackerRef, status, erro } = useTracker(videoRef)
  const [maoDetectada, setMaoDetectada] = useState(false)

  useEffect(() => {
    let rafId: number
    let ultimoAtivo = false

    function desenhar() {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      const estado = trackerRef.current?.getState()[0]

      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (estado?.ativo) {
          const x = estado.cursor.x * canvas.width
          const y = estado.cursor.y * canvas.height
          ctx.beginPath()
          ctx.arc(x, y, estado.gestures.pinch ? 14 : 20, 0, Math.PI * 2)
          ctx.strokeStyle = '#66c0f4'
          ctx.lineWidth = 3
          ctx.setLineDash(estado.gestures.pinch ? [] : [6, 6])
          ctx.stroke()
        }
      }

      const ativoAgora = estado?.ativo ?? false
      if (ativoAgora !== ultimoAtivo) {
        ultimoAtivo = ativoAgora
        setMaoDetectada(ativoAgora)
      }

      rafId = requestAnimationFrame(desenhar)
    }

    rafId = requestAnimationFrame(desenhar)
    return () => cancelAnimationFrame(rafId)
  }, [trackerRef])

  return (
    <div className="teste-camera">
      <button className="voltar" onClick={aoVoltar}>
        ← Voltar
      </button>

      <div className="palco" style={{ width: LARGURA, height: ALTURA }}>
        <video ref={videoRef} className="video-espelhado" muted playsInline />
        <canvas ref={canvasRef} width={LARGURA} height={ALTURA} />

        <div className={`pill ${maoDetectada ? 'pill-ok' : 'pill-alerta'}`}>
          {status === 'erro'
            ? `Erro na câmera: ${erro}`
            : status === 'iniciando'
              ? 'Iniciando câmera…'
              : maoDetectada
                ? 'Mão detectada'
                : 'Mostre sua mão'}
        </div>
      </div>
    </div>
  )
}
