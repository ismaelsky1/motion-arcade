import { useEffect, useRef, useState, type RefObject } from 'react'
import { HandTracker } from '../tracking/handTracker'
import type { Tracker } from '../tracking/tracker'

export type StatusTracker = 'iniciando' | 'pronto' | 'erro'

const LIMIAR_POUCA_LUZ = 60 // média 0-255 abaixo disso soa o aviso
const INTERVALO_LUZ_MS = 1000

export function useTracker(videoRef: RefObject<HTMLVideoElement | null>, ativo: boolean) {
  const trackerRef = useRef<Tracker | null>(null)
  const [status, setStatus] = useState<StatusTracker>('iniciando')
  const [erro, setErro] = useState<string | null>(null)
  const [poucaLuz, setPoucaLuz] = useState(false)
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    if (!ativo) return

    let cancelado = false
    let stream: MediaStream | null = null

    async function iniciar() {
      setStatus('iniciando')
      setErro(null)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        })
        const video = videoRef.current
        if (cancelado || !video) return
        video.srcObject = stream
        await video.play()

        const tracker = new HandTracker()
        await tracker.start(video)
        if (cancelado) {
          tracker.stop()
          return
        }
        trackerRef.current = tracker
        setStatus('pronto')
      } catch (e) {
        if (!cancelado) {
          setErro(e instanceof Error ? e.message : String(e))
          setStatus('erro')
        }
      }
    }

    iniciar()

    return () => {
      cancelado = true
      trackerRef.current?.stop()
      trackerRef.current = null
      stream?.getTracks().forEach((faixa) => faixa.stop())
    }
  }, [videoRef, tentativa, ativo])

  useEffect(() => {
    if (status !== 'pronto') {
      setPoucaLuz(false)
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 24
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    const intervalo = setInterval(() => {
      const video = videoRef.current
      if (!video || video.videoWidth === 0) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
      let soma = 0
      for (let i = 0; i < data.length; i += 4) {
        soma += (data[i] + data[i + 1] + data[i + 2]) / 3
      }
      const media = soma / (data.length / 4)
      setPoucaLuz(media < LIMIAR_POUCA_LUZ)
    }, INTERVALO_LUZ_MS)

    return () => clearInterval(intervalo)
  }, [status, videoRef])

  return {
    trackerRef,
    status,
    erro,
    poucaLuz,
    tentarNovamente: () => setTentativa((n) => n + 1),
  }
}
