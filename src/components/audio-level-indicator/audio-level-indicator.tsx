"use client"

import type React from "react"
import { useEffect, useState, useRef } from "react"
import cn from "classnames"
import "./audio-level-indicator.scss"

interface AudioLevelIndicatorProps {
  deviceId?: string
  type: "input" | "output"
  isActive?: boolean
  barCount?: number
}

export const AudioLevelIndicator: React.FC<AudioLevelIndicatorProps> = ({
  deviceId,
  type,
  isActive = true,
  barCount = 24,
}) => {
  const [level, setLevel] = useState(0)
  const [peak, setPeak] = useState(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const peakRef = useRef(0)
  const peakDecayRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isActive || type !== "input") {
      setLevel(0)
      setPeak(0)
      return
    }

    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        })
        streamRef.current = stream

        audioContextRef.current = new AudioContext()
        analyserRef.current = audioContextRef.current.createAnalyser()
        analyserRef.current.fftSize = 256
        analyserRef.current.smoothingTimeConstant = 0.8

        const source = audioContextRef.current.createMediaStreamSource(stream)
        source.connect(analyserRef.current)

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)

        const updateLevel = () => {
          if (!analyserRef.current) return

          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
          const normalizedLevel = Math.min(100, (average / 128) * 100)
          setLevel(normalizedLevel)

          // Peak hold
          if (normalizedLevel > peakRef.current) {
            peakRef.current = normalizedLevel
            setPeak(normalizedLevel)
          }

          animationRef.current = requestAnimationFrame(updateLevel)
        }

        // Peak decay
        const decayPeak = () => {
          peakRef.current = Math.max(0, peakRef.current - 1.5)
          setPeak(peakRef.current)
          peakDecayRef.current = requestAnimationFrame(decayPeak)
        }

        updateLevel()
        decayPeak()
      } catch (error) {
        console.error("Failed to initialize audio:", error)
      }
    }

    initAudio()

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (peakDecayRef.current) cancelAnimationFrame(peakDecayRef.current)
      if (audioContextRef.current) {
        void audioContextRef.current.close()
        audioContextRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [deviceId, isActive, type])

  const activeBars = Math.round((level / 100) * barCount)
  const peakBar = Math.round((peak / 100) * barCount)

  const getBarColor = (index: number, total: number): string => {
    const ratio = index / total
    if (ratio < 0.5) return "green"
    if (ratio < 0.75) return "yellow"
    return "red"
  }

  return (
    <div className="ali">
      <div className="ali__bars">
        {Array.from({ length: barCount }).map((_, i) => {
          const isActiveBar = i < activeBars
          const isPeak = i === peakBar && peak > 0
          const color = getBarColor(i, barCount)

          return (
            <div
              key={i}
              className={cn("ali__bar", {
                "ali__bar--active": isActiveBar,
                [`ali__bar--${color}`]: isActiveBar,
                "ali__bar--peak": isPeak,
              })}
              style={{
                animationDelay: isActiveBar ? `${i * 8}ms` : "0ms",
              }}
            />
          )
        })}
      </div>
      <div className="ali__labels">
        <span className="ali__label">0</span>
        <span className="ali__label">50</span>
        <span className="ali__label">100</span>
      </div>
    </div>
  )
}

export default AudioLevelIndicator
