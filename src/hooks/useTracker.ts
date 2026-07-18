import { useEffect, useRef, useState, type RefObject } from 'react'
import { HandTracker } from '../tracking/handTracker'
import type { Tracker } from '../tracking/tracker'

export type StatusTracker = 'iniciando' | 'pronto' | 'erro'

export function useTracker(videoRef: RefObject<HTMLVideoElement | null>) {
  const trackerRef = useRef<Tracker | null>(null)
  const [status, setStatus] = useState<StatusTracker>('iniciando')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    let stream: MediaStream | null = null

    async function iniciar() {
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
  }, [videoRef])

  return { trackerRef, status, erro }
}
