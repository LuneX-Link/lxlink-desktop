"use client"

import type React from "react"
import { memo, useMemo } from "react"
import { VideoTrack } from "@livekit/components-react"
import type { TrackReference } from "@livekit/components-core"
import { Track, type Participant, type TrackPublication } from "livekit-client"
import cn from "classnames"
import "./livekit-video.scss"

interface LiveKitVideoProps {
  participant?: Participant
  track?: TrackPublication | TrackReference
  trackRef?: TrackReference
  source?: Track.Source
  className?: string
  objectFit?: "cover" | "contain"
  mirror?: boolean
}

const isTrackReference = (track: TrackPublication | TrackReference): track is TrackReference =>
  "participant" in track && "publication" in track && "source" in track

export const LiveKitVideo: React.FC<LiveKitVideoProps> = memo(
  ({ participant, track, trackRef, source = Track.Source.Camera, className, objectFit = "cover", mirror = false }) => {
    const resolvedTrackRef = useMemo<TrackReference | undefined>(() => {
      if (trackRef) return trackRef
      if (!track) return undefined
      if (isTrackReference(track)) return track
      if (!participant) return undefined
      return { participant, publication: track, source }
    }, [participant, source, track, trackRef])

    if (!resolvedTrackRef?.publication) return null

    return (
      <VideoTrack
        trackRef={resolvedTrackRef}
        className={cn("livekit-video", className, {
          "livekit-video--mirror": mirror,
          "livekit-video--cover": objectFit === "cover",
          "livekit-video--contain": objectFit === "contain",
        })}
      />
    )
  },
)

LiveKitVideo.displayName = "LiveKitVideo"
